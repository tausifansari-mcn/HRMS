import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import type { GovernanceActivity } from "./portal.types.js";
import type { UpdateGovernanceInput } from "./portal.validation.js";

export const portalGovernanceService = {
  async getChecklist(processId: string, period: string): Promise<GovernanceActivity[]> {
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`Invalid period format: ${period}`);

    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         a.id AS activity_id, a.activity_name, a.level, a.frequency, a.required_count,
         COALESCE(l.completed_count, 0) AS completed_count
       FROM governance_activity_master a
       LEFT JOIN governance_checklist_log l
         ON l.activity_id = a.id AND l.process_id = ? AND l.period = ?
       WHERE a.active_status = 1
       ORDER BY FIELD(a.level,'analyst','tl','process_manager','branch_head'), a.activity_name`,
      [processId, period]
    );
    return (rows as RowDataPacket[]).map(r => {
      const pct = r.required_count > 0 ? Math.round((r.completed_count / r.required_count) * 100) : 0;
      return {
        activity_id: r.activity_id,
        activity_name: r.activity_name,
        level: r.level,
        frequency: r.frequency,
        required_count: r.required_count,
        completed_count: r.completed_count,
        completion_pct: pct,
        rag: pct >= 100 ? "green" as const : pct >= 70 ? "amber" as const : "red" as const,
      };
    });
  },

  async updateLog(input: UpdateGovernanceInput, userId: string): Promise<void> {
    await db.execute(
      `INSERT INTO governance_checklist_log (id, process_id, period, activity_id, completed_count, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE completed_count = VALUES(completed_count), updated_by = VALUES(updated_by)`,
      [randomUUID(), input.processId, input.period, input.activityId, input.completedCount, userId]
    );
  },
};
