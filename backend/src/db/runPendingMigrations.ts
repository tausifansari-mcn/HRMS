import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./mysql.js";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.resolve(__dirname, "../../sql");

export type MigrationHealth = {
  status: "not_started" | "running" | "ok" | "failed";
  applied: string[];
  skipped: string[];
  failed: Array<{ filename: string; error: string }>;
  startedAt: string | null;
  completedAt: string | null;
};

let migrationHealth: MigrationHealth = {
  status: "not_started",
  applied: [],
  skipped: [],
  failed: [],
  startedAt: null,
  completedAt: null,
};

export function getMigrationHealth(): MigrationHealth {
  return {
    ...migrationHealth,
    applied: [...migrationHealth.applied],
    skipped: [...migrationHealth.skipped],
    failed: migrationHealth.failed.map((item) => ({ ...item })),
  };
}

function isIdempotentMigrationError(error: any): boolean {
  return (
    error?.code === "ER_TABLE_EXISTS_ERROR" ||
    error?.code === "ER_DUP_FIELDNAME" ||
    error?.code === "ER_DUP_KEYNAME" ||
    String(error?.message ?? "").includes("Duplicate column")
  );
}

/**
 * Runs pending SQL migrations and records a health summary for monitoring.
 * Production startup is blocked when any migration fails so the API cannot
 * advertise a healthy deployment against an incomplete schema.
 */
export async function runPendingMigrations(): Promise<MigrationHealth> {
  migrationHealth = {
    status: "running",
    applied: [],
    skipped: [],
    failed: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [applied] = await db.execute<any[]>("SELECT filename FROM schema_migrations");
    const appliedSet = new Set((applied as any[]).map((row: any) => row.filename));

    const files = fs
      .readdirSync(SQL_DIR)
      .filter((file) => file.endsWith(".sql") && file !== "000_run_all.sql")
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        migrationHealth.skipped.push(file);
        continue;
      }

      const sql = fs.readFileSync(path.join(SQL_DIR, file), "utf8");
      const statements = sql
        .split(";")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0 && !statement.startsWith("--"));

      try {
        for (const statement of statements) await db.execute(statement);
        await db.execute("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
        migrationHealth.applied.push(file);
        console.log(`[migration] applied: ${file}`);
      } catch (error: any) {
        if (isIdempotentMigrationError(error)) {
          await db.execute("INSERT IGNORE INTO schema_migrations (filename) VALUES (?)", [file]);
          migrationHealth.skipped.push(file);
          console.log(`[migration] already applied/idempotent: ${file}`);
          continue;
        }

        const message = error?.message ?? String(error);
        migrationHealth.failed.push({ filename: file, error: message });
        console.error(`[migration] FAILED: ${file} — ${message}`);
      }
    }
  } catch (error: any) {
    migrationHealth.failed.push({
      filename: "migration-runner",
      error: error?.message ?? String(error),
    });
  }

  migrationHealth.completedAt = new Date().toISOString();
  migrationHealth.status = migrationHealth.failed.length > 0 ? "failed" : "ok";

  if (migrationHealth.failed.length > 0 && env.NODE_ENV === "production") {
    const names = migrationHealth.failed.map((item) => item.filename).join(", ");
    throw new Error(`Production startup blocked because migrations failed: ${names}`);
  }

  return getMigrationHealth();
}
