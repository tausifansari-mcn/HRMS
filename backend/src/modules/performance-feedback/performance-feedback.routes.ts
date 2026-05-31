import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { performanceFeedbackController as c } from "./performance-feedback.controller.js";

const router = Router();

// Helper to wrap async route handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Apply authentication middleware to all routes
router.use(requireAuth);

// ================== Cycle Management (5 routes) ==================

/**
 * POST /api/performance-feedback/cycles
 * Create new feedback cycle
 * Access: HR only
 */
router.post("/cycles", h(c.createCycle));

/**
 * GET /api/performance-feedback/cycles
 * Get all cycles with optional filters (status, period)
 * Access: HR, Manager
 */
router.get("/cycles", h(c.getCycles));

/**
 * GET /api/performance-feedback/cycles/:id
 * Get single cycle by ID
 * Access: HR, Manager
 */
router.get("/cycles/:id", h(c.getCycleById));

/**
 * PATCH /api/performance-feedback/cycles/:id
 * Update cycle details
 * Access: HR only
 */
router.patch("/cycles/:id", h(c.updateCycle));

/**
 * POST /api/performance-feedback/cycles/:id/close
 * Close feedback cycle
 * Access: HR only
 */
router.post("/cycles/:id/close", h(c.closeCycle));

// ================== Request Management (4 routes) ==================

/**
 * POST /api/performance-feedback/cycles/:cycleId/launch
 * Launch cycle for specific employees
 * Access: HR only
 */
router.post("/cycles/:cycleId/launch", h(c.launchCycle));

/**
 * GET /api/performance-feedback/requests
 * Get feedback requests with filters (cycleId, employeeId, status)
 * Access: HR (all), Manager (own), Employee (own)
 */
router.get("/requests", h(c.getRequests));

/**
 * GET /api/performance-feedback/requests/:id
 * Get single request by ID
 * Access: HR (all), Manager (own), Employee (own)
 */
router.get("/requests/:id", h(c.getRequestById));

/**
 * DELETE /api/performance-feedback/requests/:id
 * Delete feedback request
 * Access: HR only
 */
router.delete("/requests/:id", h(c.deleteRequest));

// ================== Competency Management (4 routes) ==================

/**
 * GET /api/performance-feedback/competencies
 * Get competencies with optional filters (isActive, category)
 * Access: HR, Manager
 */
router.get("/competencies", h(c.getCompetencies));

/**
 * POST /api/performance-feedback/competencies
 * Create new competency
 * Access: HR only
 */
router.post("/competencies", h(c.createCompetency));

/**
 * PATCH /api/performance-feedback/competencies/:id
 * Update competency
 * Access: HR only
 */
router.patch("/competencies/:id", h(c.updateCompetency));

/**
 * DELETE /api/performance-feedback/competencies/:id
 * Deactivate competency
 * Access: HR only
 */
router.delete("/competencies/:id", h(c.deactivateCompetency));

// ================== Feedback Submission (2 routes) ==================

/**
 * GET /api/performance-feedback/requests/:id/form
 * Get form template for feedback request
 * Access: Manager (own requests only)
 */
router.get("/requests/:id/form", h(c.getFormTemplate));

/**
 * POST /api/performance-feedback/requests/:id/submit
 * Submit feedback for request
 * Access: Manager (own requests only)
 */
router.post("/requests/:id/submit", h(c.submitFeedback));

// ================== Report & Development Plans (9 routes) ==================

/**
 * POST /api/performance-feedback/requests/:id/report
 * Generate performance report
 * Access: HR only
 */
router.post("/requests/:id/report", h(c.generateReport));

/**
 * GET /api/performance-feedback/reports
 * Get reports with filters
 * Access: HR (all), Manager (subordinates), Employee (own)
 */
router.get("/reports", h(c.getReports));

/**
 * GET /api/performance-feedback/reports/:id
 * Get report by ID
 * Access: HR (all), Manager (subordinates), Employee (own)
 */
router.get("/reports/:id", h(c.getReportById));

/**
 * POST /api/performance-feedback/development-plans
 * Create development plan
 * Access: HR, Manager
 */
router.post("/development-plans", h(c.createDevelopmentPlan));

/**
 * GET /api/performance-feedback/development-plans
 * Get development plans with filters (employeeId, status)
 * Access: HR (all), Manager (subordinates), Employee (own)
 */
router.get("/development-plans", h(c.getDevelopmentPlans));

/**
 * GET /api/performance-feedback/development-plans/:id
 * Get development plan by ID
 * Access: HR (all), Manager (subordinates), Employee (own)
 */
router.get("/development-plans/:id", h(c.getDevelopmentPlanById));

/**
 * PATCH /api/performance-feedback/development-plans/:id
 * Update development plan
 * Access: HR, Manager
 */
router.patch("/development-plans/:id", h(c.updateDevelopmentPlan));

/**
 * PATCH /api/performance-feedback/development-plans/:planId/goals/:goalId
 * Update specific goal in development plan
 * Access: HR, Manager, Employee (own)
 */
router.patch("/development-plans/:planId/goals/:goalId", h(c.updateGoal));

/**
 * DELETE /api/performance-feedback/development-plans/:id
 * Delete development plan
 * Access: HR only
 */
router.delete("/development-plans/:id", h(c.deleteDevelopmentPlan));

export { router as performanceFeedbackRouter };
