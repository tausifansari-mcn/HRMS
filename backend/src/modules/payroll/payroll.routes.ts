import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireScopedRole } from "../../middleware/scopeMiddleware.js";
import { buildScopeWhereClause } from "../../shared/scopeAccess.js";
import { getEmployeeForUser, hasRole } from "../../shared/accessGuard.js";
import { payrollController as c } from "./payroll.controller.js";
import { calculatePayrollRun } from "./payrollCalculate.service.js";
import { payrollGovernanceService } from "./payroll-governance.service.js";
import { payslipService } from "./payslip.service.js";
import { taxDeclarationService } from "./taxDeclaration.service.js";
import { logSensitiveAction } from "../../shared/auditLog.js";
import { db } from "../../db/mysql.js";
import { env } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import type { Response } from "express";
import type { RowDataPacket } from "mysql2";

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// ─── Structures ───────────────────────────────────────────────────────────────

router.get("/structures", requireRole("admin", "hr", "finance", "payroll"), h(c.listStructures));
router.post("/structures", requireRole("admin", "hr", "finance", "payroll"), h(c.createStructure));

// ─── Components ───────────────────────────────────────────────────────────────

router.get("/components", requireRole("admin", "hr", "finance", "payroll"), h(c.listComponents));
router.post("/components", requireRole("admin", "hr", "finance", "payroll"), h(c.createComponent));

// ─── Salary Assignments ───────────────────────────────────────────────────────

router.post("/salary-assignments",
  requireRole("admin", "hr", "finance", "payroll"),
  requireScopedRole(["hr", "finance", "payroll"], async (req) => {
    // Resolve employee's branch/process from DB
    const [rows] = await db.execute(
      'SELECT branch_id, process_id, department_id FROM employees WHERE id = ? LIMIT 1',
      [req.body.employee_id]
    ) as any[];
    const emp = rows[0];
    return {
      branchId: emp?.branch_id,
      processId: emp?.process_id,
      departmentId: emp?.department_id
    };
  }),
  h(c.assignSalary)
);
router.post("/salary-assignments/bulk", requireRole("admin", "hr", "finance", "payroll"), h(c.bulkAssignSalary));
router.get("/salary-assignments/:employeeId", requireRole("admin", "hr", "finance", "payroll"), h(c.getEmployeeSalary));
router.get("/salary-assignments/:employeeId/history", requireRole("admin", "hr", "finance", "payroll"), h(c.getEmployeeSalaryHistory));

// ─── Payroll Runs — static paths before :id ───────────────────────────────────

router.get("/runs", requireRole("admin", "hr", "finance", "payroll"), h(async (req, res) => {
  // Apply scope filtering for finance/payroll
  const scoped = await buildScopeWhereClause(
    req.authUser!.id,
    ["finance", "payroll"],
    {
      branchId: "spr.branch_id",
      processId: "spr.process_id"
    },
    { allowCeoAllRead: true }
  );
  (req as any).scopeFilter = scoped;
  return c.listRuns(req, res);
}));
router.get("/records", requireRole("admin", "hr", "finance", "payroll"), h(async (req, res) => {
  const scoped = await buildScopeWhereClause(
    req.authUser!.id,
    ["finance", "payroll"],
    {
      branchId: "e.branch_id",
      processId: "e.process_id"
    },
    { allowCeoAllRead: true }
  );
  (req as any).scopeFilter = scoped;
  return c.listPayrollRecords(req, res);
}));
router.get("/overview", requireRole("admin", "hr", "finance", "payroll"), h(c.getPayrollOverview));
router.post("/runs",
  requireRole("admin", "finance", "payroll"),
  requireScopedRole(["finance", "payroll"], async (req) => ({
    branchId: req.body.branch_id,
    processId: req.body.process_id,
    departmentId: req.body.department_id
  })),
  h(c.createRun)
);
router.get("/runs/:id", requireRole("admin", "hr", "finance", "payroll"), h(c.getRun));
router.get("/runs/:id/readiness", requireRole("admin", "hr", "finance", "payroll"), h(async (req, res) => {
  const data = await payrollGovernanceService.readiness(req.params.id);
  return res.json({ success: true, data });
}));
router.post("/runs/:id/freeze-attendance", requireRole("admin", "finance", "payroll"), h(async (req, res) => {
  const actorId = req.authUser?.id ?? "system";
  const data = await payrollGovernanceService.freezeAttendance(req.params.id, actorId);
  void logSensitiveAction({
    actor_user_id: actorId,
    action_type: "PAYROLL_ATTENDANCE_FROZEN",
    module_key: "payroll",
    entity_type: "salary_prep_run",
    entity_id: req.params.id,
    change_summary: data,
    req,
  });
  return res.json({ success: true, data, message: "Attendance frozen for payroll run" });
}));
router.patch("/runs/:id/status", requireRole("admin", "finance", "payroll"), h(c.updateRunStatus));
router.get("/runs/:id/lines", requireRole("admin", "hr", "finance", "payroll"), h(c.listLines));
router.post("/runs/:id/calculate", requireRole("admin", "finance", "payroll"), async (req: any, res: any, next: any) => {
  try {
    const actorId = req.authUser?.id ?? "system";
    if (process.env.PAYROLL_STRICT_READINESS === "true") {
      const readiness = await payrollGovernanceService.readiness(req.params.id);
      if (!readiness.canCalculate || !readiness.attendanceSnapshotLocked) {
        return res.status(409).json({
          success: false,
          message: "Payroll readiness check failed. Resolve blockers and freeze attendance before calculation.",
          data: readiness,
        });
      }
    }
    const result = await calculatePayrollRun(req.params.id, actorId);
    void logSensitiveAction({
      actor_user_id: actorId,
      action_type: "PAYROLL_RUN_CALCULATED",
      module_key: "payroll",
      entity_type: "salary_prep_run",
      entity_id: req.params.id,
      change_summary: { run_id: req.params.id },
      req,
    });
    return res.json({ success: true, data: result, message: "Payroll calculated" });
  } catch (err) { next(err); }
});

