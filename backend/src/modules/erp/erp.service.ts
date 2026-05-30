import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

// ─── Vendors ────────────────────────────────────────────────────────────────

export const vendorService = {
  async list(filters: { is_active?: string; vendor_type?: string }) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.is_active !== undefined) { conds.push("is_active = ?"); params.push(filters.is_active); }
    if (filters.vendor_type)             { conds.push("vendor_type = ?"); params.push(filters.vendor_type); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM vendor_master ${where} ORDER BY vendor_name`,
      params
    );
    return rows as RowDataPacket[];
  },

  async getById(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM vendor_master WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0] ?? null;
  },

  async create(data: Record<string, unknown>) {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO vendor_master
         (id, vendor_code, vendor_name, vendor_type, contact_name, contact_email,
          contact_phone, address, gst_number, pan_number, payment_terms, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.vendor_code,
        data.vendor_name,
        data.vendor_type ?? "supplier",
        data.contact_name ?? null,
        data.contact_email ?? null,
        data.contact_phone ?? null,
        data.address ?? null,
        data.gst_number ?? null,
        data.pan_number ?? null,
        data.payment_terms ?? null,
        data.is_active !== undefined ? data.is_active : 1,
      ]
    );
    return this.getById(id);
  },

  async update(id: string, data: Record<string, unknown>) {
    await db.execute(
      `UPDATE vendor_master SET
         vendor_name    = COALESCE(?, vendor_name),
         vendor_type    = COALESCE(?, vendor_type),
         contact_name   = COALESCE(?, contact_name),
         contact_email  = COALESCE(?, contact_email),
         contact_phone  = COALESCE(?, contact_phone),
         address        = COALESCE(?, address),
         gst_number     = COALESCE(?, gst_number),
         pan_number     = COALESCE(?, pan_number),
         payment_terms  = COALESCE(?, payment_terms),
         is_active      = COALESCE(?, is_active),
         updated_at     = NOW()
       WHERE id = ?`,
      [
        data.vendor_name ?? null,
        data.vendor_type ?? null,
        data.contact_name ?? null,
        data.contact_email ?? null,
        data.contact_phone ?? null,
        data.address ?? null,
        data.gst_number ?? null,
        data.pan_number ?? null,
        data.payment_terms ?? null,
        data.is_active ?? null,
        id,
      ]
    );
    return this.getById(id);
  },
};

// ─── Contracts ──────────────────────────────────────────────────────────────

export const contractService = {
  async list(filters: { status?: string; vendor_id?: string }) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.status)    { conds.push("c.status = ?");    params.push(filters.status); }
    if (filters.vendor_id) { conds.push("c.vendor_id = ?"); params.push(filters.vendor_id); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.*, v.vendor_name
       FROM contract_master c
       LEFT JOIN vendor_master v ON v.id = c.vendor_id
       ${where}
       ORDER BY c.start_date DESC`,
      params
    );
    return rows as RowDataPacket[];
  },

  async getById(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT c.*, v.vendor_name
       FROM contract_master c
       LEFT JOIN vendor_master v ON v.id = c.vendor_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    return (rows as RowDataPacket[])[0] ?? null;
  },

  async create(data: Record<string, unknown>, createdBy: string) {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO contract_master
         (id, contract_code, title, vendor_id, client_id, contract_type,
          start_date, end_date, value, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.contract_code,
        data.title,
        data.vendor_id ?? null,
        data.client_id ?? null,
        data.contract_type ?? "sow",
        data.start_date,
        data.end_date ?? null,
        data.value ?? null,
        data.status ?? "draft",
        data.notes ?? null,
        createdBy,
      ]
    );
    return this.getById(id);
  },

  async updateStatus(id: string, status: string, notes?: string) {
    await db.execute(
      "UPDATE contract_master SET status = ?, notes = COALESCE(?, notes), updated_at = NOW() WHERE id = ?",
      [status, notes ?? null, id]
    );
    return this.getById(id);
  },
};

