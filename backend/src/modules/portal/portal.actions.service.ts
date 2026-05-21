import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import type { ActionPlanItem } from "./portal.types.js";
import type { CreateActionPlanInput, UpdateActionPlanInput } from "./portal.validation.js";

export const portalActionsService = {
  async list(processId: string, metricId?: string, status?: string): Promise<ActionPlanItem[]> {
    let sql = `SELECT ap.*, m.metric_code, m.metric_name
               FROM action_plan ap
               JOIN kpi_metric_master m ON m.id = ap.metric_id
               WHERE ap.process_id = ?`;
    const params: unknown[] = [processId];
    if (metricId) { sql += " AND ap.metric_id = ?"; params.push(metricId); }
    if (status)   { sql += " AND ap.status = ?"; params.push(status); }
    sql += " ORDER BY ap.due_date ASC";

    const [rows] = await db.execute<RowDataPacket[]>(sql, params);
    return (rows as RowDataPacket[]).map(r => ({
      id: r.id,
      process_id: r.process_id,
      metric_id: r.metric_id,
      metric_code: r.metric_code,
      metric_name: r.metric_name,
      action_text: r.action_text,
      owner_level: r.owner_level,
      owner_name: r.owner_name,
      due_date: r.due_date,
      status: r.status,
    }));
  },

  async create(input: CreateActionPlanInput, userId: string): Promise<ActionPlanItem> {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO action_plan (id, process_id, metric_id, action_text, owner_level, owner_name, due_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.processId, input.metricId, input.actionText, input.ownerLevel, input.ownerName, input.dueDate, input.status, userId]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT ap.*, m.metric_code, m.metric_name FROM action_plan ap
       JOIN kpi_metric_master m ON m.id = ap.metric_id WHERE ap.id = ?`,
      [id]
    );
    const r = (rows as RowDataPacket[])[0];
    if (!r) throw new Error("Failed to fetch created action plan");
    return {
      id: r.id, process_id: r.process_id, metric_id: r.metric_id,
      metric_code: r.metric_code, metric_name: r.metric_name,
      action_text: r.action_text, owner_level: r.owner_level,
      owner_name: r.owner_name, due_date: r.due_date, status: r.status,
    };
  },

  async update(id: string, input: UpdateActionPlanInput): Promise<void> {
    const FIELD_MAP: Record<string, string> = {
      actionText: "action_text",
      ownerLevel: "owner_level",
      ownerName: "owner_name",
      dueDate: "due_date",
      status: "status",
    };
    const entries = Object.entries(input).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;
    const setClauses = entries.map(([k]) => {
      const col = FIELD_MAP[k];
      if (!col) throw new Error(`Unknown field: ${k}`);
      return `${col} = ?`;
    }).join(", ");
    const values = entries.map(([, v]) => v);
    await db.execute(`UPDATE action_plan SET ${setClauses} WHERE id = ?`, [...values, id]);
  },
};
