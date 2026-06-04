/**
 * migrate-ncosec-biometric.ts
 *
 * One-shot ETL: Matrix Cosec NCOSEC (172.10.10.146) → HRMS MySQL
 *
 * Logic:
 *   1. Connect to NCOSEC MSSQL
 *   2. Query Mx_ATDEventTrn JOIN Mx_UserMst — MIN(lDateTime) as first_punch_in,
 *      MAX(lDateTime) as last_punch_out, grouped by UserID + calendar day
 *   3. Map Cosec UserID → HRMS employee_id via employee_biometric_enrollment
 *      OR fallback: assume UserID == employee_code
 *   4. Upsert biometric_attendance_log
 *   5. Upsert attendance_daily_record (clock_in_time, clock_out_time, raw_minutes, status)
 *   6. Link biometric_attendance_log.attendance_record_id to the ADR row
 *   7. Auto-create employee_biometric_enrollment rows for matched employees
 *   8. Print summary
 *
 * Run: cd backend && npx tsx scripts/migrate-ncosec-biometric.ts
 * Safe to re-run: ON DUPLICATE KEY UPDATE ensures idempotency
 */

import 'dotenv/config';
import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getNcosecPool, closeNcosecPool, testNcosecConnection } from '../src/db/ncosecDb.js';
import { db } from '../src/db/mysql.js';

interface NcosecRow {
  UserID:          string;
  Name:            string;
  punch_date:      Date | string;
  first_punch_in:  number;   // Unix timestamp seconds
  last_punch_out:  number;   // Unix timestamp seconds
}

interface EmployeeMap {
  [cosecUserId: string]: { employeeId: string; employeeCode: string };
}

interface Summary {
  total_ncosec_rows:     number;
  attendance_inserted:   number;
  attendance_updated:    number;
  employees_not_found:   string[];
  errors:                Array<{ userId: string; date: string; error: string }>;
}

async function fetchNcosecPunches(pool: sql.ConnectionPool): Promise<NcosecRow[]> {
  console.log('[NCOSEC] Querying last 3 months of punch data...');
  const result = await pool.request().query<NcosecRow>(`
    SELECT
        u.UserID,
        u.Name,
        CAST(e.EDateTime AS DATE)   AS punch_date,
        MIN(e.lDateTime)             AS first_punch_in,
        MAX(e.lDateTime)             AS last_punch_out
    FROM Mx_ATDEventTrn e
    INNER JOIN Mx_UserMst u ON u.UserID = e.UserID
    WHERE e.EDateTime >= DATEADD(MONTH, -3, GETDATE())
      AND e.lDateTime > 0
    GROUP BY u.UserID, u.Name, CAST(e.EDateTime AS DATE)
    HAVING COUNT(*) >= 1
    ORDER BY punch_date ASC, u.UserID ASC
  `);
  console.log(`[NCOSEC] ${result.recordset.length} punch-day records found`);
  return result.recordset;
}

async function buildEmployeeMap(): Promise<EmployeeMap> {
  console.log('[HRMS] Building UserID → employee_id map...');
  // Check existing enrollments first
  const [enrolled] = await db.execute<any[]>(
    `SELECT cosec_user_id, employee_id, cosec_user_name FROM employee_biometric_enrollment WHERE is_active = 1`
  );
  const map: EmployeeMap = {};
  if (enrolled.length > 0) {
    for (const r of enrolled) map[r.cosec_user_id] = { employeeId: r.employee_id, employeeCode: r.cosec_user_id };
    console.log(`[HRMS] Loaded ${enrolled.length} existing enrollment mappings`);
  }
  // Fill in remaining via employee_code match (UserID often == employee_code in Cosec)
  const [employees] = await db.execute<any[]>(
    `SELECT id, employee_code FROM employees WHERE active_status = 1`
  );
  for (const emp of employees) {
    if (!map[emp.employee_code]) {
      map[emp.employee_code] = { employeeId: emp.id, employeeCode: emp.employee_code };
    }
  }
  console.log(`[HRMS] Total mappable employees: ${Object.keys(map).length}`);
  return map;
}

async function ensureEnrollment(employeeId: string, cosecUserId: string, name: string): Promise<void> {
  await db.execute(`
    INSERT IGNORE INTO employee_biometric_enrollment
      (id, employee_id, cosec_user_id, cosec_user_name, is_active, last_sync_at)
    VALUES (UUID(), ?, ?, ?, 1, NOW())
  `, [employeeId, cosecUserId, name]);
}

async function upsertBiometricLog(
  employeeId: string, cosecUserId: string,
  punchDate: string, punchIn: Date, punchOut: Date,
  rawMinutes: number
): Promise<string> {
  await db.execute(`
    INSERT INTO biometric_attendance_log
      (id, employee_id, cosec_user_id, punch_date, first_punch_in, last_punch_out, raw_minutes, source_system)
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'ncosec')
    ON DUPLICATE KEY UPDATE
      first_punch_in = VALUES(first_punch_in),
      last_punch_out = VALUES(last_punch_out),
      raw_minutes    = VALUES(raw_minutes),
      migrated_at    = NOW()
  `, [employeeId, cosecUserId, punchDate, punchIn, punchOut, rawMinutes]);

  const [rows] = await db.execute<any[]>(
    `SELECT id FROM biometric_attendance_log WHERE employee_id = ? AND punch_date = ? LIMIT 1`,
    [employeeId, punchDate]
  );
  return rows[0]?.id ?? '';
}

