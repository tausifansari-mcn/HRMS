const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: '14.97.30.236',
    port: 3306,
    user: 'shivam_user',
    password: 'qwersdfg!@#hjk',
    database: 'db_bill'
  });

  console.log('ALL tables ordered by row count:');
  const [all] = await conn.execute(`
    SELECT
      TABLE_NAME,
      TABLE_ROWS,
      ROUND(DATA_LENGTH/1024/1024, 2) as SIZE_MB,
      UPDATE_TIME,
      CREATE_TIME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'db_bill'
      AND TABLE_ROWS > 100
    ORDER BY TABLE_ROWS DESC
    LIMIT 50
  `);
  console.table(all);

  console.log('\n\nTables with "mas" or "master" in name (likely core data):');
  const [masters] = await conn.execute(`
    SELECT TABLE_NAME, TABLE_ROWS, UPDATE_TIME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'db_bill'
      AND (TABLE_NAME LIKE '%mas%' OR TABLE_NAME LIKE '%master%')
      AND TABLE_ROWS > 100
    ORDER BY TABLE_ROWS DESC
    LIMIT 30
  `);
  console.table(masters);

  await conn.end();
}

run().catch(console.error);
