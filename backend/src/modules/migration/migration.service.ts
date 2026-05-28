import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

export interface ModuleStatus {
  module: string;
  mysql_count: number;
  status: "empty" | "has_data";
}

export const migrationService = {
  async getModuleStatus(): Promise<ModuleStatus[]> {
    const modules = [
      { module: "employees",   table: "employees" },
      { module: "attendance",  table: "wfm_attendance_session" },
      { module: "wfm",         table: "wfm_roster_assignment" },
      { module: "leave",       table: "leave_request" },
      { module: "ats",         table: "ats_candidate" },
      { module: "payroll",     table: "salary_prep_run" },
    ];

    const results: ModuleStatus[] = [];
    for (const m of modules) {
      try {
        const [rows] = await db.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM ${m.table}`
        );
        const cnt = (rows as { cnt: number }[])[0]?.cnt ?? 0;
        results.push({ module: m.module, mysql_count: cnt, status: cnt > 0 ? "has_data" : "empty" });
      } catch {
        results.push({ module: m.module, mysql_count: 0, status: "empty" });
      }
    }
    return results;
  },
};
