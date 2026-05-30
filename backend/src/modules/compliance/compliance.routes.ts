import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { complianceService } from "./compliance.service.js";
import { getEmployeeForUser, hasRole } from "../../shared/accessGuard.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";

export const complianceRouter = Router();
complianceRouter.use(requireAuth);

const h =
  (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: (err?: unknown) => void) =>
    fn(req, res).catch(next);

// ─── Bonus Act ────────────────────────────────────────────────────────────────

// GET /bonus — list bonus calculations (admin/hr/finance)
complianceRouter.get(
  "/bonus",
  requireRole("admin", "hr", "finance"),
  h(async (req, res) => {
    const { financial_year } = req.query as { financial_year?: string };
    const data = await complianceService.listBonus(financial_year);
    return res.json({ success: true, data });
  })
);

// POST /bonus/calculate — calculate bonus for all eligible employees for a FY (admin/finance)
complianceRouter.post(
  "/bonus/calculate",
  requireRole("admin", "finance"),
  h(async (req, res) => {
    const { financial_year } = req.body as { financial_year?: string };
    if (!financial_year?.trim()) {
      return res.status(400).json({ success: false, error: "financial_year is required (e.g. 2025-2026)" });
    }
    // Validate format: YYYY-YYYY
    if (!/^\d{4}-\d{4}$/.test(financial_year.trim())) {
      return res.status(400).json({ success: false, error: "financial_year must be in format YYYY-YYYY" });
    }
    const result = await complianceService.calculateBonus(financial_year.trim(), req.authUser!.id);
    return res.json({ success: true, data: result, message: `Bonus calculated: ${result.upserted} eligible, ${result.skipped} skipped` });
  })
);

// PATCH /bonus/:id/approve — approve bonus record (admin/finance)
complianceRouter.patch(
  "/bonus/:id/approve",
  requireRole("admin", "finance"),
  h(async (req, res) => {
    const data = await complianceService.approveBonus(req.params.id, req.authUser!.id);
    return res.json({ success: true, data, message: "Bonus approved" });
  })
);

// ─── POSH Act ─────────────────────────────────────────────────────────────────

// GET /posh/complaints — strictly admin/hr only
complianceRouter.get(
  "/posh/complaints",
  requireRole("admin", "hr"),
  h(async (_req, res) => {
    const data = await complianceService.listPoshComplaints();
    return res.json({ success: true, data });
  })
);

// POST /posh/complaints — log a new complaint (admin/hr)
complianceRouter.post(
  "/posh/complaints",
  requireRole("admin", "hr"),
  h(async (req, res) => {
    const {
      complainant_anon_id,
      respondent_anon_id,
      branch_id,
      date_of_complaint,
      nature_of_complaint,
      icc_members,
    } = req.body as {
      complainant_anon_id: string;
      respondent_anon_id?: string;
      branch_id?: string;
      date_of_complaint: string;
      nature_of_complaint?: string;
      icc_members?: string[];
    };

    if (!complainant_anon_id?.trim()) {
      return res.status(400).json({ success: false, error: "complainant_anon_id is required" });
    }
    if (!date_of_complaint) {
      return res.status(400).json({ success: false, error: "date_of_complaint is required" });
    }

    const data = await complianceService.createPoshComplaint({
      complainant_anon_id: complainant_anon_id.trim(),
      respondent_anon_id: respondent_anon_id?.trim(),
      branch_id: branch_id?.trim(),
      date_of_complaint,
      nature_of_complaint: nature_of_complaint?.trim(),
      icc_members: Array.isArray(icc_members) ? icc_members : undefined,
    });
    return res.status(201).json({ success: true, data });
  })
);

// PATCH /posh/complaints/:id — update status/outcome (admin/hr)
complianceRouter.patch(
  "/posh/complaints/:id",
  requireRole("admin", "hr"),
  h(async (req, res) => {
    const { status, outcome, closure_date } = req.body as {
      status?: "received" | "under_inquiry" | "settled" | "closed" | "referred_to_police";
      outcome?: "substantiated" | "not_substantiated" | "malicious_complaint" | "conciliation";
      closure_date?: string;
    };

    const validStatuses = ["received", "under_inquiry", "settled", "closed", "referred_to_police"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const validOutcomes = ["substantiated", "not_substantiated", "malicious_complaint", "conciliation"];
    if (outcome && !validOutcomes.includes(outcome)) {
      return res.status(400).json({ success: false, error: `outcome must be one of: ${validOutcomes.join(", ")}` });
    }

    const data = await complianceService.updatePoshComplaint(req.params.id, { status, outcome, closure_date });
    return res.json({ success: true, data });
  })
);

// GET /posh/annual-report/:year — annual report stats (admin/hr)
complianceRouter.get(
  "/posh/annual-report/:year",
  requireRole("admin", "hr"),
  h(async (req, res) => {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ success: false, error: "Valid 4-digit year is required" });
    }
    const data = await complianceService.poshAnnualReport(year);
    return res.json({ success: true, data });
  })
);

// ─── Maternity Benefit Act ────────────────────────────────────────────────────

// GET /maternity — admin/hr sees all; employee sees own
complianceRouter.get(
  "/maternity",
  h(async (req, res) => {
    const userId = req.authUser!.id;
    const privileged = await hasRole(userId, "admin", "hr");

    if (privileged) {
      const data = await complianceService.listMaternity();
      return res.json({ success: true, data });
    }

    const emp = await getEmployeeForUser(userId);
    if (!emp) {
      return res.status(403).json({ success: false, error: "No employee record linked to account" });
    }
    const data = await complianceService.listMaternity(emp.id);
    return res.json({ success: true, data });
  })
);

// POST /maternity — create record (admin/hr)
complianceRouter.post(
  "/maternity",
  requireRole("admin", "hr"),
  h(async (req, res) => {
    const {
      employee_id,
      expected_delivery_date,
      leave_start_date,
      paid_weeks,
      complications,
    } = req.body as {
      employee_id: string;
      expected_delivery_date?: string;
      leave_start_date: string;
      paid_weeks?: number;
      complications?: boolean;
    };

    if (!employee_id?.trim()) {
      return res.status(400).json({ success: false, error: "employee_id is required" });
    }
    if (!leave_start_date) {
      return res.status(400).json({ success: false, error: "leave_start_date is required" });
    }

    const data = await complianceService.createMaternity({
      employee_id: employee_id.trim(),
      expected_delivery_date,
      leave_start_date,
      paid_weeks,
      complications,
    });
    return res.status(201).json({ success: true, data });
  })
);

// PATCH /maternity/:id — update status/dates (admin/hr)
complianceRouter.patch(
  "/maternity/:id",
  requireRole("admin", "hr"),
  h(async (req, res) => {
    const { status, actual_delivery_date, leave_end_date } = req.body as {
      status?: "applied" | "approved" | "active" | "completed" | "rejected";
      actual_delivery_date?: string;
      leave_end_date?: string;
    };

    const validStatuses = ["applied", "approved", "active", "completed", "rejected"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const data = await complianceService.updateMaternity(req.params.id, req.authUser!.id, {
      status,
      actual_delivery_date,
      leave_end_date,
    });
    return res.json({ success: true, data });
  })
);
