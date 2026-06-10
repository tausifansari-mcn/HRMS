/**
 * Session Timeout Service
 * Manages recruiter session lifecycle with 30-minute idle timeout
 */

import { randomUUID } from 'crypto';
import db from '../db.js';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class SessionService {
  /**
   * Create new session for recruiter
   */
  async create(
    recruiterId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);

    try {
      await db.execute(
        `INSERT INTO ats_recruiter_session
         (id, recruiter_id, session_token, created_at, last_activity_at, expires_at, ip_address, user_agent, is_active)
         VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, 1)`,
        [randomUUID(), recruiterId, sessionToken, expiresAt, ipAddress || null, userAgent || null]
      );

      return sessionToken;
    } catch (error) {
      console.error('[Session] Error creating session:', error);
      throw error;
    }
  }

  /**
   * Validate and refresh session
   * Returns true if session is valid, false if expired or not found
   */
  async validate(sessionToken: string): Promise<boolean> {
    try {
      const [rows] = await db.execute<any[]>(
        `SELECT id, recruiter_id, expires_at, is_active
         FROM ats_recruiter_session
         WHERE session_token = ? AND is_active = 1`,
        [sessionToken]
      );

      if (rows.length === 0) {
        return false; // Session not found
      }

      const session = rows[0];
      const now = new Date();
      const expiresAt = new Date(session.expires_at);

      if (now > expiresAt) {
        // Session expired
        await this.invalidate(sessionToken);
        return false;
      }

      // Session valid - refresh activity and expiration
      const newExpiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);
      await db.execute(
        `UPDATE ats_recruiter_session
         SET last_activity_at = NOW(),
             expires_at = ?
         WHERE session_token = ?`,
        [newExpiresAt, sessionToken]
      );

      return true;
    } catch (error) {
      console.error('[Session] Error validating session:', error);
      return false; // Fail closed - treat error as invalid session
    }
  }

  /**
   * Get session info
   */
  async getSession(sessionToken: string): Promise<any | null> {
    try {
      const [rows] = await db.execute<any[]>(
        `SELECT id, recruiter_id, created_at, last_activity_at, expires_at, is_active
         FROM ats_recruiter_session
         WHERE session_token = ?`,
        [sessionToken]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('[Session] Error getting session:', error);
      return null;
    }
  }

  /**
   * Invalidate session (logout)
   */
  async invalidate(sessionToken: string): Promise<void> {
    try {
      await db.execute(
        `UPDATE ats_recruiter_session
         SET is_active = 0
         WHERE session_token = ?`,
        [sessionToken]
      );
    } catch (error) {
      console.error('[Session] Error invalidating session:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Invalidate all sessions for a recruiter (force logout)
   */
  async invalidateAll(recruiterId: string): Promise<number> {
    try {
      const [result] = await db.execute(
        `UPDATE ats_recruiter_session
         SET is_active = 0
         WHERE recruiter_id = ? AND is_active = 1`,
        [recruiterId]
      );

      return (result as any).affectedRows || 0;
    } catch (error) {
      console.error('[Session] Error invalidating all sessions:', error);
      return 0;
    }
  }

  /**
   * Get active session count for recruiter
   */
  async getActiveSessionCount(recruiterId: string): Promise<number> {
    try {
      const [rows] = await db.execute<any[]>(
        `SELECT COUNT(*) as count
         FROM ats_recruiter_session
         WHERE recruiter_id = ? AND is_active = 1 AND expires_at > NOW()`,
        [recruiterId]
      );

      return rows[0]?.count || 0;
    } catch (error) {
      console.error('[Session] Error getting active session count:', error);
      return 0;
    }
  }

  /**
   * Cleanup expired sessions
   * Should be run periodically (cron job)
   */
  async cleanup(): Promise<number> {
    try {
      const [result] = await db.execute(
        `DELETE FROM ats_recruiter_session
         WHERE expires_at < NOW() OR (is_active = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`
      );

      const deletedCount = (result as any).affectedRows || 0;

      if (deletedCount > 0) {
        console.log(`[Session] Cleaned up ${deletedCount} expired sessions`);
      }

      return deletedCount;
    } catch (error) {
      console.error('[Session] Error cleaning up sessions:', error);
      return 0;
    }
  }

  /**
   * Get all active sessions for a recruiter
   */
  async getActiveSessions(recruiterId: string): Promise<any[]> {
    try {
      const [rows] = await db.execute<any[]>(
        `SELECT id, session_token, created_at, last_activity_at, expires_at, ip_address, user_agent
         FROM ats_recruiter_session
         WHERE recruiter_id = ? AND is_active = 1 AND expires_at > NOW()
         ORDER BY last_activity_at DESC`,
        [recruiterId]
      );

      return rows;
    } catch (error) {
      console.error('[Session] Error getting active sessions:', error);
      return [];
    }
  }
}

export const sessionService = new SessionService();
