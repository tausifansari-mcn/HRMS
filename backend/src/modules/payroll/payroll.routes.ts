import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getEmployeeForUser, hasRole } from "../../shared/accessGuard.js";
import { payrollController as c } from "./payroll.controller.js";
import { calculatePayrollRun } from "./payrollCalculate.service.js";
import { payslipService } from "./payslip.service.js";
import { taxDeclarationService } from "./taxDeclaration.service.js";
import { logSensitiveAction } from "../../shared/auditLog.js";
import { db } from "../../db/mysql.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import type { Response } from "express";
import type { RowDataPacket } from "mysql2";

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// ─── Structures ───────────────────────────────────────────────────────────────

router.get("/structures", h(c.listStructures));
router.post("/structures", requireRole("admin", "hr", "finance", "payroll"), h(c.createStructure));

// ─── Components ───────────────────────────────────────────────────────────────

router.get("/components", h(c.listComponents));
router.post("/components", requireRole("admin", "hr", "finance", "payroll"), h(c.createComponent));

// ─── Salary Assignments ───────────────────────────────────────────────────────

router.post("/salary-assignments", requireRole("admin", "hr", "finance", "payroll"), h(c.assignSalary));
router.post("/salary-assignments/bulk", requireRole("admin", "hr", "finance", "payroll"), h(c.bulkAssignSalary));
router.get("/salary-assignments/:employeeId", requireRole("admin", "hr", "finance", "payroll"), h(c.getEmployeeSalary));

// ─── Payroll Runs — static paths before :id ───────────────────────────────────

router.get("/runs", h(c.listRuns));
router.post("/runs", requireRole("admin", "finance", "payroll"), h(c.createRun));
router.get("/runs/:id", h(c.getRun));
router.patch("/runs/:id/status", requireRole("admin", "finance", "payroll"), h(c.updateRunStatus));
router.get("/runs/:id/lines", h(c.listLines));
router.post("/runs/:id/calculate", requireRole("admin", "finance", "payroll"), async (req: any, res: any, next: any) => {
  try {
    const actorId = req.authUser?.id ?? "system";
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

router.post("/advances", requireRole("admin", "hr", "finance", "payroll"), h(c.createAdvance));
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

// GET /api/payroll/payslip/:runId/:employeeId — admin/hr/finance/payroll or employee own
router.get("/payslip/:runId/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const { runId, employeeId } = req.params;

  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }

  const data = await payslipService.getPayslip(employeeId, runId);
  return res.json({ success: true, data });
}));

// POST /api/payroll/payslip/:runId/generate — admin/hr/finance/payroll only
router.post(
  "/payslip/:runId/generate",
  requireRole("admin", "hr", "finance", "payroll"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId } = req.body as { employeeId?: string };
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const data = await payslipService.generatePayslip(req.params.runId, employeeId, req.authUser!.id, req);
    return res.status(201).json({ success: true, data, message: "Payslip generated" });
  })
);

// POST /api/payroll/payslip/:payslipId/acknowledge — employee self (server-mapped)
router.post("/payslip/:payslipId/acknowledge", h(async (req: AuthenticatedRequest, res: Response) => {
  const callerEmp = await getEmployeeForUser(req.authUser!.id);
  if (!callerEmp) {
    return res.status(403).json({ success: false, message: "No employee record" });
  }
  const data = await payslipService.acknowledgePayslip(req.params.payslipId, callerEmp.id);
  return res.json({ success: true, data, message: "Payslip acknowledged" });
}));

// ─── Tax Declaration ──────────────────────────────────────────────────────────

// GET /api/payroll/tax-declaration/:employeeId/:year — admin/hr/finance/payroll or employee own
router.get("/tax-declaration/:employeeId/:year", h(async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId, year } = req.params;

  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden: you may only view your own tax declaration" });
    }
  }

  const data = await taxDeclarationService.get(employeeId, year);
  return res.json({ success: true, data });
}));

