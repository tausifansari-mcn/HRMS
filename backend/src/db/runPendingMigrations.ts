import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./mysql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.resolve(__dirname, "../../sql");

/**
 * Runs any .sql files in /backend/sql that haven't been applied yet.
 * Tracks applied migrations in schema_migrations table (created on first run).
 * Safe to call on every startup — skips already-applied files.
 */
export async function runPendingMigrations(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [applied] = await db.execute<any[]>("SELECT filename FROM schema_migrations");
  const appliedSet = new Set((applied as any[]).map((r: any) => r.filename));

  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql") && f !== "000_run_all.sql")
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = fs.readFileSync(path.join(SQL_DIR, file), "utf8");

    // Split on semicolons, skip blank/comment-only chunks
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    try {
      for (const stmt of statements) {
        await db.execute(stmt);
      }
      await db.execute("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
      console.log(`[migration] applied: ${file}`);
    } catch (err: any) {
      // IF NOT EXISTS / duplicate column are non-fatal — mark applied and move on
      if (
        err.code === "ER_TABLE_EXISTS_ERROR" ||
        err.code === "ER_DUP_FIELDNAME" ||
        err.code === "ER_DUP_KEYNAME" ||
        (err.message && err.message.includes("Duplicate column"))
      ) {
        await db.execute("INSERT IGNORE INTO schema_migrations (filename) VALUES (?)", [file]);
        console.log(`[migration] already-applied (idempotent): ${file}`);
      } else {
        console.error(`[migration] FAILED: ${file} — ${err.message}`);
        // Non-fatal: log and continue so the app still starts
      }
    }
  }
}
