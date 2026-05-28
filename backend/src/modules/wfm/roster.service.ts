import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import type { WfmRosterPlan, WfmRosterAssignment } from "./wfm.types.js";

export interface CreatePlanInput {
  planName: string;
  processId?: string | null;
  branchId?: string | null;
  shiftId?: string | null;
  fromDate: string;
  toDate: string;
  requiredHeadcount?: number;
}

export interface AssignInput {
  employeeId: string;
  rosterDate: string;
  shiftId?: string | null;
  planId?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  branchName?: string | null;
  processName?: string | null;
  rosterStatus?: string;
}

export interface BulkAssignRow {
  employeeId: string;
  rosterDate: string;
  shiftId?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  branchName?: string | null;
  processName?: string | null;
}

export interface BulkAssignResult {
  assigned: number;
  failed: number;
  errors: string[];
}

export interface PlanListFilters {
  processId?: string;
  branchId?: string;
  planStatus?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AssignmentListFilters {
  planId?: string;
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
  publishStatus?: string;
  processName?: string;
}

export const rosterService = {
  async getPlan(id: string): Promise<WfmRosterPlan> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM wfm_roster_plan WHERE id = ? LIMIT 1", [id]
    );
    const rec = (rows as WfmRosterPlan[])[0];
    if (!rec) throw new Error("Plan not found");
    return rec;
  },

  async createPlan(input: CreatePlanInput, userId: string): Promise<WfmRosterPlan> {
    if (input.toDate < input.fromDate) throw new Error("toDate must be >= fromDate");

    const id = randomUUID();
    await db.execute(
      `INSERT INTO wfm_roster_plan
         (id, plan_name, process_id, branch_id, shift_id, from_date, to_date, required_headcount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.planName,
        input.processId ?? null,
        input.branchId ?? null,
        input.shiftId ?? null,
        input.fromDate,
        input.toDate,
        input.requiredHeadcount ?? 0,
        userId,
      ]
    );
    return this.getPlan(id);
  },

  async listPlans(filters: PlanListFilters): Promise<WfmRosterPlan[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.processId)  { conds.push("process_id = ?");   params.push(filters.processId); }
    if (filters.branchId)   { conds.push("branch_id = ?");    params.push(filters.branchId); }
    if (filters.planStatus) { conds.push("plan_status = ?");  params.push(filters.planStatus); }
    if (filters.fromDate)   { conds.push("to_date >= ?");     params.push(filters.fromDate); }
    if (filters.toDate)     { conds.push("from_date <= ?");   params.push(filters.toDate); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM wfm_roster_plan ${where} ORDER BY from_date DESC`,
      params
    );
    return rows as WfmRosterPlan[];
  },

  async assignEmployee(input: AssignInput, _userId: string): Promise<WfmRosterAssignment> {
    await db.execute(
      `INSERT INTO wfm_roster_assignment
         (id, employee_id, shift_id, plan_id, roster_date, roster_status,
          shift_start_time, shift_end_time, branch_name, process_name)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shift_id = VALUES(shift_id),
         shift_start_time = VALUES(shift_start_time),
         shift_end_time = VALUES(shift_end_time),
         roster_status = VALUES(roster_status)`,
      [
        input.employeeId,
        input.shiftId ?? null,
        input.planId ?? null,
        input.rosterDate,
        input.rosterStatus ?? "Rostered",
        input.shiftStartTime ?? null,
        input.shiftEndTime ?? null,
        input.branchName ?? null,
        input.processName ?? null,
      ]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM wfm_roster_assignment WHERE employee_id = ? AND roster_date = ? LIMIT 1",
      [input.employeeId, input.rosterDate]
    );
    return (rows as WfmRosterAssignment[])[0];
  },

  async bulkAssign(rows: BulkAssignRow[], planId: string, userId: string): Promise<BulkAssignResult> {
    let assigned = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await this.assignEmployee(
          {
            employeeId: row.employeeId,
            rosterDate: row.rosterDate,
            shiftId: row.shiftId ?? null,
            planId,
            shiftStartTime: row.shiftStartTime ?? null,
            shiftEndTime: row.shiftEndTime ?? null,
            branchName: row.branchName ?? null,
            processName: row.processName ?? null,
          },
          userId
        );
        assigned++;
      } catch (err) {
        failed++;
        errors.push(`${row.employeeId}/${row.rosterDate}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { assigned, failed, errors };
  },

  async publishPlan(planId: string, _userId: string): Promise<WfmRosterPlan> {
    await this.getPlan(planId); // throws if not found
    await db.execute(
      "UPDATE wfm_roster_plan SET plan_status = 'published' WHERE id = ?",
      [planId]
    );
    await db.execute(
      "UPDATE wfm_roster_assignment SET publish_status = 'published' WHERE plan_id = ?",
      [planId]
    );
    return this.getPlan(planId);
  },

  async listAssignments(filters: AssignmentListFilters): Promise<WfmRosterAssignment[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters.planId)        { conds.push("plan_id = ?");         params.push(filters.planId); }
    if (filters.employeeId)    { conds.push("employee_id = ?");     params.push(filters.employeeId); }
    if (filters.fromDate)      { conds.push("roster_date >= ?");    params.push(filters.fromDate); }
    if (filters.toDate)        { conds.push("roster_date <= ?");    params.push(filters.toDate); }
    if (filters.publishStatus) { conds.push("publish_status = ?");  params.push(filters.publishStatus); }
    if (filters.processName)   { conds.push("process_name = ?");    params.push(filters.processName); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM wfm_roster_assignment ${where} ORDER BY roster_date ASC, employee_id ASC`,
      params
    );
    return rows as WfmRosterAssignment[];
  },
};
