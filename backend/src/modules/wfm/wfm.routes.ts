import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { wfmController } from "./wfm.controller.js";
import { getLiveTracker } from "./liveTracker.service.js";

export const wfmRouter = Router();
wfmRouter.use(requireAuth);

const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Shifts
wfmRouter.get("/shifts",          h(wfmController.listShifts.bind(wfmController)));
wfmRouter.post("/shifts",         h(wfmController.createShift.bind(wfmController)));
wfmRouter.get("/shifts/:id",      h(wfmController.getShift.bind(wfmController)));
wfmRouter.put("/shifts/:id",      h(wfmController.updateShift.bind(wfmController)));

// Attendance sessions
wfmRouter.post("/sessions/clock-in",  h(wfmController.clockIn.bind(wfmController)));
wfmRouter.post("/sessions/clock-out", h(wfmController.clockOut.bind(wfmController)));
wfmRouter.get("/sessions",            h(wfmController.listSessions.bind(wfmController)));
wfmRouter.post("/sessions/break",     h(wfmController.logBreak.bind(wfmController)));

// Regularization
wfmRouter.post("/regularizations",              h(wfmController.submitRegularization.bind(wfmController)));
wfmRouter.get("/regularizations",               h(wfmController.listRegularizations.bind(wfmController)));
wfmRouter.patch("/regularizations/:id/review",  h(wfmController.reviewRegularization.bind(wfmController)));

// Live tracker
wfmRouter.get("/live", async (req: any, res: any, next: any) => {
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
