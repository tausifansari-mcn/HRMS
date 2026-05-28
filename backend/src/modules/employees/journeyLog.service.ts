import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

export interface JourneyEvent {
  id: string;
  employee_id: string;
  event_type: string;
  event_date: string;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  module: string | null;
  triggered_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AppendEventInput {
  employeeId: string;
  eventType: string;
  eventDate: string;
  description?: string;
  oldValue?: string;
  newValue?: string;
  module?: string;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ListFilters {
  module?: string;
  eventType?: string;
  fromDate?: string;
  toDate?: string;
}

export async function appendJourneyEvent(input: AppendEventInput): Promise<JourneyEvent> {
  const id = randomUUID();
  await db.execute(
    `INSERT INTO employee_journey_log
       (id, employee_id, event_type, event_date, description,
        old_value, new_value, module, triggered_by, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.employeeId,
      input.eventType,
      input.eventDate,
      input.description ?? null,
      input.oldValue ?? null,
      input.newValue ?? null,
      input.module ?? null,
      input.triggeredBy ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );

  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM employee_journey_log WHERE id = ? LIMIT 1", [id]
  );
  return (rows as JourneyEvent[])[0];
}

export async function listJourneyEvents(
  employeeId: string,
  filters?: ListFilters
): Promise<JourneyEvent[]> {
  const conds: string[] = ["employee_id = ?"];
  const params: unknown[] = [employeeId];

  if (filters?.module)    { conds.push("module = ?");     params.push(filters.module); }
  if (filters?.eventType) { conds.push("event_type = ?"); params.push(filters.eventType); }
  if (filters?.fromDate)  { conds.push("event_date >= ?"); params.push(filters.fromDate); }
  if (filters?.toDate)    { conds.push("event_date <= ?"); params.push(filters.toDate); }

  const where = conds.join(" AND ");
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM employee_journey_log WHERE ${where} ORDER BY event_date DESC, created_at DESC`,
    params
  );
  return rows as JourneyEvent[];
}
