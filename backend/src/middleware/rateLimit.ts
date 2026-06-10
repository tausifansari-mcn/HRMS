/**
 * Rate Limiting Middleware for Recruiter PIN Verification
 * Prevents brute-force attacks on PIN authentication
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import db from '../db.js';

/**
 * Rate limiter for PIN verification
 * 5 attempts per 15 minutes per IP
 */
export const pinVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts. Account locked for 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by recruiter code + IP combination
    const recruiterCode = req.body.recruiterCode || req.body.RecruiterCode || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${recruiterCode}:${ip}`;
  },
  handler: async (req: Request, res: Response) => {
    // Log failed attempt and lock account
    const recruiterCode = req.body.recruiterCode || req.body.RecruiterCode;

    if (recruiterCode) {
      try {
        await db.execute(
          `UPDATE ats_recruiter_roster
           SET failed_login_attempts = failed_login_attempts + 1,
               last_failed_login_at = NOW(),
               account_locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
           WHERE recruiter_code = ?`,
          [recruiterCode]
        );
      } catch (error) {
        console.error('[RateLimit] Failed to update failed login attempts:', error);
      }
    }

    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Your account has been locked for 15 minutes. Please try again later.',
      retry_after: 900, // 15 minutes in seconds
      locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }
});

/**
 * Check if recruiter account is locked due to failed attempts
 */
export async function checkAccountLock(recruiterCode: string): Promise<{ locked: boolean; until?: Date }> {
  try {
    const [rows] = await db.execute<any[]>(
      `SELECT account_locked_until, failed_login_attempts
       FROM ats_recruiter_roster
       WHERE recruiter_code = ? AND account_locked_until > NOW()`,
      [recruiterCode]
    );

    if (rows.length > 0) {
      return {
        locked: true,
        until: rows[0].account_locked_until
      };
    }

    return { locked: false };
  } catch (error) {
    console.error('[RateLimit] Error checking account lock:', error);
    return { locked: false }; // Fail open to prevent lockout issues
  }
}

/**
 * Reset failed login attempts on successful authentication
 */
export async function resetLoginAttempts(recruiterCode: string): Promise<void> {
  try {
    await db.execute(
      `UPDATE ats_recruiter_roster
       SET failed_login_attempts = 0,
           last_failed_login_at = NULL,
           account_locked_until = NULL
       WHERE recruiter_code = ?`,
      [recruiterCode]
    );
  } catch (error) {
    console.error('[RateLimit] Error resetting login attempts:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Increment failed login attempts
 */
export async function incrementFailedAttempts(recruiterCode: string): Promise<number> {
  try {
    await db.execute(
      `UPDATE ats_recruiter_roster
       SET failed_login_attempts = failed_login_attempts + 1,
           last_failed_login_at = NOW()
       WHERE recruiter_code = ?`,
      [recruiterCode]
    );

    // Get current count
    const [rows] = await db.execute<any[]>(
      `SELECT failed_login_attempts FROM ats_recruiter_roster WHERE recruiter_code = ?`,
      [recruiterCode]
    );

    return rows[0]?.failed_login_attempts || 0;
  } catch (error) {
    console.error('[RateLimit] Error incrementing failed attempts:', error);
    return 0;
  }
}
