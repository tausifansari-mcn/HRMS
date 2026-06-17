import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { getEffectiveConfig } from "../customization/customization-engine.js";
import type {
  LeaveBalanceLedger,
  LeaveHoliday,
  LeaveRequest,
  LeaveType,
  PaginatedResult,
} from "./leave.types.js";
import type {
  CreateHolidayInput,
  CreateLeaveTypeInput,
  LeaveRequestFilters,
  LeaveRequestInput,
  ReviewLeaveInput,
} from "./leave.validation.js";
import { leavePolicyService } from "./leave-policy.service.js";

export const leaveService = {
  async listLeaveTypes(employeeId?: string): Promise<LeaveType[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM leave_type_master WHERE active_status = 1 ORDER BY leave_name ASC"
    );
    const seen = new Set<string>();
    const types = (rows as LeaveType[]).filter((type) => {
      const normalized = String(type.leave_name ?? "").trim().toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    // Apply customizations if employeeId provided
    if (employeeId) {
      for (const type of types) {
        try {
          const result = await getEffectiveConfig(employeeId, 'leave_type', type.id, type);
          Object.assign(type, result.config);
        } catch (err) {
          // Skip customization on error
          console.warn(`Customization error for leave type ${type.id}:`, err);
        }
      }
    }

    return types;
  },

  async createLeaveType(input: CreateLeaveTypeInput): Promise<LeaveType> {
    const [dup] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM leave_type_master WHERE leave_code = ? LIMIT 1", [input.leaveCode]
    );
    if ((dup as RowDataPacket[]).length > 0) throw new Error("Leave code already exists");

    const id = randomUUID();
    await db.execute(
      `INSERT INTO leave_type_master (id, leave_code, leave_name, max_days_per_year, carry_forward, requires_approval, paid_leave)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.leaveCode, input.leaveName, input.maxDaysPerYear,
       input.carryForward ? 1 : 0, input.requiresApproval ? 1 : 0, input.paidLeave ? 1 : 0]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM leave_type_master WHERE id = ? LIMIT 1", [id]
    );
    return (rows as LeaveType[])[0];
  },

  async submitRequest(input: LeaveRequestInput): Promise<LeaveRequest> {
    // --- Step 3: Policy validation ---

    // 1. Look up leave_code for the given leaveTypeId
    const [ltRows] = await db.execute<RowDataPacket[]>(
      "SELECT leave_code FROM leave_type_master WHERE id = ? LIMIT 1",
      [input.leaveTypeId]
    );
    const leaveCode: string | undefined = (ltRows as RowDataPacket[])[0]?.leave_code;

    if (!leaveCode) {
      throw new Error(`Leave type not found: ${input.leaveTypeId}`);
    }

    let initialStatus = "pending";

    if (leaveCode === "CL" || leaveCode === "ML") {
      // a. Check for EL in the same month
      const elConflict = await leavePolicyService.checkELInSameMonth(
        input.employeeId,
        input.fromDate,
        input.toDate
      );
      if (elConflict.hasConflict) {
        throw new Error(
          `CL/ML cannot be taken in a month where EL is already applied. Conflict in month: ${elConflict.conflictMonth}`
        );
      }

      // b. Check monthly cap (2 days for CL/ML)
      const capResult = await leavePolicyService.checkMonthlyCapExceeded(
        input.employeeId,
        input.fromDate,
        input.toDate,
        input.totalDays
      );
      if (capResult.exceeded) {
        throw new Error(
          `Monthly leave cap of 2 days reached for ${capResult.monthBreached}. Please apply excess days as Earned Leave.`
        );
      }
    } else if (leaveCode === "EL") {
      // a. EL must be at least 1 day
      if (input.totalDays < 1) {
        throw new Error("EL must be at least 1 day");
      }

      // b. Check for CL/ML in the same month
      const clmlConflict = await leavePolicyService.checkCLMLInSameMonth(
        input.employeeId,
        input.fromDate,
        input.toDate
      );
      if (clmlConflict.hasConflict) {
        throw new Error(
          `CL/ML and EL cannot be taken in the same calendar month. Conflict in month: ${clmlConflict.conflictMonth}`
        );
      }

      // c & d. Determine year and check if branch head approval is required
      const year = new Date(input.fromDate).getFullYear();
      const needsBranchHead = await leavePolicyService.requiresBranchHeadApproval(
        input.employeeId,
        input.totalDays,
        year
      );
      if (needsBranchHead) {
        initialStatus = "pending_branch_head";
      }
    }
    // All other leave types: initialStatus remains 'pending'

    const id = randomUUID();
    await db.execute(
      `INSERT INTO leave_request (id, employee_id, leave_type_id, from_date, to_date, total_days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.employeeId, input.leaveTypeId, input.fromDate, input.toDate,
       input.totalDays, input.reason ?? null, initialStatus]
    );
    return this.getRequest(id);
  },

  async getRequest(id: string): Promise<LeaveRequest> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM leave_request WHERE id = ? LIMIT 1", [id]
    );
    const rec = (rows as LeaveRequest[])[0];
    if (!rec) throw new Error("Leave request not found");
    return rec;
  },

  async reviewRequest(id: string, input: ReviewLeaveInput, reviewerId: string): Promise<LeaveRequest> {
    const request = await this.getRequest(id);

    // --- Step 4: Branch head approval path ---

    // Helper: deduct leave balance within a connection (for transaction safety)
    const deductLeaveBalance = async (conn: any) => {
      if (!request.leave_type_id) throw new Error("Leave type is required for approval");

      const duration = request.total_days;
      const employeeId = request.employee_id;
      const year = new Date(request.from_date).getFullYear();

      // Get leave code for the request
      const [ltRows] = await conn.execute(
        "SELECT leave_code FROM leave_type_master WHERE id = ? LIMIT 1",
        [request.leave_type_id]
      );
      const leaveCode: string = (ltRows as any[])[0]?.leave_code;
      if (!leaveCode) throw new Error("Leave type not found");

      if (leaveCode === 'CL' || leaveCode === 'ML') {
        // CL+ML combined pool: check total available across both types
        const [poolRows] = await conn.execute(
          `SELECT lt.leave_code,
                  COALESCE(lbl.allocated_days, 0) + COALESCE(lbl.adjusted_days, 0) - COALESCE(lbl.used_days, 0) AS available
           FROM leave_type_master lt
           LEFT JOIN leave_balance_ledger lbl
             ON lbl.leave_type_id = lt.id AND lbl.employee_id = ? AND lbl.balance_year = ?
           WHERE lt.leave_code IN ('CL', 'ML') AND lt.active_status = 1`,
          [employeeId, year]
        );

        const pool: Record<string, number> = {};
        for (const r of poolRows as any[]) pool[r.leave_code] = Number(r.available ?? 0);
        const totalAvailable = (pool['CL'] ?? 0) + (pool['ML'] ?? 0);

        if (duration > totalAvailable) {
          throw new Error(`Insufficient leave balance. Available (CL+ML): ${totalAvailable.toFixed(3)}, Requested: ${duration}`);
        }

        // Deduct: CL first, remainder from ML
        let remaining = duration;
        const clAvailable = pool['CL'] ?? 0;

        if (clAvailable >= remaining) {
          // All from CL
          await conn.execute(
            `INSERT INTO leave_balance_ledger (id, employee_id, leave_type_id, balance_year, allocated_days, used_days, adjusted_days)
             VALUES (UUID(), ?, (SELECT id FROM leave_type_master WHERE leave_code='CL' LIMIT 1), ?, 0, ?, 0)
             ON DUPLICATE KEY UPDATE used_days = used_days + ?`,
            [employeeId, year, remaining, remaining]
          );
        } else {
          // Some from CL, rest from ML
          const fromML = remaining - clAvailable;
          if (clAvailable > 0) {
            await conn.execute(
              `INSERT INTO leave_balance_ledger (id, employee_id, leave_type_id, balance_year, allocated_days, used_days, adjusted_days)
               VALUES (UUID(), ?, (SELECT id FROM leave_type_master WHERE leave_code='CL' LIMIT 1), ?, 0, ?, 0)
               ON DUPLICATE KEY UPDATE used_days = used_days + ?`,
              [employeeId, year, clAvailable, clAvailable]
            );
          }
          await conn.execute(
            `INSERT INTO leave_balance_ledger (id, employee_id, leave_type_id, balance_year, allocated_days, used_days, adjusted_days)
             VALUES (UUID(), ?, (SELECT id FROM leave_type_master WHERE leave_code='ML' LIMIT 1), ?, 0, ?, 0)
             ON DUPLICATE KEY UPDATE used_days = used_days + ?`,
            [employeeId, year, fromML, fromML]
          );
        }

      } else {
        // All other types (EL, LWP, PTRL, MTRL): single-type balance check from leave_balance_ledger only
        const [balanceRows] = await conn.execute(
          `SELECT allocated_days, used_days, adjusted_days
           FROM leave_balance_ledger
           WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ?`,
          [employeeId, request.leave_type_id, year]
        );

        if ((balanceRows as any[]).length === 0) {
          if (leaveCode === 'LWP') {
            // LWP has no balance row — always allowed, just track usage
            await conn.execute(
              `INSERT INTO leave_balance_ledger (id, employee_id, leave_type_id, balance_year, allocated_days, used_days, adjusted_days)
               VALUES (UUID(), ?, ?, ?, 0, ?, 0)`,
              [employeeId, request.leave_type_id, year, duration]
            );
          } else {
            throw new Error(`No leave balance found for ${leaveCode} in ${year}. Please contact HR.`);
          }
        } else {
          const balance = (balanceRows as any[])[0];
          const available = Number(balance.allocated_days) + Number(balance.adjusted_days) - Number(balance.used_days);
          if (duration > available) {
            throw new Error(`Insufficient ${leaveCode} balance. Available: ${available.toFixed(2)}, Requested: ${duration}`);
          }
          await conn.execute(
            `UPDATE leave_balance_ledger SET used_days = used_days + ?
             WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ?`,
            [duration, employeeId, request.leave_type_id, year]
          );
        }
      }
    };

    if (input.status === "branch_head_approved") {
      if (request.status !== "pending_branch_head") {
        throw new Error("Only pending_branch_head requests can be branch-head approved");
      }
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await deductLeaveBalance(conn);
        await conn.execute(
          "UPDATE leave_request SET status = ? WHERE id = ?",
          ["approved", id]
        );
        await conn.execute(
          `INSERT INTO leave_approval_log (id, leave_request_id, action, action_by, remarks)
           VALUES (UUID(), ?, ?, ?, ?)`,
          [id, "branch_head_approved", reviewerId, input.remarks ?? null]
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      return this.getRequest(id);
    }

    if (input.status === "branch_head_rejected") {
      if (request.status !== "pending_branch_head") {
        throw new Error("Only pending_branch_head requests can be branch-head rejected");
      }
      await db.execute(
        "UPDATE leave_request SET status = ? WHERE id = ?",
        ["rejected", id]
      );
      await db.execute(
        `INSERT INTO leave_approval_log (id, leave_request_id, action, action_by, remarks)
         VALUES (UUID(), ?, ?, ?, ?)`,
        [id, "branch_head_rejected", reviewerId, input.remarks ?? null]
      );
      return this.getRequest(id);
    }

    // Guard: standard 'approved' action cannot be used on pending_branch_head requests
    if (input.status === "approved" && request.status === "pending_branch_head") {
      throw new Error(
        "This leave requires branch head approval before it can be approved"
      );
    }

    // Handle approval - deduct leave balance inside a transaction
    if (input.status === 'approved') {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await deductLeaveBalance(conn);
        await conn.execute(
          "UPDATE leave_request SET status = ? WHERE id = ?",
          [input.status, id]
        );
        await conn.execute(
          `INSERT INTO leave_approval_log (id, leave_request_id, action, action_by, remarks)
           VALUES (UUID(), ?, ?, ?, ?)`,
          [id, input.status, reviewerId, input.remarks ?? null]
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      return this.getRequest(id);
    }

    // Restore leave balance when an approved request is rejected — also transactional
    if (input.status === 'rejected' && request.status === 'approved') {
      const duration = request.total_days;
      const employeeId = request.employee_id;
      const leaveTypeId = request.leave_type_id;
      if (leaveTypeId && duration > 0) {
        const year = new Date(request.from_date).getFullYear();
        const conn = await db.getConnection();
        try {
          await conn.beginTransaction();
          await conn.execute(
            `UPDATE leave_balance_ledger
             SET used_days = GREATEST(0, used_days - ?)
             WHERE employee_id = ? AND leave_type_id = ? AND balance_year = ?`,
            [duration, employeeId, leaveTypeId, year]
          );
          await conn.execute(
            "UPDATE leave_request SET status = ? WHERE id = ?",
            [input.status, id]
          );
          await conn.execute(
            `INSERT INTO leave_approval_log (id, leave_request_id, action, action_by, remarks)
             VALUES (UUID(), ?, ?, ?, ?)`,
            [id, input.status, reviewerId, input.remarks ?? null]
          );
          await conn.commit();
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
        return this.getRequest(id);
      }
    }

    await db.execute(
      "UPDATE leave_request SET status = ? WHERE id = ?",
      [input.status, id]
    );
    await db.execute(
      `INSERT INTO leave_approval_log (id, leave_request_id, action, action_by, remarks)
       VALUES (UUID(), ?, ?, ?, ?)`,
      [id, input.status, reviewerId, input.remarks ?? null]
    );
    return this.getRequest(id);
  },

  async listRequests(filters: LeaveRequestFilters): Promise<PaginatedResult<LeaveRequest>> {
    const { page, limit, employeeId, leaveTypeId, status, fromDate, toDate, activeOn, year } = filters;
    const offset = (page - 1) * limit;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (employeeId)  { conds.push("lr.employee_id = ?");   params.push(employeeId); }
    if (leaveTypeId) { conds.push("lr.leave_type_id = ?"); params.push(leaveTypeId); }
    if (status)      { conds.push("lr.status = ?");        params.push(status); }
    if (fromDate)    { conds.push("lr.from_date >= ?");    params.push(fromDate); }
    if (toDate)      { conds.push("lr.to_date <= ?");      params.push(toDate); }
    if (activeOn)    { conds.push("lr.from_date <= ?");    params.push(activeOn);
                       conds.push("lr.to_date >= ?");      params.push(activeOn); }
    if (year)        { conds.push("YEAR(lr.from_date) = ?"); params.push(year); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT lr.*,
         CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS employee_name,
         e.first_name, e.last_name,
         e.avatar_url,
         dept.dept_name AS department_name,
         lt.leave_name  AS leave_type_name,
         CONCAT(rev.first_name, ' ', COALESCE(rev.last_name, '')) AS reviewer_name
       FROM leave_request lr
       LEFT JOIN employees e    ON e.id = lr.employee_id
       LEFT JOIN department_master dept ON dept.id = e.department_id
       LEFT JOIN leave_type_master lt   ON lt.id = lr.leave_type_id
       LEFT JOIN leave_approval_log approval ON approval.id = (
         SELECT latest.id
         FROM leave_approval_log latest
         WHERE latest.leave_request_id = lr.id
         ORDER BY latest.action_at DESC
         LIMIT 1
       )
       LEFT JOIN employees rev ON rev.user_id = approval.action_by
       ${where}
       ORDER BY lr.applied_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [countRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM leave_request lr ${where}`, params
    );
    return { data: rows as LeaveRequest[], total: (countRows as any)[0]?.total ?? 0, page, limit };
  },

  async getBalance(employeeId: string, year: number): Promise<any[]> {
    // Fetch balance rows — do NOT auto-seed here; balances are seeded by migrations and annual worker
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT lbl.id, lbl.employee_id, lbl.leave_type_id, lbl.balance_year,
              lbl.allocated_days, lbl.used_days, lbl.adjusted_days,
              (lbl.allocated_days + COALESCE(lbl.adjusted_days,0) - lbl.used_days) AS available_days,
              lt.leave_name, lt.leave_code, lt.paid_leave, lt.carry_forward, lt.max_days_per_year
       FROM leave_balance_ledger lbl
       JOIN leave_type_master lt ON lt.id = lbl.leave_type_id
       WHERE lbl.employee_id = ? AND lbl.balance_year = ? AND lt.active_status = 1
       ORDER BY lt.leave_name ASC`,
      [employeeId, year]
    );

    // Attach EL accrual (current year's accumulation — not yet spendable) as a separate field on the EL row
    const [accrualRows] = await db.execute<RowDataPacket[]>(
      `SELECT accrued_days, last_credited_month
       FROM leave_el_accrual_ledger
       WHERE employee_id = ? AND accrual_year = ?`,
      [employeeId, year]
    );
    const accrual = accrualRows[0] ?? null;

    const result = (rows as RowDataPacket[]).map((row) => {
      if (row.leave_code === 'EL' && accrual) {
        return {
          ...row,
          el_accruing_days: Number(accrual.accrued_days),       // accumulating this year (not spendable yet)
          el_last_credited_month: Number(accrual.last_credited_month),
        };
      }
      return row;
    });

    return result;
  },

  async listHolidays(year?: number): Promise<LeaveHoliday[]> {
    let sql = "SELECT * FROM leave_holiday_master WHERE active_status = 1";
    const params: unknown[] = [];
    if (year) { sql += " AND YEAR(holiday_date) = ?"; params.push(year); }
    sql += " ORDER BY holiday_date ASC";
    const [rows] = await db.execute<RowDataPacket[]>(sql, params);
    return rows as LeaveHoliday[];
  },

  async createHoliday(input: CreateHolidayInput): Promise<LeaveHoliday> {
    const id = randomUUID();
    await db.execute(
      `INSERT INTO leave_holiday_master (id, holiday_name, holiday_date, holiday_type, branch_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.holidayName, input.holidayDate, input.holidayType, input.branchId ?? null]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM leave_holiday_master WHERE id = ? LIMIT 1", [id]
    );
    return (rows as LeaveHoliday[])[0];
  },
};
