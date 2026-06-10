import { db } from './src/db/mysql.js';

async function checkPasswords() {
  // Check auth users and their password status
  const [users] = await db.execute<any[]>(`
    SELECT
      au.id,
      au.email,
      e.employee_code,
      e.first_name,
      ur.role_key,
      LENGTH(au.password_hash) AS password_length,
      SUBSTRING(au.password_hash, 1, 20) AS password_preview
    FROM auth_user au
    LEFT JOIN employees e ON e.user_id = au.id
    LEFT JOIN user_roles ur ON ur.user_id = au.id
    WHERE au.email LIKE '%manager%' OR ur.role_key = 'manager'
       OR e.employee_code = 'EMP-MGR-001'
    LIMIT 10
  `);

  console.log('Manager user details:');
  users.forEach((u: any) => {
    console.log(`\nEmail: ${u.email}`);
    console.log(`Employee: ${u.employee_code} - ${u.first_name}`);
    console.log(`Role: ${u.role_key || 'NONE'}`);
    console.log(`Password hash length: ${u.password_length}`);
    console.log(`Password preview: ${u.password_preview}`);
  });

  // Check if there's a plain text password anywhere (demo data often has these)
  const [demoUsers] = await db.execute<any[]>(`
    SELECT email, employee_code, first_name, role_key
    FROM auth_user au
    LEFT JOIN employees e ON e.user_id = au.id
    LEFT JOIN user_roles ur ON ur.user_id = au.id
    WHERE au.email IN ('manager@mascallnet.com', 'admin@mascallnet.com')
    LIMIT 10
  `);

  console.log('\n\n=== Demo users ===');
  demoUsers.forEach((u: any) => {
    console.log(`${u.email} - ${u.role_key || 'NO_ROLE'}`);
  });

  await db.end();
}

checkPasswords().catch(console.error);
