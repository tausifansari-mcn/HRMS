import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { inboxService } from "./inbox.service.js";

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// GET /count — unread count for caller
router.get("/count", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  const count = await inboxService.getUnreadCount(userId);
  return res.json({ success: true, count });
}));

// GET / — list inbox items scoped to caller
router.get("/", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  const { type, priority, is_read } = req.query as Record<string, string>;
  const items = await inboxService.listItems({ user_id: userId, type, priority, is_read });
  return res.json({ success: true, data: items, total: items.length });
}));

// POST / — create inbox item (admin/hr only — system use)
router.post("/", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { user_id, type, title, description, entity_type, entity_id, action_url, priority } = req.body as Record<string, string>;
  if (!user_id || !type || !title) {
    return res.status(400).json({ success: false, error: "user_id, type, and title are required" });
  }
  const item = await inboxService.createItem({ user_id, type, title, description, entity_type, entity_id, action_url, priority });
  return res.status(201).json({ success: true, data: item });
}));

// PATCH /:id/read — mark item as read (caller's own items only)
router.patch("/:id/read", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  await inboxService.markRead(req.params.id, userId);
  return res.json({ success: true });
}));

// PATCH /:id/actioned — mark item as actioned (caller's own items only)
router.patch("/:id/actioned", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  await inboxService.markActioned(req.params.id, userId);
  return res.json({ success: true });
}));

// PATCH /mark-all-read — mark all unread items as read for caller
router.patch("/mark-all-read", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  await inboxService.markAllRead(userId);
  return res.json({ success: true });
}));

export { router as inboxRouter };
