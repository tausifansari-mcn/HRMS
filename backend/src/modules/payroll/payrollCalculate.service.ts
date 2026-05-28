import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { payrollService } from "./payroll.service.js";
import type { SalaryPrepRun } from "./payroll.types.js";

const LOCKED_STATUSES = new Set(["locked", "disbursed"]);

export interface CalculateResult {
  run_id: string;
  status: string;
  employees_processed: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
}

interface EmployeeRow {
  employee_id: string;
  employee_code: string;
  ctc_annual: number;
  basic_pct: number;
  hra_pct: number;
}

interface AttendanceRow {
  employee_id: string;
  working_days: number;
  present_days: number;
  leave_days: number;
  lwp_days: number;
  late_marks: number;
  dialer_hours: number | null;
}

interface StatutoryRow {
  pf_employee_pct: number;
  esic_employee_pct: number;
  esic_wage_limit: number;
  pf_wage_limit: number;
  professional_tax: number;
}

export async function calculatePayrollRun(runId: string, userId: string): Promise<CalculateResult> {
  // 1. Load run
  const [runRows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM salary_prep_run WHERE id = ? LIMIT 1", [runId]
  );
  const run = (runRows as SalaryPrepRun[])[0];
  if (!run) throw new Error("Run not found");
  if (LOCKED_STATUSES.has(run.status)) {
    throw new Error(`Cannot recalculate a ${run.status} run`);
  }

  // 2. Statutory config
  const [statRows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM statutory_config LIMIT 1"
  );
  const stat: StatutoryRow = (statRows as StatutoryRow[])[0] ?? {
    pf_employee_pct: 12, esic_employee_pct: 0.75,
    esic_wage_limit: 21000, pf_wage_limit: 15000, professional_tax: 200,
  };

  // 3. Fetch eligible employees (scoped to run's process/branch filters)
  const empConds: string[] = ["esa.active_status = 1"];
  const empParams: unknown[] = [];
  if (run.process_filter) {
    empConds.push("(pm.process_name = ? OR e.process_id IN (SELECT id FROM process_master WHERE process_name = ?))");
    empParams.push(run.process_filter, run.process_filter);
  }
  if (run.branch_filter) {
    empConds.push("e.branch_id IN (SELECT id FROM branch_master WHERE branch_name = ?)");
    empParams.push(run.branch_filter);
  }

  const [empRows] = await db.execute<RowDataPacket[]>(
    `SELECT e.id AS employee_id, e.employee_code,
            esa.ctc_annual, ss.basic_pct, ss.hra_pct
       FROM employees e
       JOIN employee_salary_assignment esa ON esa.employee_id = e.id
       JOIN salary_structure_master ss      ON ss.id = esa.structure_id
       LEFT JOIN process_master pm          ON pm.id = e.process_id
      WHERE e.employment_status = 'active' AND ${empConds.join(" AND ")}`,
    empParams
  );
  const employees = empRows as EmployeeRow[];

  // 4. Derive working days from run_month (Mon–Sat = 26 assumed; real impl queries holidays)
  const [year, month] = run.run_month.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const defaultWorkingDays = 26; // BPO standard; can be refined later

  let totalGross = 0;
  let totalDed = 0;
  let totalNet = 0;

  for (const emp of employees) {
    // 5. Fetch attendance summary for this employee for run_month
    const monthStart = `${run.run_month}-01`;
    const monthEnd   = `${run.run_month}-${String(daysInMonth).padStart(2, "0")}`;

    const [attRows] = await db.execute<RowDataPacket[]>(
      `SELECT
         ? AS employee_id,
         ? AS working_days,
         COUNT(CASE WHEN s.current_status IN ('Logged Out','Logged In') THEN 1 END) AS present_days,
         0 AS leave_days,
         (? - COUNT(CASE WHEN s.current_status IN ('Logged Out','Logged In') THEN 1 END)) AS lwp_days,
         0 AS late_marks,
         NULL AS dialer_hours
       FROM wfm_attendance_session s
       WHERE s.employee_id = ? AND s.session_date BETWEEN ? AND ?`,
      [emp.employee_id, defaultWorkingDays, defaultWorkingDays, emp.employee_id, monthStart, monthEnd]
    );

    const att: AttendanceRow = (attRows as AttendanceRow[])[0] ?? {
      employee_id: emp.employee_id,
      working_days: defaultWorkingDays,
      present_days: defaultWorkingDays,
      leave_days: 0,
      lwp_days: 0,
      late_marks: 0,
      dialer_hours: null,
    };

    const grossMonthly = emp.ctc_annual / 12;

    const calc = payrollService.calculateNetSalary({
      grossMonthlyCTC: grossMonthly,
      workingDays: att.working_days || defaultWorkingDays,
      lwpDays: att.lwp_days || 0,
      pfEmployeePct: stat.pf_employee_pct,
      esicEmployeePct: stat.esic_employee_pct,
      esicWageLimit: stat.esic_wage_limit,
      pfWageLimit: stat.pf_wage_limit,
      professionalTax: stat.professional_tax,
      tds: 0, // TDS computed separately at annual projection
      basicPct: emp.basic_pct ?? 40,
      hraPct: emp.hra_pct ?? 20,
    });

    // 6. Upsert prep line
    await db.execute(
      `INSERT INTO salary_prep_line
         (id, run_id, employee_id, employee_code,
          working_days, present_days, leave_days, lwp_days, late_marks, dialer_hours,
          gross_salary, total_deductions, net_salary,
          pf_employee, pf_employer, esic_employee, esic_employer,
          professional_tax, tds, status)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculated')
       ON DUPLICATE KEY UPDATE
         working_days = VALUES(working_days), present_days = VALUES(present_days),
         lwp_days = VALUES(lwp_days), gross_salary = VALUES(gross_salary),
         total_deductions = VALUES(total_deductions), net_salary = VALUES(net_salary),
         pf_employee = VALUES(pf_employee), pf_employer = VALUES(pf_employer),
         esic_employee = VALUES(esic_employee), esic_employer = VALUES(esic_employer),
         professional_tax = VALUES(professional_tax), status = 'calculated'`,
      [
        runId, emp.employee_id, emp.employee_code,
        att.working_days, att.present_days, att.leave_days, att.lwp_days, att.late_marks, att.dialer_hours,
        calc.gross_salary, calc.total_deductions, calc.net_salary,
        calc.pf_employee, calc.pf_employer, calc.esic_employee, calc.esic_employer,
        calc.professional_tax, calc.tds,
      ]
    );

    totalGross += calc.gross_salary;
    totalDed   += calc.total_deductions;
    totalNet   += calc.net_salary;
  }

  // 7. Update run totals + status
  await db.execute(
    `UPDATE salary_prep_run
        SET status = 'processing', total_employees = ?,
            total_gross = ?, total_deductions = ?, total_net = ?
      WHERE id = ?`,
    [employees.length, totalGross, totalDed, totalNet, runId]
  );

  const [updated] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM salary_prep_run WHERE id = ? LIMIT 1", [runId]
  );

  return {
    run_id: runId,
    status: (updated as SalaryPrepRun[])[0]?.status ?? "processing",
    employees_processed: employees.length,
    total_gross: totalGross,
    total_deductions: totalDed,
    total_net: totalNet,
  };
}
