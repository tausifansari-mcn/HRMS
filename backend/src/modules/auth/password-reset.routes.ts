import { Router } from 'express';
import type { Response, Request } from 'express';
import { db as mysqlDb } from '../../db/mysql.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const router = Router();

/**
 * Request password reset - generates temp code and sends to user
 * POST /api/auth/forgot-password
 * Body: { email: string }
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if user exists
    const [users] = await mysqlDb.execute<any[]>(
      'SELECT id, email FROM auth_user WHERE email = ? AND is_blocked = 0',
      [email.toLowerCase().trim()]
    );

    // ALWAYS return success (don't leak if email exists)
    if (users.length === 0) {
      return res.json({ success: true, message: 'If this email exists, a reset code has been sent' });
    }

    const user = users[0];

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token
    await mysqlDb.execute(`
      INSERT INTO password_reset_tokens (user_id, reset_token, reset_code, expires_at, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [user.id, resetToken, resetCode, expiresAt]);

    // TODO: Send email with reset code
    // For now, return code in response (REMOVE IN PRODUCTION)
    console.log(`[PasswordReset] Code for ${email}: ${resetCode}`);

    return res.json({
      success: true,
      message: 'Reset code sent to your email',
      // TEMP: Remove in production
      debug_code: resetCode,
      debug_token: resetToken,
    });
  } catch (error: any) {
    console.error('[PasswordReset] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

/**
 * Verify reset code and get reset token
 * POST /api/auth/verify-reset-code
 * Body: { email: string, code: string }
 */
router.post('/verify-reset-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    // Find user
    const [users] = await mysqlDb.execute<any[]>(
      'SELECT id FROM auth_user WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid reset code' });
    }

    // Verify code
    const [tokens] = await mysqlDb.execute<any[]>(
      `SELECT reset_token, expires_at
       FROM password_reset_tokens
       WHERE user_id = ? AND reset_code = ? AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [users[0].id, code]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
    }

    const token = tokens[0];

    // Check expiry
    if (new Date() > new Date(token.expires_at)) {
      return res.status(400).json({ success: false, message: 'Reset code expired' });
    }

    return res.json({
      success: true,
      reset_token: token.reset_token,
      message: 'Code verified. You can now reset your password.',
    });
  } catch (error: any) {
    console.error('[PasswordReset] Verify error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify code' });
  }
});

/**
 * Reset password using verified token
 * POST /api/auth/reset-password
 * Body: { reset_token: string, new_password: string }
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { reset_token, new_password } = req.body;

    if (!reset_token || !new_password) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Verify token
    const [tokens] = await mysqlDb.execute<any[]>(
      `SELECT user_id, expires_at
       FROM password_reset_tokens
       WHERE reset_token = ? AND used_at IS NULL
       LIMIT 1`,
      [reset_token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or already used reset token' });
    }

    const tokenData = tokens[0];

    // Check expiry
    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ success: false, message: 'Reset token expired' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await mysqlDb.execute(
      'UPDATE auth_user SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [passwordHash, tokenData.user_id]
    );

    // Mark token as used
    await mysqlDb.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE reset_token = ?',
      [reset_token]
    );

    console.log(`[PasswordReset] Password reset successful for user ${tokenData.user_id}`);

    return res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error: any) {
    console.error('[PasswordReset] Reset error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

export default router;
