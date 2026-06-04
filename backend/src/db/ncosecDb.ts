import sql from 'mssql';
import { env } from '../config/env.js';

const config: sql.config = {
  server:   env.NCOSEC_DB_HOST,
  port:     env.NCOSEC_DB_PORT,
  user:     env.NCOSEC_DB_USER,
  password: env.NCOSEC_DB_PASSWORD,
  database: env.NCOSEC_DB_NAME,
  options: {
    encrypt:                env.NCOSEC_DB_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort:       true,
  },
  connectionTimeout: 15000,
  requestTimeout:    60000,
};

let pool: sql.ConnectionPool | null = null;

export async function getNcosecPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  console.log(`[NCOSEC] Connected to ${env.NCOSEC_DB_HOST}:${env.NCOSEC_DB_PORT}/${env.NCOSEC_DB_NAME}`);
  return pool;
}

export async function closeNcosecPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export async function testNcosecConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = await getNcosecPool();
    await p.request().query('SELECT 1 AS ok');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