// POST /api/payroll/tax-declaration/:employeeId/:year — admin/hr/finance/payroll or employee own
router.post("/tax-declaration/:employeeId/:year", h(async (req: AuthenticatedRequest, res: Response) => {
  const { year } = req.params;

  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== req.params.employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden: you may only submit your own tax declaration" });
    }
    const data = await taxDeclarationService.upsert(callerEmp.id, year, req.body, req.authUser!.id);
    return res.json({ success: true, data, message: "Tax declaration saved" });
  }

  const data = await taxDeclarationService.upsert(req.params.employeeId, year, req.body, req.authUser!.id);
  return res.json({ success: true, data, message: "Tax declaration saved" });
}));

// ─── UAN ─────────────────────────────────────────────────────────────────────

// GET /api/payroll/uan/:employeeId — admin/hr/finance/payroll or self
router.get("/uan/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId } = req.params;
  const isPrivileged = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPrivileged) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM employee_uan WHERE employee_id = ? LIMIT 1",
    [employeeId]
  );
  return res.json({ success: true, data: (rows as RowDataPacket[])[0] ?? null });
}));

// POST /api/payroll/uan/:employeeId — upsert UAN (admin/hr/finance)
router.post("/uan/:employeeId", requireRole("admin", "hr", "finance"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId } = req.params;
  const { uan, member_id, epf_join_date } = req.body as {
    uan: string;
    member_id?: string;
    epf_join_date?: string;
  };
  if (!uan) return res.status(400).json({ success: false, message: "uan is required" });

  await db.execute(
    `INSERT INTO employee_uan (id, employee_id, uan, member_id, epf_join_date)
       VALUES (UUID(), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         uan = VALUES(uan),
         member_id = VALUES(member_id),
         epf_join_date = VALUES(epf_join_date),
         updated_at = NOW()`,
    [employeeId, uan, member_id ?? null, epf_join_date ?? null]
  );
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM employee_uan WHERE employee_id = ? LIMIT 1",
    [employeeId]
  );
  return res.status(201).json({ success: true, data: (rows as RowDataPacket[])[0] });
}));

// ─── PT Slabs ─────────────────────────────────────────────────────────────────

// GET /api/payroll/pt-slabs — list PT slabs; optional ?state_code=
router.get("/pt-slabs", h(async (req: AuthenticatedRequest, res: Response) => {
  const { state_code } = req.query as { state_code?: string };
  const params: unknown[] = [];
  let where = "WHERE is_active = 1";
  if (state_code) {
    where += " AND state_code = ?";
    params.push(state_code);
  }
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM pt_slab_master ${where} ORDER BY state_code, income_from`,
    params
  );
  return res.json({ success: true, data: rows });
}));

// POST /api/payroll/pt-slabs — create slab (admin/finance)
router.post(
  "/pt-slabs",
  requireRole("admin", "finance"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { state_code, state_name, income_from, income_to, pt_amount, frequency, effective_from } =
      req.body as {
        state_code: string;
        state_name: string;
        income_from: number;
        income_to?: number | null;
        pt_amount: number;
        frequency: string;
        effective_from: string;
      };

    if (!state_code || !state_name || income_from === undefined || pt_amount === undefined || !frequency || !effective_from) {
      return res.status(400).json({ success: false, message: "state_code, state_name, income_from, pt_amount, frequency, effective_from are required" });
    }

    const id = (await import("crypto")).randomUUID();
    await db.execute(
      `INSERT INTO pt_slab_master (id, state_code, state_name, income_from, income_to, pt_amount, frequency, effective_from, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, state_code, state_name, income_from, income_to ?? null, pt_amount, frequency, effective_from]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM pt_slab_master WHERE id = ? LIMIT 1",
      [id]
    );
    return res.status(201).json({ success: true, data: (rows as RowDataPacket[])[0] });
  })
);

// PATCH /api/payroll/pt-slabs/:id — update slab (admin/finance)
router.patch(
  "/pt-slabs/:id",
  requireRole("admin", "finance"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { pt_amount, income_to, is_active } = req.body as {
      pt_amount?: number;
      income_to?: number | null;
      is_active?: number;
    };

    const sets: string[] = [];
    const params: unknown[] = [];

    if (pt_amount !== undefined) { sets.push("pt_amount = ?");  params.push(pt_amount); }
    if (income_to !== undefined) { sets.push("income_to = ?");  params.push(income_to ?? null); }
    if (is_active !== undefined) { sets.push("is_active = ?");  params.push(is_active); }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    params.push(id);
    const patchResult = await db.execute(
      `UPDATE pt_slab_master SET ${sets.join(", ")} WHERE id = ?`,
      params
    );
    const result = (patchResult as unknown as [{ affectedRows: number }, unknown])[0];

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "PT slab not found" });
    }

    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM pt_slab_master WHERE id = ? LIMIT 1",
      [id]
    );
    return res.json({ success: true, data: (rows as RowDataPacket[])[0] });
  })
);