// ─── Expenses ────────────────────────────────────────────────────────────────

export const expenseService = {
  async list(filters: { employee_id?: string; status?: string }) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.employee_id) { conds.push("e.employee_id = ?"); params.push(filters.employee_id); }
    if (filters.status)      { conds.push("e.status = ?");      params.push(filters.status); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT e.*,
              CONCAT(emp.first_name, ' ', emp.last_name) AS employee_name,
              emp.employee_code
       FROM expense_claim e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       ${where}
       ORDER BY e.expense_date DESC`,
      params
    );
    return rows as RowDataPacket[];
  },

  async getById(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT e.*,
              CONCAT(emp.first_name, ' ', emp.last_name) AS employee_name
       FROM expense_claim e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.id = ? LIMIT 1`,
      [id]
    );
    return (rows as RowDataPacket[])[0] ?? null;
  },

  async create(data: Record<string, unknown>, employeeId: string) {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO expense_claim
         (id, employee_id, expense_date, category, amount, currency,
          description, receipt_ref, project_code, cost_centre_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        id,
        employeeId,
        data.expense_date,
        data.category ?? "other",
        data.amount,
        data.currency ?? "INR",
        data.description ?? null,
        data.receipt_ref ?? null,
        data.project_code ?? null,
        data.cost_centre_id ?? null,
      ]
    );
    return this.getById(id);
  },

  async review(id: string, action: "approved" | "rejected", reviewedBy: string, remarks?: string) {
    const status = action === "approved" ? "approved" : "rejected";
    await db.execute(
      `UPDATE expense_claim
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(),
           remarks = COALESCE(?, remarks), updated_at = NOW()
       WHERE id = ?`,
      [status, reviewedBy, remarks ?? null, id]
    );
    return this.getById(id);
  },
};

// ─── Procurement ─────────────────────────────────────────────────────────────

export const procurementService = {
  async list(filters: { requested_by?: string; status?: string; department_id?: string }) {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.requested_by)  { conds.push("p.requested_by = ?");  params.push(filters.requested_by); }
    if (filters.status)        { conds.push("p.status = ?");        params.push(filters.status); }
    if (filters.department_id) { conds.push("p.department_id = ?"); params.push(filters.department_id); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT p.*,
              CONCAT(emp.first_name, ' ', emp.last_name) AS requester_name,
              v.vendor_name,
              d.department_name
       FROM procurement_request p
       LEFT JOIN employees emp ON emp.id = p.requested_by
       LEFT JOIN vendor_master v ON v.id = p.vendor_id
       LEFT JOIN department_master d ON d.id = p.department_id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    return rows as RowDataPacket[];
  },

  async getById(id: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM procurement_request WHERE id = ? LIMIT 1",
      [id]
    );
    return (rows as RowDataPacket[])[0] ?? null;
  },

  async create(data: Record<string, unknown>, requestedBy: string) {
    const id = randomUUID();
    const req_code = `PR-${Date.now()}`;
    await db.execute(
      `INSERT INTO procurement_request
         (id, req_code, requested_by, item_name, quantity, estimated_cost,
          vendor_id, department_id, required_by, justification, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        id,
        req_code,
        requestedBy,
        data.item_name,
        data.quantity ?? 1,
        data.estimated_cost ?? null,
        data.vendor_id ?? null,
        data.department_id ?? null,
        data.required_by ?? null,
        data.justification ?? null,
      ]
    );
    return this.getById(id);
  },

  async approve(id: string, action: "approved" | "rejected", approvedBy: string, remarks?: string) {
    const status = action === "approved" ? "approved" : "rejected";
    await db.execute(
      `UPDATE procurement_request
       SET status = ?, approved_by = ?, approved_at = NOW(),
           remarks = COALESCE(?, remarks), updated_at = NOW()
       WHERE id = ?`,
      [status, approvedBy, remarks ?? null, id]
    );
    return this.getById(id);
  },
};
