import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { wfmController } from "./wfm.controller.js";
import { wfmService } from "./wfm.service.js";
import { getLiveTracker } from "./liveTracker.service.js";
import { rosterPreferenceService } from "./roster-preference.service.js";
import { getEmployeeForUser } from "../../shared/accessGuard.js";

export const wfmRouter = Router();
wfmRouter.use(requireAuth);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Attendance policy (customizable)
wfmRouter.get("/attendance-policy/:employeeId", requireRole("admin", "wfm", "manager"), async (req, res, next) => {
  try {
    const policy = await wfmService.getAttendancePolicy(req.params.employeeId);
    res.json(policy);
  } catch (error) {
    next(error);
  }
});

// Shifts
wfmRouter.get("/shifts",          requireRole("admin", "wfm", "manager"), h(wfmController.listShifts.bind(wfmController)));
wfmRouter.post("/shifts",         requireRole("admin", "wfm"), h(wfmController.createShift.bind(wfmController)));
wfmRouter.get("/shifts/:id",      requireRole("admin", "wfm", "manager"), h(wfmController.getShift.bind(wfmController)));
wfmRouter.put("/shifts/:id",      requireRole("admin", "wfm"), h(wfmController.updateShift.bind(wfmController)));

// Attendance sessions
wfmRouter.post("/sessions/clock-in",  h(wfmController.clockIn.bind(wfmController)));  // Employee self-service
wfmRouter.post("/sessions/clock-out", h(wfmController.clockOut.bind(wfmController))); // Employee self-service
wfmRouter.get("/sessions",            requireRole("admin", "wfm", "manager"), h(wfmController.listSessions.bind(wfmController)));
wfmRouter.post("/sessions/break",     h(wfmController.logBreak.bind(wfmController))); // Employee self-service

// Regularization
wfmRouter.post("/regularizations",              h(wfmController.submitRegularization.bind(wfmController)));  // Employee can submit own
wfmRouter.get("/regularizations",               requireRole("admin", "wfm", "manager"), h(wfmController.listRegularizations.bind(wfmController)));
wfmRouter.patch("/regularizations/:id/review",  requireRole("admin", "wfm", "manager"), h(wfmController.reviewRegularization.bind(wfmController)));

// Live tracker
wfmRouter.get("/live", requireRole("admin", "wfm", "manager"), async (req: any, res: any, next: any) => {
  try {
    const schema = z.object({
      date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      processName: z.string().optional(),
      branchName:  z.string().optional(),
    });
    const filters = schema.parse(req.query);
    const data = await getLiveTracker(filters);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Roster Preferences
wfmRouter.post("/roster-preferences", requireAuth, h(async (req: any, res: any) => {
  const emp = await getEmployeeForUser(req.authUser.id);
  if (!emp) return res.status(403).json({ error: "Employee record not found" });
  const { preferredShiftId, preferredWeekOff, flexibility, notes, effectiveFrom } = req.body;
  if (!flexibility || !effectiveFrom) return res.status(400).json({ error: "flexibility and effectiveFrom required" });
  const result = await rosterPreferenceService.submit(emp.id, { preferredShiftId, preferredWeekOff, flexibility, notes, effectiveFrom });
  res.status(201).json({ data: result });
}));

wfmRouter.get("/roster-preferences/my", requireAuth, h(async (req: any, res: any) => {
  const emp = await getEmployeeForUser(req.authUser.id);
  if (!emp) return res.status(403).json({ error: "Employee record not found" });
  const prefs = await rosterPreferenceService.getMyPreferences(emp.id);
  res.json({ data: prefs });
}));

wfmRouter.get("/roster-preferences/pending", requireAuth, requireRole("admin", "hr", "manager", "wfm"), h(async (_req: any, res: any) => {
  const prefs = await rosterPreferenceService.getPending();
  res.json({ data: prefs });
}));

wfmRouter.patch("/roster-preferences/:id/approve", requireAuth, requireRole("admin", "hr", "manager", "wfm"), h(async (req: any, res: any) => {
  await rosterPreferenceService.approve(req.params.id, req.authUser!.id);
  res.json({ success: true });
}));

wfmRouter.patch("/roster-preferences/:id/reject", requireAuth, requireRole("admin", "hr", "manager", "wfm"), h(async (req: any, res: any) => {
  const { reason } = req.body;
  await rosterPreferenceService.reject(req.params.id, req.authUser!.id, reason || "Rejected");
  res.json({ success: true });
}));
