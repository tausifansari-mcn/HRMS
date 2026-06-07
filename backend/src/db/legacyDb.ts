import sql from 'mssql';
import { env } from '../config/env.js';

const config: sql.config = {
  server: env.LEGACY_MSSQL_HOST,
  port: env.LEGACY_MSSQL_PORT,
  user: env.LEGACY_MSSQL_USER,
  password: env.LEGACY_MSSQL_PASSWORD,
  database: env.LEGACY_MSSQL_DATABASE,
  options: {
    encrypt: env.LEGACY_MSSQL_ENCRYPT,
    trustServerCertificate: env.LEGACY_MSSQL_TRUST_CERT,
    enableArithAbort: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 60000,
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getLegacyPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  console.log(`[LEGACY] Connected to ${env.LEGACY_MSSQL_HOST}:${env.LEGACY_MSSQL_PORT}/${env.LEGACY_MSSQL_DATABASE}`);
  return pool;
}

export async function closeLegacyPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('[LEGACY] Connection pool closed');
  }
}

export async function testLegacyConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = await getLegacyPool();
    await p.request().query('SELECT 1 AS ok');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
