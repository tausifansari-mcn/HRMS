import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireRole } from '../../middleware/requireRole.js';
import { reportingService } from './reporting.service.js';

const router = Router();
const h = (fn: any) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.get('/', requireAuth, requireRole('admin', 'hr', 'ceo'), h(async (_req: any, res: any) => {
  const reports = await reportingService.listReports();
  res.json({ data: reports });
}));

router.post('/:code/run', requireAuth, requireRole('admin', 'hr', 'ceo'), h(async (req: any, res: any) => {
  const filters = req.body.filters || {};
  const result = await reportingService.runReport(req.params.code, filters);
  res.json({ data: result });
}));

export { router as reportingRouter };
