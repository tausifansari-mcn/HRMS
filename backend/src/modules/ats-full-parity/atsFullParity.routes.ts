import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { atsFullParityService as svc } from "./atsFullParity.service.js";

export const atsFullParityRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Public parity endpoints: equivalent to App Script candidate-facing forms.
atsFullParityRouter.post("/intake", h(async (req, res) => {
  const data = await svc.createIntake(req.body, "PUBLIC_FORM");
  res.status(201).json({ success: true, data, message: "Candidate intake captured" });
}));

atsFullParityRouter.post("/candidate-confirmation", h(async (req, res) => {
  const data = await svc.submitConfirmation(req.body);
  res.status(201).json({ success: true, data });
}));

atsFullParityRouter.post("/bgv", h(async (req, res) => {
  const data = await svc.submitBgv(req.body);
  res.status(201).json({ success: true, data });
}));

atsFullParityRouter.post("/doc-upload-response", h(async (req, res) => {
  const data = await svc.submitDocUpload(req.body);
  res.status(201).json({ success: true, data });
}));

atsFullParityRouter.post("/recruiter-devices", h(async (req, res) => {
  const data = await svc.registerDevice(req.body);
  res.status(201).json({ success: true, data });
}));

// Protected command center endpoints.
atsFullParityRouter.use(requireAuth);

atsFullParityRouter.get("/web-data", requireRole("admin", "hr", "recruiter", "manager", "branch_head", "process_manager", "ceo"), h(async (req, res) => {
  const data = await svc.webData(req.query as any);
  res.json(data);
}));

atsFullParityRouter.get("/queue", requireRole("admin", "hr", "recruiter", "manager", "branch_head", "process_manager", "ceo"), h(async (_req, res) => {
  const data = await svc.webData({ period: "ALL" });
  res.json({ success: true, data: data.queueRows });
}));

atsFullParityRouter.get("/journey", requireRole("admin", "hr", "recruiter", "manager", "branch_head", "process_manager", "ceo"), h(async (req, res) => {
  const query = String(req.query.query || "").trim();
  if (!query) return res.status(400).json({ success: false, message: "query required" });
  const data = await svc.candidateJourney(query);
  if (!data) return res.status(404).json({ success: false, message: "Candidate not found" });
  res.json({ success: true, data });
}));

atsFullParityRouter.post("/recruiter-submission", requireRole("admin", "hr", "recruiter", "manager"), h(async (req: any, res) => {
  const data = await svc.submitRecruiterUpdate(req.body, req.authUser?.id);
  res.json({ success: true, data, message: "Recruiter submission consolidated" });
}));

atsFullParityRouter.post("/jobs/sla-check", requireRole("admin", "hr"), h(async (_req, res) => {
  const data = await svc.checkSlaBreaches();
  res.json({ success: true, data });
}));

atsFullParityRouter.post("/jobs/recruiters/reset-load", requireRole("admin", "hr"), h(async (_req, res) => {
  const data = await svc.resetRecruiterDailyLoad();
  res.json({ success: true, data });
}));

atsFullParityRouter.post("/jobs/repair", requireRole("admin", "hr"), h(async (req, res) => {
  const limit = req.body?.limit ? Number(req.body.limit) : 200;
  const data = await svc.repairBatch(limit);
  res.json({ success: true, data });
}));

atsFullParityRouter.get("/daily-report/snapshot", requireRole("admin", "hr", "branch_head", "process_manager", "ceo"), h(async (req, res) => {
  const mode = req.query.mode === "send" ? "send" : "preview";
  const data = await svc.dailyReportSnapshot(mode);
  res.json({ success: true, data });
}));

atsFullParityRouter.post("/daily-report/send", requireRole("admin", "hr"), h(async (_req, res) => {
  const data = await svc.dailyReportSnapshot("send");
  res.json({ success: true, data });
}));

atsFullParityRouter.get("/health", requireRole("admin", "hr", "ceo"), h(async (_req, res) => {
  const data = await svc.healthCheck();
  res.json({ success: true, data });
}));
