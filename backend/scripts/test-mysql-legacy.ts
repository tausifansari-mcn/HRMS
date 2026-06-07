import mysql from 'mysql2/promise';

async function testConnection() {
  console.log('Testing legacy MySQL connection...');
  console.log('Host: 14.97.30.236');
  console.log('Port: 3306');
  console.log('Database: db_bill');
  console.log('User: shivam_user\n');

  try {
    const connection = await mysql.createConnection({
      host: '14.97.30.236',
      port: 3306,
      user: 'shivam_user',
      password: 'qwersdfg!@#hjk',
      database: 'db_bill',
      connectTimeout: 10000,
    });

    console.log('✅ Connected successfully!\n');

    // Test query
    const [rows] = await connection.execute('SELECT DATABASE() as db, VERSION() as version, NOW() as now');
    console.log('Database info:', rows);

    // List tables
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'db_bill'
      ORDER BY TABLE_ROWS DESC
      LIMIT 10
    `);
    console.log('\nTop 10 tables by row count:');
    console.table(tables);

    await connection.end();
    console.log('\n✅ Connection test complete!');
  } catch (error: any) {
    console.error('\n❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
