import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

interface TransferFilters {
  employee_id?: string;
  status?: string;
}

interface PromotionFilters {
  employee_id?: string;
  status?: string;
}

interface CreateTransfer {
  employee_id: string;
  transfer_type: string;
  from_value: string;
  to_value: string;
  effective_date: string;
  reason?: string;
  initiated_by: string;
}

interface CreatePromotion {
  employee_id: string;
  from_designation?: string;
  to_designation: string;
  from_grade?: string;
  to_grade?: string;
  effective_date: string;
  salary_revision?: number;
  reason?: string;
  initiated_by: string;
}

interface ApproveRejectData {
  action: "approved" | "rejected";
  remarks?: string;
  approved_by: string;
}

export const mobilityService = {
  // ── Transfers ────────────────────────────────────────────────────────────

  async listTransfers(filters: TransferFilters) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.employee_id) { conds.push("t.employee_id = ?"); params.push(filters.employee_id); }
    if (filters.status)      { conds.push("t.status = ?");      params.push(filters.status); }
    const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT t.*, e.full_name AS employee_name, e.employee_code
       FROM transfer_record t
       LEFT JOIN employees e ON e.id = t.employee_id
       ${where}
       ORDER BY t.created_at DESC LIMIT 200`,
      params
    );
    return rows as RowDataPacket[];
  },

  async createTransfer(data: CreateTransfer) {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO transfer_record
         (id, employee_id, transfer_type, from_value, to_value, effective_date, reason, initiated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.employee_id,
        data.transfer_type,
        data.from_value,
        data.to_value,
        data.effective_date,
        data.reason ?? null,
        data.initiated_by,
      ]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM transfer_record WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0];
  },

  async updateTransfer(id: string, data: ApproveRejectData) {
    await db.execute(
      `UPDATE transfer_record
       SET status = ?, approved_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.action, data.approved_by, id]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM transfer_record WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0] ?? null;
  },

  // ── Promotions ───────────────────────────────────────────────────────────

  async listPromotions(filters: PromotionFilters) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.employee_id) { conds.push("p.employee_id = ?"); params.push(filters.employee_id); }
    if (filters.status)      { conds.push("p.status = ?");      params.push(filters.status); }
    const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT p.*, e.full_name AS employee_name, e.employee_code
       FROM promotion_record p
       LEFT JOIN employees e ON e.id = p.employee_id
       ${where}
       ORDER BY p.created_at DESC LIMIT 200`,
      params
    );
    return rows as RowDataPacket[];
  },

  async createPromotion(data: CreatePromotion) {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO promotion_record
         (id, employee_id, from_designation, to_designation, from_grade, to_grade,
          effective_date, salary_revision, reason, initiated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.employee_id,
        data.from_designation ?? null,
        data.to_designation,
        data.from_grade ?? null,
        data.to_grade ?? null,
        data.effective_date,
        data.salary_revision ?? null,
        data.reason ?? null,
        data.initiated_by,
      ]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM promotion_record WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0];
  },

  async updatePromotion(id: string, data: ApproveRejectData) {
    await db.execute(
      `UPDATE promotion_record
       SET status = ?, approved_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.action, data.approved_by, id]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM promotion_record WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0] ?? null;
  },
};
