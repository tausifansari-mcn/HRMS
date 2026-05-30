import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

interface InboxFilters {
  user_id: string;
  type?: string;
  priority?: string;
  is_read?: string;
}

interface CreateInboxItem {
  user_id: string;
  type: string;
  title: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  priority?: string;
}

export const inboxService = {
  async listItems(filters: InboxFilters) {
    const conds: string[] = ["user_id = ?"];
    const params: unknown[] = [filters.user_id];

    if (filters.type)     { conds.push("type = ?");       params.push(filters.type); }
    if (filters.priority) { conds.push("priority = ?");   params.push(filters.priority); }
    if (filters.is_read !== undefined && filters.is_read !== "") {
      conds.push("is_read = ?");
      params.push(filters.is_read === "true" || filters.is_read === "1" ? 1 : 0);
    }

    const where = `WHERE ${conds.join(" AND ")}`;
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM work_inbox_item ${where} ORDER BY
         FIELD(priority,'urgent','high','normal','low'), created_at DESC
       LIMIT 200`,
      params
    );
    return rows as RowDataPacket[];
  },

  async getUnreadCount(userId: string): Promise<number> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM work_inbox_item WHERE user_id = ? AND is_read = 0",
      [userId]
    );
    return Number((rows as RowDataPacket[])[0]?.cnt ?? 0);
  },

  async markRead(id: string, userId: string) {
    const [result] = await db.execute(
      "UPDATE work_inbox_item SET is_read = 1 WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    return result;
  },

  async markActioned(id: string, userId: string) {
    const [result] = await db.execute(
      "UPDATE work_inbox_item SET is_actioned = 1, is_read = 1 WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    return result;
  },

  async markAllRead(userId: string) {
    const [result] = await db.execute(
      "UPDATE work_inbox_item SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [userId]
    );
    return result;
  },

  async createItem(data: CreateInboxItem) {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO work_inbox_item
         (id, user_id, type, title, description, entity_type, entity_id, action_url, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.user_id,
        data.type,
        data.title,
        data.description ?? null,
        data.entity_type ?? null,
        data.entity_id ?? null,
        data.action_url ?? null,
        data.priority ?? "normal",
      ]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM work_inbox_item WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0];
  },
};
