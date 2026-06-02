import { Router } from 'express';
import { authService } from './auth.service.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (fn: any) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// POST /api/auth/login — public
// Accepts: { identifier: "email or employee code", password } OR legacy { email, password }
router.post('/login', h(async (req: any, res: any) => {
  const identifier = req.body.identifier || req.body.email;
  const { password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'identifier (email or employee code) and password required' });
  try {
    const tokens = await authService.login(identifier, password);
    res.json({ data: tokens });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
}));

// POST /api/auth/register — public
router.post('/register', h(async (req: any, res: any) => {
  const { email, password, onboardingToken } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'email and password (min 6 chars) required' });
  }
  try {
    let userId: string;
    if (onboardingToken) {
      userId = await authService.registerFromATS(email, password, String(onboardingToken));
    } else {
      userId = await authService.register(email, password);
    }
    res.status(201).json({ ok: true, userId });
  } catch (err: any) {
    if (err.message?.includes('Duplicate entry')) return res.status(409).json({ error: 'Email already registered' });
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
}));

// POST /api/auth/refresh — public
router.post('/refresh', h(async (req: any, res: any) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  try {
    const tokens = await authService.refreshAccess(refreshToken);
    res.json({ data: tokens });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}));

// POST /api/auth/logout — requires auth
router.post('/logout', requireAuth, h(async (req: any, res: any) => {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  res.json({ success: true });
}));

// POST /api/auth/forgot-password — public
router.post('/forgot-password', h(async (req: any, res: any) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const token = await authService.forgotPassword(email);
  if (token) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    // TODO: replace console.log with nodemailer in production
    console.log('[DEV] Password reset URL:', resetUrl);
  }
  // Always return success to prevent email enumeration
  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
}));

// POST /api/auth/reset-password — public
router.post('/reset-password', h(async (req: any, res: any) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
  try {
    await authService.resetPassword(token, password);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}));

export { router as authRouter };
