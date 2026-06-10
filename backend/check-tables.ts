import { db } from './src/db/mysql.js';

async function checkTables() {
  const [tables] = await db.execute<any[]>(`SHOW TABLES`);

  console.log('=== TABLES IN mas_hrms ===\n');
  tables.forEach((t: any) => {
    console.log(Object.values(t)[0]);
  });

  await db.end();
}

checkTables().catch(console.error);
