import { db } from './src/db/mysql.js';

async function checkRealManagers() {
  console.log('=== CHECKING REAL MANAGERS ===\n');

  const testManagers = [
    'MAS04461', // Branch Manager - Ankit Sharma
    'MAS01800', // Process Manager - Seema Patel
    '4854C'     // Team Leader - Nadeem Ahmed
  ];

  for (const code of testManagers) {
    console.log(`\n--- Checking ${code} ---`);

    // Get employee details
    const [employee] = await db.execute<any[]>(`
      SELECT
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.designation_name,
        b.branch_name,
        e.user_id,
        e.active_status
      FROM employees e
      LEFT JOIN designations d ON d.id = e.designation_id
      LEFT JOIN branches b ON b.id = e.branch_id
      WHERE e.employee_code = ?
    `, [code]);

    if (employee.length === 0) {
      console.log(`  NOT FOUND in database!`);
      continue;
    }

    const emp = employee[0];
    console.log(`  Name: ${emp.first_name} ${emp.last_name}`);
    console.log(`  Email: ${emp.email}`);
    console.log(`  Designation: ${emp.designation_name || 'N/A'}`);
    console.log(`  Branch: ${emp.branch_name || 'N/A'}`);
    console.log(`  User ID: ${emp.user_id || 'NOT SET'}`);
    console.log(`  Active: ${emp.active_status ? 'YES' : 'NO'}`);

    // Check auth account
    if (emp.user_id) {
      const [authUser] = await db.execute<any[]>(`
        SELECT
          au.id,
          au.email,
          au.password_hash IS NOT NULL AS has_password,
          ur.role_key
        FROM auth_user au
        LEFT JOIN user_roles ur ON ur.user_id = au.id
        WHERE au.id = ?
      `, [emp.user_id]);

      if (authUser.length > 0) {
        console.log(`  Auth: Email: ${authUser[0].email}, Password: ${authUser[0].has_password ? 'SET' : 'NOT SET'}, Role: ${authUser[0].role_key || 'NONE'}`);
      }
    } else {
      console.log(`  Auth: NO USER ACCOUNT`);
    }

    // Check team size (reporting to this manager)
    const [teamSize] = await db.execute<any[]>(`
      SELECT COUNT(*) AS count
      FROM employees
      WHERE reporting_manager_id = ?
        AND active_status = 1
    `, [emp.id]);

    console.log(`  Team size: ${teamSize[0].count} direct reports`);

    // Show sample team members
    if (teamSize[0].count > 0) {
      const [teamMembers] = await db.execute<any[]>(`
        SELECT e.employee_code, e.first_name, e.last_name, d.designation_name
        FROM employees e
        LEFT JOIN designations d ON d.id = e.designation_id
        WHERE e.reporting_manager_id = ?
          AND e.active_status = 1
        LIMIT 5
      `, [emp.id]);

      console.log(`  Sample team:`);
      teamMembers.forEach((tm: any) => {
        console.log(`    - ${tm.employee_code}: ${tm.first_name} ${tm.last_name} (${tm.designation_name || 'N/A'})`);
      });
    }

    // Check who they report to
    const [reportsTo] = await db.execute<any[]>(`
      SELECT
        m.employee_code,
        m.first_name,
        m.last_name,
        d.designation_name
      FROM employees e
      JOIN employees m ON m.id = e.reporting_manager_id
      LEFT JOIN designations d ON d.id = m.designation_id
      WHERE e.id = ?
    `, [emp.id]);

    if (reportsTo.length > 0) {
      console.log(`  Reports to: ${reportsTo[0].employee_code} - ${reportsTo[0].first_name} ${reportsTo[0].last_name} (${reportsTo[0].designation_name || 'N/A'})`);
    }
  }

  // Overall reporting structure stats
  console.log('\n\n=== OVERALL REPORTING STRUCTURE ===');

  const [stats] = await db.execute<any[]>(`
    SELECT
      COUNT(CASE WHEN reporting_manager_id IS NOT NULL THEN 1 END) AS has_manager,
      COUNT(CASE WHEN reporting_manager_id IS NULL THEN 1 END) AS no_manager,
      COUNT(DISTINCT reporting_manager_id) AS unique_managers
    FROM employees
    WHERE active_status = 1
  `);

  console.log(`Total employees with manager: ${stats[0].has_manager}`);
  console.log(`Total employees without manager: ${stats[0].no_manager}`);
  console.log(`Total unique managers: ${stats[0].unique_managers}`);

  await db.end();
}

checkRealManagers().catch(console.error);