// ─── Run Lines ────────────────────────────────────────────────────────────────

router.patch("/lines/:id", requireRole("admin", "finance", "payroll"), h(c.updateLine));

// ─── Advances ─────────────────────────────────────────────────────────────────

router.post("/advances",
  requireRole("admin", "hr", "finance", "payroll"),
  requireScopedRole(["hr", "finance", "payroll"], async (req) => {
    // Resolve employee's branch/process
    const [rows] = await db.execute(
      'SELECT branch_id, process_id, department_id FROM employees WHERE id = ? LIMIT 1',
      [req.body.employee_id]
    ) as any[];
    const emp = rows[0];
    return {
      branchId: emp?.branch_id,
      processId: emp?.process_id,
      departmentId: emp?.department_id
    };
  }),
  h(c.createAdvance)
);
router.get("/advances/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== req.params.employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden: you may only view your own advances" });
    }
  }
  return c.listAdvances(req as any, res);
}));

// ─── Statutory Config ─────────────────────────────────────────────────────────

router.get("/statutory-config", requireRole("admin", "finance", "payroll"), h(c.getStatutoryConfig));

// ─── Payslip ──────────────────────────────────────────────────────────────────

// GET /api/payroll/payslip/my — list own payslip history (employee self-service)
router.get("/payslip/my", h(async (req: AuthenticatedRequest, res: Response) => {
  const callerEmp = await getEmployeeForUser(req.authUser!.id);
  if (!callerEmp) return res.status(403).json({ success: false, message: "No employee record for authenticated user" });

  const year = req.query.year ? String(req.query.year) : String(new Date().getFullYear());
  const numericYear = Number(year);
  if (!/^\d{4}$/.test(year) || numericYear < 2000 || numericYear > new Date().getFullYear() + 1) {
    return res.status(400).json({ success: false, message: "Invalid payslip year" });
  }

  // Fetch main payroll lines with employee profile data
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT spl.id, spl.run_id, spl.employee_id, spl.employee_code,
            spl.gross_salary, spl.total_deductions, spl.net_salary,
            spl.basic, spl.hra, spl.special_allowance,
            spl.pf_employee, spl.esic_employee, spl.professional_tax, spl.tds,
            spl.working_days, spl.present_days, spl.leave_days, spl.lwp_days,
            spl.status, spl.remarks,
            spr.run_month, spr.disbursed_at AS paid_at, spr.status AS run_status,
            sp.acknowledged_at, sp.file_url, sp.payslip_ref,
            e.first_name, e.last_name,
            COALESCE(eu.member_id, e.epf_number) AS epf_number,
            e.esic_number AS esi_number,
            des.designation_name,
            dept.dept_name,
            br.branch_name,
            loc.location_name
       FROM salary_prep_line spl
       JOIN salary_prep_run spr ON spr.id = spl.run_id
       LEFT JOIN salary_payslip sp ON sp.prep_line_id = spl.id
       LEFT JOIN employees e ON CAST(e.id AS CHAR) = CAST(spl.employee_id AS CHAR)
       LEFT JOIN employee_uan eu ON eu.employee_id = e.id AND eu.is_active = 1
       LEFT JOIN designation_master des ON CAST(des.id AS CHAR) = CAST(e.designation_id AS CHAR)
       LEFT JOIN department_master dept ON CAST(dept.id AS CHAR) = CAST(e.department_id AS CHAR)
       LEFT JOIN branch_master br ON CAST(br.id AS CHAR) = CAST(e.branch_id AS CHAR)
       LEFT JOIN location_master loc ON CAST(loc.id AS CHAR) = CAST(e.location_id AS CHAR)
      WHERE spl.employee_id = ?
        AND spr.run_month LIKE ?
        AND spl.status NOT IN ('draft')
      ORDER BY spr.run_month DESC`,
    [callerEmp.id, `${year}-%`]
  );

  // For each line, fetch detailed component breakdown
  for (const line of rows as any[]) {
    const [components] = await db.execute<RowDataPacket[]>(
      `SELECT component_code, component_name, component_type, amount, taxable
       FROM salary_prep_line_component
       WHERE line_id = ?
       ORDER BY
         CASE component_type
           WHEN 'earning' THEN 1
           WHEN 'deduction' THEN 2
           ELSE 3
         END,
         component_code`,
      [line.id]
    );

    // Split components by type
    line.earnings = (components as any[]).filter(c => c.component_type === 'earning');
    line.deductions = (components as any[]).filter(c => c.component_type === 'deduction');
    line.employer_costs = (components as any[]).filter(c => c.component_type === 'employer_cost');
  }
  return res.json({ success: true, data: rows });
}));

export { router as payrollRouter };
