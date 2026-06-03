import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import {
  getBgvStatusByToken,
  getBgvStatusForCandidate,
  listBgvQueue,
  manualReview,
  providerCallback,
  saveBgvConsentByToken,
  startDigilockerByToken,
  verifyAadhaarOfflineByToken,
  verifyBankByToken,
  verifyBankForCandidate,
  verifyPanByToken,
  verifyPanForCandidate,
  waiveCheck,
} from "./bgv-verification.service.js";

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get("user-agent") ?? undefined });

// Public token-driven candidate BGV routes. Mount before global requireAuth.
router.post("/consent", h(async (req, res) => {
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ success: false, message: "token required" });
  return res.status(201).json({ success: true, data: await saveBgvConsentByToken(token, req.body, meta(req)) });
}));

router.get("/status", h(async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) return res.status(400).json({ success: false, message: "token required" });
  return res.json({ success: true, data: await getBgvStatusByToken(token) });
}));

router.post("/verify/pan", h(async (req, res) => {
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ success: false, message: "token required" });
  return res.json({ success: true, data: await verifyPanByToken(token, req.body, meta(req)) });
}));

router.post("/verify/bank", h(async (req, res) => {
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ success: false, message: "token required" });
  return res.json({ success: true, data: await verifyBankByToken(token, req.body, meta(req)) });
}));

router.post("/verify/aadhaar-offline", h(async (req, res) => {
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ success: false, message: "token required" });
  return res.json({ success: true, data: await verifyAadhaarOfflineByToken(token, req.body, meta(req)) });
}));

router.post("/digilocker/start", h(async (req, res) => {
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ success: false, message: "token required" });
  return res.json({ success: true, data: await startDigilockerByToken(token, Array.isArray(req.body.requestedDocuments) ? req.body.requestedDocuments : [], meta(req)) });
}));

router.post("/provider/callback", h(async (req, res) => {
  return res.json({ success: true, data: await providerCallback(req.body) });
}));

// HR/BGV/Admin protected routes
router.get("/queue", requireAuth, requireRole("admin", "hr", "recruiter"), h(async (req: AuthenticatedRequest, res) => {
  return res.json({ success: true, data: await listBgvQueue(req.query.status as string | undefined) });
}));

router.get("/candidates/:candidateId", requireAuth, requireRole("admin", "hr", "recruiter"), h(async (req: AuthenticatedRequest, res) => {
  return res.json({ success: true, data: await getBgvStatusForCandidate(req.params.candidateId) });
}));

router.post("/candidates/:candidateId/verify/pan", requireAuth, requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res) => {
  return res.json({ success: true, data: await verifyPanForCandidate(req.params.candidateId, req.body, { actorType: "hr", actorId: req.authUser!.id }) });
}));

router.post("/candidates/:candidateId/verify/bank", requireAuth, requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res) => {
  return res.json({ success: true, data: await verifyBankForCandidate(req.params.candidateId, req.body, { actorType: "hr", actorId: req.authUser!.id }) });
}));

router.post("/candidates/:candidateId/manual-review", requireAuth, requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res) => {
  if (!req.body.remarks) return res.status(400).json({ success: false, message: "remarks required" });
  return res.json({ success: true, data: await manualReview(req.params.candidateId, req.body, req.authUser!.id) });
}));

router.post("/candidates/:candidateId/waive", requireAuth, requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res) => {
  if (!req.body.reason) return res.status(400).json({ success: false, message: "reason required" });
  return res.json({ success: true, data: await waiveCheck(req.params.candidateId, req.body, req.authUser!.id) });
}));

export default router;
