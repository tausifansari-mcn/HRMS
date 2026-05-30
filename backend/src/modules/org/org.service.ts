import { randomUUID } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "../../db/mysql.js";

// ── Generic list/get helpers ──────────────────────────────────────────────────

async function listActive(table: string, orderCol = "created_at"): Promise<RowDataPacket[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM ${table} WHERE active_status = 1 ORDER BY ${orderCol}`
  );
  return rows as RowDataPacket[];
}

async function getById(table: string, id: string): Promise<RowDataPacket | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
    [id]
  );
  return (rows as RowDataPacket[])[0] ?? null;
}

async function softDelete(table: string, id: string): Promise<void> {
  await db.execute(`UPDATE ${table} SET active_status = 0 WHERE id = ?`, [id]);
}

// ── Branch ────────────────────────────────────────────────────────────────────

export const branchService = {
  list: () => listActive("branch_master", "branch_name"),
  getById: (id: string) => getById("branch_master", id),
  async create(data: { branch_code: string; branch_name: string; city?: string; state?: string }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO branch_master (id, branch_code, branch_name, city, state) VALUES (?, ?, ?, ?, ?)",
      [id, data.branch_code, data.branch_name, data.city ?? null, data.state ?? null]
    );
    return getById("branch_master", id);
  },
  async update(id: string, data: { branch_name?: string; city?: string; state?: string }) {
    await db.execute(
      "UPDATE branch_master SET branch_name = COALESCE(?, branch_name), city = COALESCE(?, city), state = COALESCE(?, state), updated_at = NOW() WHERE id = ?",
      [data.branch_name ?? null, data.city ?? null, data.state ?? null, id]
    );
    return getById("branch_master", id);
  },
  delete: (id: string) => softDelete("branch_master", id),
};

// ── Department ────────────────────────────────────────────────────────────────

export const departmentService = {
  list: () => listActive("department_master", "dept_name"),
  getById: (id: string) => getById("department_master", id),
  async create(data: { dept_code: string; dept_name: string; branch_id?: string }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO department_master (id, dept_code, dept_name, branch_id) VALUES (?, ?, ?, ?)",
      [id, data.dept_code, data.dept_name, data.branch_id ?? null]
    );
    return getById("department_master", id);
  },
  async update(id: string, data: { dept_name?: string; branch_id?: string }) {
    await db.execute(
      "UPDATE department_master SET dept_name = COALESCE(?, dept_name), branch_id = COALESCE(?, branch_id), updated_at = NOW() WHERE id = ?",
      [data.dept_name ?? null, data.branch_id ?? null, id]
    );
    return getById("department_master", id);
  },
  delete: (id: string) => softDelete("department_master", id),
};

// ── LOB ───────────────────────────────────────────────────────────────────────

export const lobService = {
  list: () => listActive("lob_master", "lob_name"),
  getById: (id: string) => getById("lob_master", id),
  async create(data: { lob_code: string; lob_name: string }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO lob_master (id, lob_code, lob_name) VALUES (?, ?, ?)",
      [id, data.lob_code, data.lob_name]
    );
    return getById("lob_master", id);
  },
  async update(id: string, data: { lob_name?: string }) {
    await db.execute(
      "UPDATE lob_master SET lob_name = COALESCE(?, lob_name), updated_at = NOW() WHERE id = ?",
      [data.lob_name ?? null, id]
    );
    return getById("lob_master", id);
  },
  delete: (id: string) => softDelete("lob_master", id),
};

// ── Designation ───────────────────────────────────────────────────────────────

export const designationService = {
  list: () => listActive("designation_master", "designation_name"),
  getById: (id: string) => getById("designation_master", id),
  async create(data: { designation_code: string; designation_name: string; grade?: string; grade_id?: string }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO designation_master (id, designation_code, designation_name, grade, grade_id) VALUES (?, ?, ?, ?, ?)",
      [id, data.designation_code, data.designation_name, data.grade ?? null, data.grade_id ?? null]
    );
    return getById("designation_master", id);
  },
  async update(id: string, data: { designation_name?: string; grade?: string; grade_id?: string }) {
    await db.execute(
      "UPDATE designation_master SET designation_name = COALESCE(?, designation_name), grade = COALESCE(?, grade), grade_id = COALESCE(?, grade_id), updated_at = NOW() WHERE id = ?",
      [data.designation_name ?? null, data.grade ?? null, data.grade_id ?? null, id]
    );
    return getById("designation_master", id);
  },
  delete: (id: string) => softDelete("designation_master", id),
};

// ── Campaign ─────────────────────────────────────────────────────────────────

export const campaignService = {
  list: () => listActive("campaign_master", "campaign_name"),
  getById: (id: string) => getById("campaign_master", id),
  async create(data: { campaign_code: string; campaign_name: string; process_id?: string; lob_id?: string }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO campaign_master (id, campaign_code, campaign_name, process_id, lob_id) VALUES (?, ?, ?, ?, ?)",
      [id, data.campaign_code, data.campaign_name, data.process_id ?? null, data.lob_id ?? null]
    );
    return getById("campaign_master", id);
  },
  async update(id: string, data: { campaign_name?: string; process_id?: string; lob_id?: string }) {
    await db.execute(
      "UPDATE campaign_master SET campaign_name = COALESCE(?, campaign_name), process_id = COALESCE(?, process_id), lob_id = COALESCE(?, lob_id), updated_at = NOW() WHERE id = ?",
      [data.campaign_name ?? null, data.process_id ?? null, data.lob_id ?? null, id]
    );
    return getById("campaign_master", id);
  },
  delete: (id: string) => softDelete("campaign_master", id),
};

// ── Cost Centre ───────────────────────────────────────────────────────────────

export const costCentreService = {
  list: () => listActive("cost_centre_master", "cost_centre_name"),
  getById: (id: string) => getById("cost_centre_master", id),
  async create(data: { cost_centre_code: string; cost_centre_name: string; branch_id?: string; department_id?: string }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO cost_centre_master (id, cost_centre_code, cost_centre_name, branch_id, department_id) VALUES (?, ?, ?, ?, ?)",
      [id, data.cost_centre_code, data.cost_centre_name, data.branch_id ?? null, data.department_id ?? null]
    );
    return getById("cost_centre_master", id);
  },
  async update(id: string, data: { cost_centre_name?: string; branch_id?: string; department_id?: string }) {
    await db.execute(
      "UPDATE cost_centre_master SET cost_centre_name = COALESCE(?, cost_centre_name), branch_id = COALESCE(?, branch_id), department_id = COALESCE(?, department_id), updated_at = NOW() WHERE id = ?",
      [data.cost_centre_name ?? null, data.branch_id ?? null, data.department_id ?? null, id]
    );
    return getById("cost_centre_master", id);
  },
  delete: (id: string) => softDelete("cost_centre_master", id),
};

// ── Grade / Band ──────────────────────────────────────────────────────────────

export const gradeBandService = {
  list: () => listActive("grade_band_master", "grade_code"),
  getById: (id: string) => getById("grade_band_master", id),
  async create(data: { grade_code: string; grade_name: string; band?: string; min_ctc?: number; max_ctc?: number }) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO grade_band_master (id, grade_code, grade_name, band, min_ctc, max_ctc) VALUES (?, ?, ?, ?, ?, ?)",
      [id, data.grade_code, data.grade_name, data.band ?? null, data.min_ctc ?? null, data.max_ctc ?? null]
    );
    return getById("grade_band_master", id);
  },
  async update(id: string, data: { grade_name?: string; band?: string; min_ctc?: number; max_ctc?: number }) {
    await db.execute(
      "UPDATE grade_band_master SET grade_name = COALESCE(?, grade_name), band = COALESCE(?, band), min_ctc = COALESCE(?, min_ctc), max_ctc = COALESCE(?, max_ctc), updated_at = NOW() WHERE id = ?",
      [data.grade_name ?? null, data.band ?? null, data.min_ctc ?? null, data.max_ctc ?? null, id]
    );
    return getById("grade_band_master", id);
  },
  delete: (id: string) => softDelete("grade_band_master", id),
};

// ── Location ──────────────────────────────────────────────────────────────────

export const locationService = {
  list: () => listActive("location_master", "location_name"),
  getById: (id: string) => getById("location_master", id),
  async create(data: Record<string, unknown>) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO location_master (id, location_name, location_code, address, city, state, pincode, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, data.location_name, data.location_code ?? null, data.address ?? null, data.city ?? null, data.state ?? null, data.pincode ?? null, data.branch_id ?? null]
    );
    return getById("location_master", id);
  },
  async update(id: string, data: Record<string, unknown>) {
    await db.execute(
      "UPDATE location_master SET location_name = COALESCE(?, location_name), city = COALESCE(?, city), state = COALESCE(?, state), updated_at = NOW() WHERE id = ?",
      [data.location_name ?? null, data.city ?? null, data.state ?? null, id]
    );
    return getById("location_master", id);
  },
  delete: (id: string) => softDelete("location_master", id),
};

// ── Policy ────────────────────────────────────────────────────────────────────

export const policyService = {
  list: () => listActive("policy_master", "policy_name"),
  getById: (id: string) => getById("policy_master", id),
  async create(data: Record<string, unknown>) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO policy_master (id, policy_name, policy_code, description, effective_date, version) VALUES (?, ?, ?, ?, ?, ?)",
      [id, data.policy_name, data.policy_code ?? null, data.description ?? null, data.effective_date ?? null, data.version ?? null]
    );
    return getById("policy_master", id);
  },
  async update(id: string, data: Record<string, unknown>) {
    await db.execute(
      "UPDATE policy_master SET policy_name = COALESCE(?, policy_name), policy_code = COALESCE(?, policy_code), description = COALESCE(?, description), effective_date = COALESCE(?, effective_date), version = COALESCE(?, version), updated_at = NOW() WHERE id = ?",
      [data.policy_name ?? null, data.policy_code ?? null, data.description ?? null, data.effective_date ?? null, data.version ?? null, id]
    );
    return getById("policy_master", id);
  },
  delete: (id: string) => softDelete("policy_master", id),
};
