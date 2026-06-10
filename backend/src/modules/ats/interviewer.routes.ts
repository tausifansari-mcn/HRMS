import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { interviewerService, type SubmitResultInput, type RescheduleInput } from "./interviewer.service.js";

export const interviewerRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// All interviewer routes require authentication and interviewer role
interviewerRouter.use(requireAuth);
interviewerRouter.use(requireRole("interviewer", "admin")); // Admin can access for testing/support

/**
 * GET /api/ats/interviewer/my-interviews
 * Get all interviews assigned to the logged-in interviewer
 * Query params: ?status=Assigned&date=2026-06-10&round=1
 */
interviewerRouter.get("/my-interviews", h(async (req: AuthenticatedRequest, res: Response) => {
  const interviewerId = req.authUser!.id;
  const { status, date, round } = req.query;

  const filters = {
    status: status as string | undefined,
    date: date as string | undefined,
    round: round ? parseInt(round as string) : undefined,
  };

  const interviews = await interviewerService.getMyInterviews(interviewerId, filters);

  return res.json({
    success: true,
    data: interviews,
    count: interviews.length,
  });
}));

/**
 * GET /api/ats/interviewer/interview/:assignmentId
 * Get single interview assignment details
 * Security: Only if assigned to this interviewer
 */
interviewerRouter.get("/interview/:assignmentId", h(async (req: AuthenticatedRequest, res: Response) => {
  const interviewerId = req.authUser!.id;
  const { assignmentId } = req.params;

  const interview = await interviewerService.getInterviewById(assignmentId, interviewerId);

  if (!interview) {
    return res.status(404).json({
      success: false,
      message: "Interview assignment not found or access denied",
    });
  }

  return res.json({
    success: true,
    data: interview,
  });
}));

/**
 * POST /api/ats/interviewer/submit-result
 * Submit interview result (Selected/Rejected/OnHold)
 * Security: Only for assigned interviews, cannot modify completed
 */
interviewerRouter.post("/submit-result", h(async (req: AuthenticatedRequest, res: Response) => {
  const interviewerId = req.authUser!.id;
  const input: SubmitResultInput = req.body;

  // Validate required fields
  if (!input.assignmentId || !input.result || !input.remarks) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: assignmentId, result, remarks",
    });
  }

  // Validate result enum
  const validResults = ["Selected", "Rejected", "OnHold"];
  if (!validResults.includes(input.result)) {
    return res.status(400).json({
      success: false,
      message: "Invalid result. Must be one of: Selected, Rejected, OnHold",
    });
  }

  // Validate remarks length
  if (input.remarks.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Remarks must be at least 10 characters",
    });
  }

  const result = await interviewerService.submitResult(input, interviewerId);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
}));

/**
 * POST /api/ats/interviewer/mark-noshow
 * Mark candidate as no-show for interview
 * Security: Only for assigned interviews
 */
interviewerRouter.post("/mark-noshow", h(async (req: AuthenticatedRequest, res: Response) => {
  const interviewerId = req.authUser!.id;
  const { assignmentId, remarks } = req.body;

  if (!assignmentId || !remarks) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: assignmentId, remarks",
    });
  }

  if (remarks.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Remarks must be at least 10 characters",
    });
  }

  const result = await interviewerService.markNoShow(assignmentId, interviewerId, remarks);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
}));

/**
 * POST /api/ats/interviewer/reschedule
 * Reschedule an interview
 * Security: Only for assigned interviews, cannot reschedule completed
 */
interviewerRouter.post("/reschedule", h(async (req: AuthenticatedRequest, res: Response) => {
  const interviewerId = req.authUser!.id;
  const input: RescheduleInput = req.body;

  if (!input.assignmentId || !input.newDate || !input.reason) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: assignmentId, newDate, reason",
    });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input.newDate)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format. Use YYYY-MM-DD",
    });
  }

  // Validate date is not in the past
  const newDate = new Date(input.newDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (newDate < today) {
    return res.status(400).json({
      success: false,
      message: "Cannot reschedule to a past date",
    });
  }

  if (input.reason.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Reason must be at least 10 characters",
    });
  }

  const result = await interviewerService.reschedule(input, interviewerId);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
}));

/**
 * GET /api/ats/interviewer/stats
 * Get interview statistics for dashboard
 */
interviewerRouter.get("/stats", h(async (req: AuthenticatedRequest, res: Response) => {
  const interviewerId = req.authUser!.id;

  const stats = await interviewerService.getInterviewerStats(interviewerId);

  return res.json({
    success: true,
    data: stats,
  });
}));
