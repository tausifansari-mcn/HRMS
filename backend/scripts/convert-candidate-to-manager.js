import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const candidateId = 'a5696474-b9b5-4548-9578-d31ea24767c5';

async function main() {
  const connection = await mysql.createConnection({
    host: '122.184.128.90',
    port: 3306,
    user: 'shivam_user',
    password: 'qwersdfg!@#hjk',
    database: 'mas_hrms'
  });

  try {
    console.log('Connected to database');

    // Step 1: Get candidate details
    const [candidateRows] = await connection.execute(
      'SELECT * FROM ats_candidate WHERE id = ? AND active_status = 1 LIMIT 1',
      [candidateId]
    );

    if (candidateRows.length === 0) {
      throw new Error('Candidate not found');
    }

    const candidate = candidateRows[0];
    console.log('Candidate found:', candidate.full_name, candidate.email);

    if (candidate.current_stage === 'converted') {
      throw new Error('Candidate has already been converted');
    }

    // Step 2: Get onboarding bridge (if exists)
    const [bridgeRows] = await connection.execute(
      'SELECT * FROM ats_onboarding_bridge WHERE candidate_id = ? LIMIT 1',
      [candidateId]
    );
    const bridge = bridgeRows[0] || null;

    // Step 3: Parse name
    const fullName = candidate.full_name || '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // Step 4: Generate employee code
    const [codeRows] = await connection.execute(
      "SELECT employee_code FROM employees WHERE employee_code LIKE 'MAS%' ORDER BY employee_code DESC LIMIT 1"
    );
    let employeeCode = 'MAS00001';
    if (codeRows.length > 0) {
      const lastCode = codeRows[0].employee_code;
      const num = parseInt(lastCode.replace('MAS', ''), 10);
      employeeCode = `MAS${String(isNaN(num) ? 1 : num + 1).padStart(5, '0')}`;
    }

    const employeeId = randomUUID();
    const joiningDate = bridge?.joining_date || new Date().toISOString().slice(0, 10);

    console.log('Creating employee:', employeeCode, employeeId);

    // Step 5: Insert employee
    await connection.execute(
      `INSERT INTO employees
         (id, employee_code, first_name, last_name, email, mobile,
          date_of_joining, salary_start_date,
          branch_id, process_id, designation_id,
          employment_type, employment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Full Time', 'Active')`,
      [
        employeeId,
        employeeCode,
        firstName,
        lastName,
        candidate.email || null,
        candidate.mobile || null,
        joiningDate,
        joiningDate,
        bridge?.branch_id || null,
        bridge?.process_id || null,
        bridge?.designation_id || null
      ]
    );

    // Step 6: Create auth_user
    const userId = randomUUID();
    const password = 'Manager@123'; // Default password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if auth_user exists for this email
    const [existingAuth] = await connection.execute(
      'SELECT id FROM auth_user WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [candidate.email]
    );

    let finalUserId;
    if (existingAuth.length > 0) {
      finalUserId = existingAuth[0].id;
      console.log('Using existing auth_user:', finalUserId);
    } else {
      finalUserId = userId;
      await connection.execute(
        'INSERT INTO auth_user (id, email, password_hash, must_change_password, is_blocked) VALUES (?, ?, ?, 0, 0)',
        [userId, candidate.email, passwordHash]
      );
      console.log('Created auth_user:', userId);
    }

    // Step 7: Link employee to auth_user
    await connection.execute(
      'UPDATE employees SET user_id = ? WHERE id = ?',
      [finalUserId, employeeId]
    );

    // Step 8: Assign manager role
    await connection.execute(
      'INSERT INTO user_roles (id, user_id, role_key, active_status) VALUES (UUID(), ?, ?, 1) ON DUPLICATE KEY UPDATE active_status = 1',
      [finalUserId, 'manager']
    );
    console.log('Assigned manager role');

    // Step 9: Mark candidate as converted
    await connection.execute(
      "UPDATE ats_candidate SET current_stage = 'converted', updated_at = NOW() WHERE id = ?",
      [candidateId]
    );

    // Step 10: Update bridge record
    if (bridge) {
      await connection.execute(
        "UPDATE ats_onboarding_bridge SET employee_id = ?, status = 'converted', updated_at = NOW() WHERE candidate_id = ?",
        [employeeId, candidateId]
      );
    }

    console.log('\n=== Conversion Successful ===');
    console.log('Employee ID:', employeeId);
    console.log('Employee Code:', employeeCode);
    console.log('User ID:', finalUserId);
    console.log('Email:', candidate.email);
    console.log('Role:', 'manager');
    console.log('Password:', password);
    console.log('===========================\n');

    // Return structured data
    const result = {
      employeeId: employeeId,
      userId: finalUserId,
      email: candidate.email,
      role: 'manager',
      password: password
    };

    console.log('JSON Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
