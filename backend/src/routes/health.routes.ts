import { Router } from "express";
import { pingDb } from "../db/mysql.js";
import { getMigrationHealth } from "../db/runPendingMigrations.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let dbStatus: "ok" | "error" = "ok";
  try {
    await pingDb();
  } catch {
    dbStatus = "error";
  }

  const migrations = getMigrationHealth();
  const healthy = dbStatus === "ok" && migrations.status !== "failed";

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: "MCN HRMS Backend API",
    status: healthy ? "healthy" : "degraded",
    db: dbStatus,
    migrations: {
      status: migrations.status,
      applied_count: migrations.applied.length,
      skipped_count: migrations.skipped.length,
      failed: migrations.failed,
      completed_at: migrations.completedAt,
    },
    timestamp: new Date().toISOString(),
  });
});