// ─── Minimum Wages ────────────────────────────────────────────────────────────

// GET /api/payroll/minimum-wages — list minimum wages; optional ?state_code=
router.get("/minimum-wages", h(async (req: AuthenticatedRequest, res: Response) => {
  const { state_code } = req.query as { state_code?: string };
  const params: unknown[] = [];
  let where = "WHERE is_active = 1";
  if (state_code) {
    where += " AND state_code = ?";
    params.push(state_code);
  }
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM minimum_wage_master ${where} ORDER BY state_code, category`,
    params
  );
  return res.json({ success: true, data: rows });
}));

// ─── ECR / ESIC Challan ───────────────────────────────────────────────────────

// GET /api/payroll/runs/:id/ecr — ECR-format data for a run
router.get("/runs/:id/ecr", requireRole("admin", "finance", "payroll"), h(async (req: AuthenticatedRequest, res: Response) => {
  const runId = req.params.id;

  // Verify run exists
  const [runRows] = await db.execute<RowDataPacket[]>(
    "SELECT id, run_month FROM salary_prep_run WHERE id = ? LIMIT 1",
    [runId]
  );
  if (!(runRows as RowDataPacket[]).length) {
    return res.status(404).json({ success: false, message: "Run not found" });
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       eu.uan,
       eu.member_id,
       CONCAT_WS(' ', e.first_name, e.last_name) AS member_name,
       spl.gross_salary                           AS wages,
       spl.pf_employee                            AS epf_contribution,
       (spl.pf_employer - ROUND(spl.pf_employer * 3.67 / 12, 2)) AS eps_contribution
     FROM salary_prep_line spl
     JOIN employees e        ON e.id  = spl.employee_id
     LEFT JOIN employee_uan eu ON eu.employee_id = spl.employee_id
     WHERE spl.run_id = ? AND spl.status != 'cancelled'
     ORDER BY e.employee_code`,
    [runId]
  );

  return res.json({ success: true, run_id: runId, data: rows });
}));

// GET /api/payroll/runs/:id/esic-challan — ESIC challan data for a run
router.get("/runs/:id/esic-challan", requireRole("admin", "finance", "payroll"), h(async (req: AuthenticatedRequest, res: Response) => {
  const runId = req.params.id;

  const [runRows] = await db.execute<RowDataPacket[]>(
    "SELECT id, run_month FROM salary_prep_run WHERE id = ? LIMIT 1",
    [runId]
  );
  const run = (runRows as Array<{ id: string; run_month: string }>)[0];
  if (!run) {
    return res.status(404).json({ success: false, message: "Run not found" });
  }

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       e.employee_code,
       CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
       spl.gross_salary                           AS wages,
       spl.esic_employee                          AS employee_contribution,
       spl.esic_employer                          AS employer_contribution
     FROM salary_prep_line spl
     JOIN employees e ON e.id = spl.employee_id
     WHERE spl.run_id = ? AND spl.status != 'cancelled'
     ORDER BY e.employee_code`,
    [runId]
  );

  const lines = rows as Array<{
    employee_code: string;
    employee_name: string;
    wages: number;
    employee_contribution: number;
    employer_contribution: number;
  }>;

  const totals = lines.reduce(
    (acc, l) => {
      acc.total_wages        += Number(l.wages);
      acc.employee_total     += Number(l.employee_contribution);
      acc.employer_total     += Number(l.employer_contribution);
      return acc;
    },
    { total_wages: 0, employee_total: 0, employer_total: 0 }
  );

  return res.json({
    success: true,
    run_id: runId,
    period: run.run_month,
    employee_count: lines.length,
    ...totals,
    data: lines,
  });
}));

export { router as payrollRouter };
