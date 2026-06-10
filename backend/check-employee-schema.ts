import { db } from './src/db/mysql.js';

async function checkEmployeeSchema() {
  // Get employee table structure
  const [columns] = await db.execute<any[]>(`
    DESCRIBE employees
  `);

  console.log('=== EMPLOYEES TABLE STRUCTURE ===\n');
  console.log('Column Name'.padEnd(30) + 'Type'.padEnd(30) + 'Null'.padEnd(10));
  console.log('-'.repeat(70));
  columns.forEach((col: any) => {
    console.log(
      col.Field.padEnd(30) +
      col.Type.padEnd(30) +
      col.Null.padEnd(10)
    );
  });

  await db.end();
}

checkEmployeeSchema().catch(console.error);
