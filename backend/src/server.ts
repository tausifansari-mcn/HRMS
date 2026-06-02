import { app } from "./app.js";
import { env } from "./config/env.js";
import { runPendingMigrations } from "./db/runPendingMigrations.js";
import { startTenureBadgeScheduler } from "./modules/engagement/tenure.cron.js";
import { startCommunicationCleanup } from "./modules/communication/cleanup.cron.js";
import { startAttendanceEngineScheduler } from "./modules/wfm/attendance-engine.cron.js";

runPendingMigrations()
  .then(() => {
    app.listen(env.PORT, () => {
      startTenureBadgeScheduler();
      startCommunicationCleanup();
      startAttendanceEngineScheduler();
      console.log(`MCN HRMS backend running on http://localhost:${env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("[startup] migration runner failed — starting anyway:", err.message);
    app.listen(env.PORT, () => {
      startTenureBadgeScheduler();
      startCommunicationCleanup();
      startAttendanceEngineScheduler();
      console.log(`MCN HRMS backend running on http://localhost:${env.PORT}`);
    });
  });