async function upsertAttendanceDailyRecord(
  employeeId: string, punchDate: string,
  punchIn: Date, punchOut: Date, rawMinutes: number,
  bioLogId: string
): Promise<'inserted' | 'updated'> {
  const status = rawMinutes >= 360 ? 'present' : rawMinutes >= 180 ? 'half_day' : 'half_day';

  const [empInfo] = await db.execute<any[]>(
    `SELECT branch_id, process_id FROM employees WHERE id = ? LIMIT 1`, [employeeId]
  );
  const emp = empInfo[0] ?? {};

  const [res] = await db.execute<any>(`
    INSERT INTO attendance_daily_record
      (id, employee_id, record_date, clock_in_time, clock_out_time, raw_minutes,
       attendance_status, attendance_source, branch_id, process_id, created_by)
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'biometric', ?, ?, 'ncosec_migration')
    ON DUPLICATE KEY UPDATE
      clock_in_time     = VALUES(clock_in_time),
      clock_out_time    = VALUES(clock_out_time),
      raw_minutes       = VALUES(raw_minutes),
      attendance_status = VALUES(attendance_status),
      attendance_source = 'biometric',
      created_by        = 'ncosec_migration'
  `, [employeeId, punchDate, punchIn, punchOut, rawMinutes, status,
      emp.branch_id ?? null, emp.process_id ?? null]);

  const wasInsert = res.affectedRows === 1;

  // Link biometric log → attendance record
  if (bioLogId) {
    const [adrRow] = await db.execute<any[]>(
      `SELECT id FROM attendance_daily_record WHERE employee_id = ? AND record_date = ? LIMIT 1`,
      [employeeId, punchDate]
    );
    if (adrRow[0]?.id) {
      await db.execute(
        `UPDATE biometric_attendance_log SET attendance_record_id = ? WHERE id = ?`,
        [adrRow[0].id, bioLogId]
      );
    }
  }
  return wasInsert ? 'inserted' : 'updated';
}

async function main() {
  console.log('\n=================================================');
  console.log('  NCOSEC → HRMS Biometric Migration');
  console.log('  NCOSEC Server: 172.10.10.146');
  console.log('=================================================\n');

  console.log('[1/5] Testing NCOSEC connection...');
  const test = await testNcosecConnection();
  if (!test.ok) {
    console.error(`\n❌ Cannot connect to NCOSEC: ${test.error}`);
    process.exit(1);
  }
  console.log('   ✓ NCOSEC connected\n');

  const summary: Summary = {
    total_ncosec_rows: 0, attendance_inserted: 0,
    attendance_updated: 0, employees_not_found: [], errors: [],
  };

  try {
    console.log('[2/5] Fetching punch data from NCOSEC...');
    const ncPool = await getNcosecPool();
    const rows = await fetchNcosecPunches(ncPool);
    summary.total_ncosec_rows = rows.length;

    console.log('[3/5] Building employee map...');
    const empMap = await buildEmployeeMap();

    console.log('[4/5] Importing records...');
    let processed = 0;
    const notFound = new Set<string>();

    for (const row of rows) {
      try {
        const cosecId = String(row.UserID).trim();
        const match = empMap[cosecId];
        if (!match) { notFound.add(cosecId); continue; }

        // lDateTime is Unix seconds → JS Date (milliseconds)
        const punchIn  = new Date(Number(row.first_punch_in)  * 1000);
        const punchOut = new Date(Number(row.last_punch_out)   * 1000);

        // Convert punch_date to YYYY-MM-DD string
        const pd = row.punch_date;
        const punchDate = pd instanceof Date
          ? pd.toISOString().slice(0, 10)
          : String(pd).slice(0, 10);

        // Skip single-scan days (same punch = can't distinguish in vs out)
        if (punchIn.getTime() === punchOut.getTime()) continue;

        const rawMinutes = Math.max(0, Math.floor((punchOut.getTime() - punchIn.getTime()) / 60000));

        await ensureEnrollment(match.employeeId, cosecId, row.Name);
        const bioLogId = await upsertBiometricLog(match.employeeId, cosecId, punchDate, punchIn, punchOut, rawMinutes);
        const action = await upsertAttendanceDailyRecord(match.employeeId, punchDate, punchIn, punchOut, rawMinutes, bioLogId);

        if (action === 'inserted') summary.attendance_inserted++;
        else summary.attendance_updated++;

        processed++;
        if (processed % 200 === 0) process.stdout.write(`   ... ${processed}/${rows.length}\r`);

      } catch (err: any) {
        summary.errors.push({
          userId: String(row.UserID),
          date:   String(row.punch_date).slice(0, 10),
          error:  err.message,
        });
      }
    }
    summary.employees_not_found = Array.from(notFound);

  } finally {
    await closeNcosecPool();
  }

  console.log('\n[5/5] Done.\n');
  console.log('=================================================');
  console.log('  MIGRATION SUMMARY');
  console.log('=================================================');
  console.log(`  NCOSEC rows read       : ${summary.total_ncosec_rows}`);
  console.log(`  Attendance inserted    : ${summary.attendance_inserted}`);
  console.log(`  Attendance updated     : ${summary.attendance_updated}`);
  console.log(`  Errors                 : ${summary.errors.length}`);
  if (summary.employees_not_found.length > 0) {
    console.log(`\n  ⚠  ${summary.employees_not_found.length} Cosec UserID(s) not matched to HRMS:`);
    summary.employees_not_found.slice(0, 20).forEach(id => console.log(`     UserID: ${id}`));
    if (summary.employees_not_found.length > 20)
      console.log(`     ... and ${summary.employees_not_found.length - 20} more`);
    console.log('\n  Fix: Ensure HRMS employee_code matches Cosec UserID,');
    console.log('       OR add manual rows to employee_biometric_enrollment table.');
  }
  if (summary.errors.length > 0) {
    console.log('\n  Errors (first 10):');
    summary.errors.slice(0, 10).forEach(e => console.log(`    UserID ${e.userId} / ${e.date}: ${e.error}`));
  }
  console.log('=================================================\n');

  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
