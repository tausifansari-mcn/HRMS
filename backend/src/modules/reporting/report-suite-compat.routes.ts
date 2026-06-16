import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { db } from "../../db/mysql.js";

export const reportSuiteCompatRouter = Router();
reportSuiteCompatRouter.use(requireAuth);

const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);
const PAYROLL_RUN_STATUSES = ["approved", "disbursed", "finalized", "locked", "released", "paid"];

function dateParam(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}
function monthParam(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 7);
}
function limitParam(value: unknown) {
  const n = Number(value ?? 5000);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 20000) : 5000;
}
function addEmployeeFilters(query: any, clauses: string[], params: unknown[], alias = "e") {
  if (query.branchId) { clauses.push(`${alias}.branch_id = ?`); params.push(String(query.branchId)); }
  if (query.departmentId) { clauses.push(`${alias}.department_id = ?`); params.push(String(query.departmentId)); }
  if (query.processId) { clauses.push(`${alias}.process_id = ?`); params.push(String(query.processId)); }
  if (query.costCentreId) { clauses.push(`${alias}.cost_centre_id = ?`); params.push(String(query.costCentreId)); }
  if (query.managerId) { clauses.push(`(${alias}.reporting_manager_id = ? OR ${alias}.manager_id = ?)`); params.push(String(query.managerId), String(query.managerId)); }
}
function runStatusClause(alias = "spr") {
  return `LOWER(${alias}.status) IN (${PAYROLL_RUN_STATUSES.map(() => "?").join(",")})`;
}
function activeMasterJoin(alias: string) {
  return `(${alias}.id IS NULL OR COALESCE(${alias}.active_status, 1) = 1)`;
}

const COMPAT_CODES = new Set(["employee-movement", "leave-balance", "payroll-register", "payroll-variance", "payslip-status"]);

