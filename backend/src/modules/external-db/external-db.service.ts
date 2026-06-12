// backend/src/modules/external-db/external-db.service.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import sql from 'mssql';
import mysql from 'mysql2/promise';
import { db } from '../../db/mysql.js';
import { env } from '../../config/env.js';
import type { RowDataPacket } from 'mysql2';

export interface DbCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table?: string;
  date_column?: string;
  employee_code_column?: string;
  db_type: 'mssql' | 'mysql';
  tables?: string[];
}

const ALGO = 'aes-256-gcm';
const KEY_BUF = () => Buffer.from(env.ENCRYPTION_KEY, 'hex');

export function encryptCredentials(creds: DbCredentials): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, KEY_BUF(), iv);
  const plain = JSON.stringify(creds);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptCredentials(stored: string): DbCredentials {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv(ALGO, KEY_BUF(), iv);
  decipher.setAuthTag(tag);
  const plain = decipher.update(encrypted) + decipher.final('utf8');
  return JSON.parse(plain) as DbCredentials;
}

const mssqlPools = new Map<string, sql.ConnectionPool>();
const mysqlPools = new Map<string, mysql.Pool>();

export async function getCredentialsForKey(key: string): Promise<DbCredentials | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT encrypted_credentials, config_json FROM integration_config WHERE integration_key = ?`,
    [key]
  );
  const row = (rows as any[])[0];
  if (!row) return null;
  if (row.encrypted_credentials) {
    return decryptCredentials(row.encrypted_credentials);
  }
  return null;
}

export async function getPoolForKey(key: string): Promise<sql.ConnectionPool | mysql.Pool> {
  const creds = await getCredentialsForKey(key);
  if (!creds) throw new Error(`No credentials configured for integration: ${key}`);

  if (creds.db_type === 'mssql') {
    const existing = mssqlPools.get(key);
    if (existing && existing.connected) return existing;
    const pool = await new sql.ConnectionPool({
      server: creds.host,
      port: creds.port,
      user: creds.username,
      password: creds.password,
      database: creds.database,
      options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
      connectionTimeout: 15000,
      requestTimeout: 60000,
    }).connect();
    mssqlPools.set(key, pool);
    return pool;
  } else {
    const existing = mysqlPools.get(key);
    if (existing) return existing;
    const pool = mysql.createPool({
      host: creds.host,
      port: creds.port,
      user: creds.username,
      password: creds.password,
      database: creds.database,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 15000,
    });
    mysqlPools.set(key, pool);
    return pool;
  }
}

export function invalidatePool(key: string): void {
  mssqlPools.delete(key);
  mysqlPools.delete(key);
}

export async function testPoolForKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const creds = await getCredentialsForKey(key);
    if (!creds) return { ok: false, error: 'No credentials configured' };

    invalidatePool(key); // force fresh connection for test
    const pool = await getPoolForKey(key);

    if (creds.db_type === 'mssql') {
      await (pool as sql.ConnectionPool).request().query('SELECT 1 AS ok');
    } else {
      await (pool as mysql.Pool).execute('SELECT 1 AS ok');
    }
    return { ok: true };
  } catch (e: any) {
    invalidatePool(key);
    return { ok: false, error: e.message };
  }
}