reportSuiteCompatRouter.get("/:code", requireRole("admin", "hr", "finance", "payroll", "wfm", "manager", "ceo"), h(async (req, res, next) => {
  const code = String(req.params.code);
  if (!COMPAT_CODES.has(code)) return next();

  const limit = limitParam(req.query.limit);
  const clauses: string[] = [];
  const params: unknown[] = [];
  let sql = "";

  switch (code) {
    case "employee-movement": {
      const from = dateParam(req.query.from, `${new Date().getFullYear()}-01-01`);
      const to = dateParam(req.query.to, new Date().toISOString().slice(0, 10));
      const filterClauses: string[] = [];
      const filterParams: unknown[] = [];
      addEmployeeFilters(req.query, filterClauses, filterParams);
      filterClauses.push("(e.date_of_joining BETWEEN ? AND ? OR COALESCE(e.date_of_exit,e.date_of_leaving,e.resignation_date) BETWEEN ? AND ?)");
      filterParams.push(from, to, from, to);
      sql = `SELECT e.employee_code,
                    COALESCE(NULLIF(e.full_name,''), CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS employee_name,
                    e.date_of_joining,
                    COALESCE(e.date_of_exit,e.date_of_leaving,e.resignation_date) AS exit_date,
                    CASE WHEN e.date_of_joining BETWEEN ? AND ? THEN 'joining' ELSE 'exit' END AS movement_type,
                    b.branch_name, d.dept_name AS department_name, p.process_name
               FROM employees e
               LEFT JOIN branch_master b ON b.id = e.branch_id
               LEFT JOIN department_master d ON d.id = e.department_id
               LEFT JOIN process_master p ON p.id = e.process_id
              WHERE ${filterClauses.join(" AND ")}
                AND ${activeMasterJoin("b")}
                AND ${activeMasterJoin("d")}
                AND ${activeMasterJoin("p")}
              ORDER BY COALESCE(e.date_of_joining,e.date_of_exit,e.date_of_leaving,e.resignation_date) DESC`;
      params.push(from, to, ...filterParams);
      break;
    }

    case "leave-balance": {
      addEmployeeFilters(req.query, clauses, params);
      clauses.push("lbl.balance_year = ?");
      params.push(Number(req.query.year ?? new Date().getFullYear()));
      if (String(req.query.includeInactive ?? "0") !== "1") clauses.push("e.active_status = 1");
      sql = `SELECT e.employee_code,
                    COALESCE(NULLIF(e.full_name,''), CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS employee_name,
                    b.branch_name, d.dept_name AS department_name, p.process_name,
                    lt.leave_code, lt.leave_name,
                    COALESCE(lbl.opening_days, 0) AS opening_days,
                    COALESCE(lbl.allocated_days, 0) AS allocated_days,
                    COALESCE(lbl.used_days, 0) AS used_days,
                    COALESCE(lbl.adjusted_days, 0) AS adjusted_days,
                    (COALESCE(lbl.opening_days,0) + COALESCE(lbl.allocated_days,0) + COALESCE(lbl.adjusted_days,0) - COALESCE(lbl.used_days,0)) AS remaining_days,
                    CASE WHEN (COALESCE(lbl.allocated_days,0) + COALESCE(lbl.adjusted_days,0) - COALESCE(lbl.used_days,0)) < 0 THEN 'NEGATIVE_BALANCE' ELSE 'OK' END AS balance_status
               FROM leave_balance_ledger lbl
               JOIN employees e ON e.id = lbl.employee_id
               JOIN leave_type_master lt ON lt.id = lbl.leave_type_id
               LEFT JOIN branch_master b ON b.id = e.branch_id
               LEFT JOIN department_master d ON d.id = e.department_id
               LEFT JOIN process_master p ON p.id = e.process_id
              WHERE ${clauses.join(" AND ")}
                AND ${activeMasterJoin("b")}
                AND ${activeMasterJoin("d")}
                AND ${activeMasterJoin("p")}
              ORDER BY employee_name, lt.leave_code`;
      break;
    }

    case "payroll-register": {
      const month = monthParam(req.query.month);
      addEmployeeFilters(req.query, clauses, params);
      clauses.push("spr.run_month = ?"); params.push(month);
      clauses.push(runStatusClause("spr")); params.push(...PAYROLL_RUN_STATUSES);
      sql = `SELECT spr.run_month, spr.status AS run_status,
                    e.employee_code, COALESCE(NULLIF(e.full_name,''), CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS employee_name,
                    b.branch_name, p.process_name,
                    spl.gross_salary, spl.total_deductions, spl.net_salary, spl.working_days, spl.present_days, spl.leave_days, spl.lwp_days, spl.status AS line_status,
                    (COALESCE(spl.gross_salary,0) - COALESCE(spl.total_deductions,0) - COALESCE(spl.net_salary,0)) AS net_mismatch_amount,
                    CASE WHEN COALESCE(spl.net_salary,0) < 0 THEN 'NEGATIVE_NET'
                         WHEN ABS(COALESCE(spl.gross_salary,0) - COALESCE(spl.total_deductions,0) - COALESCE(spl.net_salary,0)) > 1 THEN 'NET_MISMATCH'
                         ELSE 'OK' END AS payroll_risk
               FROM salary_prep_line spl
               JOIN salary_prep_run spr ON spr.id = spl.run_id
               JOIN employees e ON e.id = spl.employee_id
               LEFT JOIN branch_master b ON b.id = e.branch_id
               LEFT JOIN process_master p ON p.id = e.process_id
              WHERE ${clauses.join(" AND ")}
              ORDER BY employee_name`;
      break;
    }

    case "payroll-variance": {
      const month = monthParam(req.query.month);
      addEmployeeFilters(req.query, clauses, params);
      clauses.push("spr.run_month = ?"); params.push(month);
      clauses.push(runStatusClause("spr")); params.push(...PAYROLL_RUN_STATUSES);
      sql = `SELECT e.employee_code, COALESCE(NULLIF(e.full_name,''), CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS employee_name,
                    spr.run_month, spl.net_salary AS current_net,
                    prev.net_salary AS previous_net,
                    ROUND(((spl.net_salary - COALESCE(prev.net_salary,0)) / NULLIF(prev.net_salary,0))*100,2) AS net_variance_pct,
                    spl.lwp_days,
                    CASE WHEN prev.id IS NULL THEN 'NO_PREVIOUS_MONTH'
                         WHEN ABS(ROUND(((spl.net_salary - COALESCE(prev.net_salary,0)) / NULLIF(prev.net_salary,0))*100,2)) >= 20 THEN 'HIGH_VARIANCE'
                         WHEN spl.net_salary < 0 THEN 'NEGATIVE_NET'
                         ELSE 'OK' END AS variance_status
               FROM salary_prep_line spl
               JOIN salary_prep_run spr ON spr.id = spl.run_id
               JOIN employees e ON e.id = spl.employee_id
               LEFT JOIN salary_prep_run pspr ON pspr.run_month = DATE_FORMAT(DATE_SUB(STR_TO_DATE(CONCAT(spr.run_month,'-01'),'%Y-%m-%d'), INTERVAL 1 MONTH),'%Y-%m')
                 AND ${runStatusClause("pspr")}
               LEFT JOIN salary_prep_line prev ON prev.run_id = pspr.id AND prev.employee_id = spl.employee_id
              WHERE ${clauses.join(" AND ")}
              ORDER BY ABS(COALESCE(net_variance_pct,0)) DESC`;
      params.push(...PAYROLL_RUN_STATUSES);
      break;
    }

    case "payslip-status": {
      const month = monthParam(req.query.month);
      addEmployeeFilters(req.query, clauses, params);
      clauses.push("spr.run_month = ?"); params.push(month);
      clauses.push(runStatusClause("spr")); params.push(...PAYROLL_RUN_STATUSES);
      sql = `SELECT spr.run_month, spr.status AS run_status,
                    e.employee_code, COALESCE(NULLIF(e.full_name,''), CONCAT(e.first_name,' ',COALESCE(e.last_name,''))) AS employee_name,
                    sp.payslip_ref, sp.file_url, sp.acknowledged_at,
                    CASE WHEN sp.id IS NULL THEN 'NOT_GENERATED'
                         WHEN sp.acknowledged_at IS NULL THEN 'RELEASED_NOT_ACKNOWLEDGED'
                         ELSE 'ACKNOWLEDGED' END AS payslip_status
               FROM salary_prep_line spl
               JOIN salary_prep_run spr ON spr.id = spl.run_id
               JOIN employees e ON e.id = spl.employee_id
               LEFT JOIN salary_payslip sp ON sp.prep_line_id = spl.id
              WHERE ${clauses.join(" AND ")}
              ORDER BY payslip_status DESC, employee_name`;
      break;
    }
  }

  const [rows] = await db.execute<RowDataPacket[]>(`${sql} LIMIT ${limit}`, params);
  return res.json({
    success: true,
    code,
    data: rows,
    meta: {
      count: rows.length,
      limit,
      compatibilityRoute: true,
      payrollStatuses: code.startsWith("payroll") || code === "payslip-status" ? PAYROLL_RUN_STATUSES : undefined,
    },
  });
}));
