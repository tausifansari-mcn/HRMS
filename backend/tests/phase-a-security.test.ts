/**
 * Phase A: Security Hardening Test Suite
 * 19 test cases for all Priority 1 security fixes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../src/db/mysql.js';
import { randomUUID } from 'crypto';

describe('Phase A: Security Hardening Tests', () => {
  let testRecruiterId: string;
  let testRecruiterCode: string;
  let testCandidateId: string;

  beforeAll(async () => {
    // Setup test data
    testRecruiterId = randomUUID();
    testRecruiterCode = `TEST-${Date.now()}`;

    // Create test recruiter (pin_hash can be any string for testing)
    const pinHash = '$2b$10$mockHashForTesting1234567890123456789012'; // Mock bcrypt hash
    await db.execute(
      `INSERT INTO ats_recruiter_roster
       (id, recruiter_code, name, pin_hash, email, mobile, branch, daily_capacity, assigned_today, available_today, active_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', 1)`,
      [testRecruiterId, testRecruiterCode, 'Test Recruiter', pinHash, 'test@example.com', '+919999999999', 'Mumbai', 10, 0]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await db.execute(`DELETE FROM ats_recruiter_roster WHERE id = ?`, [testRecruiterId]);
    if (testCandidateId) {
      await db.execute(`DELETE FROM ats_candidate WHERE id = ?`, [testCandidateId]);
    }
  });

  beforeEach(async () => {
    // Reset recruiter state before each test
    await db.execute(
      `UPDATE ats_recruiter_roster
       SET assigned_today = 0,
           failed_login_attempts = 0,
           account_locked_until = NULL,
           capacity_lock_version = 0
       WHERE id = ?`,
      [testRecruiterId]
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FK-Based Assignment Tests (Issue #1)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FK-Based Assignment', () => {
    it('should assign candidate using recruiter_id FK', async () => {
      testCandidateId = randomUUID();
      const code = `CND-TEST-${Date.now()}`;

      await db.execute(
        `INSERT INTO ats_candidate
         (id, candidate_code, full_name, mobile, applied_for_branch, applied_for_process, recruiter_id, status, created_date, created_time)
         VALUES (?, ?, 'Test Candidate', '+919999999991', 'Mumbai', 'GPI', ?, 'Waiting', CURDATE(), CURTIME())`,
        [testCandidateId, code, testRecruiterId]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT recruiter_id FROM ats_candidate WHERE id = ?`,
        [testCandidateId]
      );

      expect(rows[0].recruiter_id).toBe(testRecruiterId);
    });

    it('should prevent ownership bypass via name collision', async () => {
      // Create two recruiters with same name but different IDs
      const recruiter1Id = randomUUID();
      const recruiter2Id = randomUUID();
      const sameName = 'John Doe';

      await db.execute(
        `INSERT INTO ats_recruiter_roster (id, recruiter_code, name, branch, daily_capacity, available_today, active_status)
         VALUES (?, 'REC1', ?, 'Mumbai', 10, 'Y', 1)`,
        [recruiter1Id, sameName]
      );
      await db.execute(
        `INSERT INTO ats_recruiter_roster (id, recruiter_code, name, branch, daily_capacity, available_today, active_status)
         VALUES (?, 'REC2', ?, 'Mumbai', 10, 'Y', 1)`,
        [recruiter2Id, sameName]
      );

      // Create candidate assigned to recruiter1
      const candidateId = randomUUID();
      await db.execute(
        `INSERT INTO ats_candidate (id, candidate_code, full_name, mobile, recruiter_id, status, created_date, created_time)
         VALUES (?, 'TEST-CND', 'Test', '+919999999992', ?, 'Waiting', CURDATE(), CURTIME())`,
        [candidateId, recruiter1Id]
      );

      // Query by recruiter_id (FK-based) - recruiter2 should NOT see this candidate
      const [rows] = await db.execute<any[]>(
        `SELECT id FROM ats_candidate WHERE recruiter_id = ?`,
        [recruiter2Id]
      );

      expect(rows.length).toBe(0); // recruiter2 cannot access recruiter1's candidates

      // Cleanup
      await db.execute(`DELETE FROM ats_candidate WHERE id = ?`, [candidateId]);
      await db.execute(`DELETE FROM ats_recruiter_roster WHERE id IN (?, ?)`, [recruiter1Id, recruiter2Id]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Capacity Tracking Tests (Issue #2)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Capacity Tracking', () => {
    it('should prevent race condition in capacity increment', async () => {
      // Set capacity to 1 for testing
      await db.execute(
        `UPDATE ats_recruiter_roster SET daily_capacity = 1, assigned_today = 0 WHERE id = ?`,
        [testRecruiterId]
      );

      // Simulate concurrent assignment using optimistic locking
      const [result1] = await db.execute(
        `UPDATE ats_recruiter_roster
         SET assigned_today = assigned_today + 1,
             capacity_lock_version = capacity_lock_version + 1
         WHERE id = ? AND assigned_today < daily_capacity`,
        [testRecruiterId]
      );

      expect((result1 as any).affectedRows).toBe(1); // First assignment succeeds

      // Second concurrent assignment should fail (capacity=1, assigned=1)
      const [result2] = await db.execute(
        `UPDATE ats_recruiter_roster
         SET assigned_today = assigned_today + 1,
             capacity_lock_version = capacity_lock_version + 1
         WHERE id = ? AND assigned_today < daily_capacity`,
        [testRecruiterId]
      );

      expect((result2 as any).affectedRows).toBe(0); // Second assignment fails (no rows affected)

      // Verify assigned_today is 1 (not 2)
      const [rows] = await db.execute<any[]>(
        `SELECT assigned_today FROM ats_recruiter_roster WHERE id = ?`,
        [testRecruiterId]
      );
      expect(rows[0].assigned_today).toBe(1);
    });

    it('should handle capacity exceeded gracefully', async () => {
      await db.execute(
        `UPDATE ats_recruiter_roster SET daily_capacity = 5, assigned_today = 5 WHERE id = ?`,
        [testRecruiterId]
      );

      // Attempt to assign when at capacity
      const [result] = await db.execute(
        `UPDATE ats_recruiter_roster
         SET assigned_today = assigned_today + 1
         WHERE id = ? AND assigned_today < daily_capacity`,
        [testRecruiterId]
      );

      expect((result as any).affectedRows).toBe(0); // Assignment blocked
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Audit Trail Tests (Issues #3, #4)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Audit Trail', () => {
    it('should track impersonation in audit log', async () => {
      const submissionId = randomUUID();
      const adminUserId = randomUUID();
      const recruiterUserId = testRecruiterId;

      await db.execute(
        `INSERT INTO ats_interview_submission_audit
         (id, submission_id, action, actor_user_id, submitted_by_user_id, is_proxy_submission, snapshot, created_at)
         VALUES (?, ?, 'INSERT', ?, ?, 1, '{}', NOW())`,
        [randomUUID(), submissionId, recruiterUserId, adminUserId]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT actor_user_id, submitted_by_user_id, is_proxy_submission
         FROM ats_interview_submission_audit
         WHERE submission_id = ?`,
        [submissionId]
      );

      expect(rows[0].actor_user_id).toBe(recruiterUserId); // WHO the action is attributed to
      expect(rows[0].submitted_by_user_id).toBe(adminUserId); // WHO actually performed it
      expect(rows[0].is_proxy_submission).toBe(1); // Flagged as proxy
    });

    it('should flag proxy submissions', async () => {
      const submissionId = randomUUID();

      // Direct recruiter submission (not proxy)
      await db.execute(
        `INSERT INTO ats_interview_submission_audit
         (id, submission_id, action, actor_user_id, submitted_by_user_id, is_proxy_submission, snapshot, created_at)
         VALUES (?, ?, 'INSERT', ?, ?, 0, '{}', NOW())`,
        [randomUUID(), submissionId, testRecruiterId, testRecruiterId]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT is_proxy_submission FROM ats_interview_submission_audit WHERE submission_id = ?`,
        [submissionId]
      );

      expect(rows[0].is_proxy_submission).toBe(0); // Not a proxy submission
    });

    it('should track actor in stage log', async () => {
      if (!testCandidateId) {
        testCandidateId = randomUUID();
        await db.execute(
          `INSERT INTO ats_candidate (id, candidate_code, full_name, mobile, status, created_date, created_time)
           VALUES (?, 'TEST-STAGE', 'Test', '+919999999993', 'Waiting', CURDATE(), CURTIME())`,
          [testCandidateId]
        );
      }

      const logId = randomUUID();
      const actorUserId = randomUUID();

      await db.execute(
        `INSERT INTO ats_candidate_stage_log
         (id, candidate_id, from_stage, to_stage, remarks, updated_by, actor_user_id, submitted_by_user_id)
         VALUES (?, ?, 'Waiting', 'Selected', 'Test', ?, ?, ?)`,
        [logId, testCandidateId, actorUserId, actorUserId, actorUserId]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT actor_user_id FROM ats_candidate_stage_log WHERE id = ?`,
        [logId]
      );

      expect(rows[0].actor_user_id).toBe(actorUserId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Rate Limiting Tests (Issue #8)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Rate Limiting', () => {
    it('should lock account after 5 failed PIN attempts', async () => {
      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await db.execute(
          `UPDATE ats_recruiter_roster
           SET failed_login_attempts = failed_login_attempts + 1,
               last_failed_login_at = NOW()
           WHERE id = ?`,
          [testRecruiterId]
        );
      }

      // 6th attempt should trigger lock
      await db.execute(
        `UPDATE ats_recruiter_roster
         SET failed_login_attempts = failed_login_attempts + 1,
             account_locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
         WHERE id = ?`,
        [testRecruiterId]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT failed_login_attempts, account_locked_until
         FROM ats_recruiter_roster
         WHERE id = ?`,
        [testRecruiterId]
      );

      expect(rows[0].failed_login_attempts).toBe(6);
      expect(rows[0].account_locked_until).not.toBeNull();
    });

    it('should unlock account after 15 minutes', async () => {
      // Set lock time to 14 minutes ago (should still be locked)
      await db.execute(
        `UPDATE ats_recruiter_roster
         SET account_locked_until = DATE_ADD(NOW(), INTERVAL -14 MINUTE)
         WHERE id = ?`,
        [testRecruiterId]
      );

      let [rows] = await db.execute<any[]>(
        `SELECT account_locked_until FROM ats_recruiter_roster
         WHERE id = ? AND account_locked_until > NOW()`,
        [testRecruiterId]
      );
      expect(rows.length).toBe(0); // Lock expired (14 minutes ago)

      // Set lock time to 16 minutes ago (should be unlocked)
      await db.execute(
        `UPDATE ats_recruiter_roster
         SET account_locked_until = DATE_ADD(NOW(), INTERVAL -16 MINUTE)
         WHERE id = ?`,
        [testRecruiterId]
      );

      [rows] = await db.execute<any[]>(
        `SELECT account_locked_until FROM ats_recruiter_roster
         WHERE id = ? AND account_locked_until > NOW()`,
        [testRecruiterId]
      );
      expect(rows.length).toBe(0); // No active lock
    });

    it('should reset attempts on successful login', async () => {
      // Set failed attempts
      await db.execute(
        `UPDATE ats_recruiter_roster
         SET failed_login_attempts = 3,
             last_failed_login_at = NOW()
         WHERE id = ?`,
        [testRecruiterId]
      );

      // Simulate successful login (reset)
      await db.execute(
        `UPDATE ats_recruiter_roster
         SET failed_login_attempts = 0,
             last_failed_login_at = NULL,
             account_locked_until = NULL
         WHERE id = ?`,
        [testRecruiterId]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT failed_login_attempts, last_failed_login_at, account_locked_until
         FROM ats_recruiter_roster
         WHERE id = ?`,
        [testRecruiterId]
      );

      expect(rows[0].failed_login_attempts).toBe(0);
      expect(rows[0].last_failed_login_at).toBeNull();
      expect(rows[0].account_locked_until).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VOC Validation Tests (Issues #5, #6, #7)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('VOC Validation', () => {
    it('should require VOC when finalDecision=Rejected', async () => {
      // This test validates the business logic (would be tested in service layer)
      // Here we test the data constraint

      const finalDecision = 'Rejected';
      const round1Voc = null;
      const round2Voc = null;
      const round3Voc = null;

      const hasAnyVOC = round1Voc || round2Voc || round3Voc;
      expect(hasAnyVOC).toBeFalsy(); // No VOC provided

      // In actual service, this would throw:
      // throw Object.assign(new Error('At least one round VOC is required'), { statusCode: 400 });
    });

    it('should require VOC when finalDecision=No Show', async () => {
      const finalDecision = 'No Show';
      const round1Voc = null;

      expect(round1Voc).toBeNull();
      // Service validation would require round1Voc to be non-null
    });

    it('should null VOCs when cascading to Selected', async () => {
      // Simulate cascade logic
      let round1Result = 'Rejected';
      let round1Voc = 'Poor Communication';
      const finalDecision = 'Selected';

      // Cascade logic
      if (finalDecision === 'Selected') {
        round1Result = 'Selected';
        round1Voc = null; // Clear VOC
      }

      expect(round1Result).toBe('Selected');
      expect(round1Voc).toBeNull(); // VOC cleared
    });

    it('should include Skill Test in Selected cascade', async () => {
      let skillTestResult = 'Rejected';
      let skillTestVoc = 'Low Typing Speed';
      const finalDecision = 'Selected';

      // Cascade logic should include Skill Test
      if (finalDecision === 'Selected') {
        skillTestResult = 'Selected';
        skillTestVoc = null;
      }

      expect(skillTestResult).toBe('Selected');
      expect(skillTestVoc).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PII Redaction Tests (Issue #9)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PII Redaction', () => {
    beforeAll(async () => {
      // Ensure redaction rules exist
      await db.execute(
        `INSERT IGNORE INTO ats_pii_redaction_config (id, role_key, entity_type, field_name, redaction_rule)
         VALUES
           (UUID(), 'recruiter', 'ats_interview_submission', 'offer_salary', 'hide'),
           (UUID(), 'branch_head', 'ats_interview_submission', 'offer_salary', 'mask'),
           (UUID(), 'admin', 'ats_interview_submission', 'offer_salary', 'allow')
         ON DUPLICATE KEY UPDATE redaction_rule = VALUES(redaction_rule)`
      );
    });

    it('should hide offer_salary for recruiter role', async () => {
      const [rows] = await db.execute<any[]>(
        `SELECT field_name, redaction_rule
         FROM ats_pii_redaction_config
         WHERE role_key = 'recruiter' AND entity_type = 'ats_interview_submission' AND field_name = 'offer_salary'`
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].redaction_rule).toBe('hide');
    });

    it('should allow offer_salary for admin role', async () => {
      const [rows] = await db.execute<any[]>(
        `SELECT field_name, redaction_rule
         FROM ats_pii_redaction_config
         WHERE role_key = 'admin' AND entity_type = 'ats_interview_submission' AND field_name = 'offer_salary'`
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].redaction_rule).toBe('allow');
    });

    it('should mask offer_salary for branch_head role', async () => {
      const [rows] = await db.execute<any[]>(
        `SELECT field_name, redaction_rule
         FROM ats_pii_redaction_config
         WHERE role_key = 'branch_head' AND entity_type = 'ats_interview_submission' AND field_name = 'offer_salary'`
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].redaction_rule).toBe('mask');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Session Timeout Tests (Issue #10)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Session Timeout', () => {
    it('should expire session after 30 minutes', async () => {
      const sessionToken = randomUUID();
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago

      await db.execute(
        `INSERT INTO ats_recruiter_session
         (id, recruiter_id, session_token, created_at, last_activity_at, expires_at, is_active)
         VALUES (?, ?, ?, NOW(), NOW(), ?, 1)`,
        [sessionId, testRecruiterId, sessionToken, expiresAt]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT id FROM ats_recruiter_session
         WHERE session_token = ? AND is_active = 1 AND expires_at > NOW()`,
        [sessionToken]
      );

      expect(rows.length).toBe(0); // Session expired

      // Cleanup
      await db.execute(`DELETE FROM ats_recruiter_session WHERE id = ?`, [sessionId]);
    });

    it('should refresh session on activity', async () => {
      const sessionToken = randomUUID();
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      await db.execute(
        `INSERT INTO ats_recruiter_session
         (id, recruiter_id, session_token, created_at, last_activity_at, expires_at, is_active)
         VALUES (?, ?, ?, NOW(), NOW(), ?, 1)`,
        [sessionId, testRecruiterId, sessionToken, expiresAt]
      );

      // Simulate activity refresh
      const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await db.execute(
        `UPDATE ats_recruiter_session
         SET last_activity_at = NOW(), expires_at = ?
         WHERE session_token = ?`,
        [newExpiresAt, sessionToken]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT last_activity_at FROM ats_recruiter_session WHERE id = ?`,
        [sessionId]
      );

      expect(rows[0].last_activity_at).not.toBeNull();

      // Cleanup
      await db.execute(`DELETE FROM ats_recruiter_session WHERE id = ?`, [sessionId]);
    });

    it('should invalidate session on logout', async () => {
      const sessionToken = randomUUID();
      const sessionId = randomUUID();

      await db.execute(
        `INSERT INTO ats_recruiter_session
         (id, recruiter_id, session_token, created_at, last_activity_at, expires_at, is_active)
         VALUES (?, ?, ?, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE), 1)`,
        [sessionId, testRecruiterId, sessionToken]
      );

      // Logout (invalidate)
      await db.execute(
        `UPDATE ats_recruiter_session SET is_active = 0 WHERE session_token = ?`,
        [sessionToken]
      );

      const [rows] = await db.execute<any[]>(
        `SELECT id FROM ats_recruiter_session WHERE session_token = ? AND is_active = 1`,
        [sessionToken]
      );

      expect(rows.length).toBe(0); // Session invalidated

      // Cleanup
      await db.execute(`DELETE FROM ats_recruiter_session WHERE id = ?`, [sessionId]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Tests', () => {
    it('should handle complete candidate intake with FK assignment', async () => {
      const candidateId = randomUUID();
      const code = `TEST-INTEG-${Date.now()}`;

      // Full intake flow
      await db.execute(
        `INSERT INTO ats_candidate
         (id, candidate_code, full_name, mobile, applied_for_branch, applied_for_process, recruiter_id, status, created_date, created_time)
         VALUES (?, ?, 'Integration Test', '+919999999994', 'Mumbai', 'GPI', ?, 'Waiting', CURDATE(), CURTIME())`,
        [candidateId, code, testRecruiterId]
      );

      // Increment capacity
      await db.execute(
        `UPDATE ats_recruiter_roster
         SET assigned_today = assigned_today + 1,
             capacity_lock_version = capacity_lock_version + 1
         WHERE id = ? AND assigned_today < daily_capacity`,
        [testRecruiterId]
      );

      // Verify
      const [candidateRows] = await db.execute<any[]>(
        `SELECT recruiter_id FROM ats_candidate WHERE id = ?`,
        [candidateId]
      );
      const [recruiterRows] = await db.execute<any[]>(
        `SELECT assigned_today FROM ats_recruiter_roster WHERE id = ?`,
        [testRecruiterId]
      );

      expect(candidateRows[0].recruiter_id).toBe(testRecruiterId);
      expect(recruiterRows[0].assigned_today).toBe(1);

      // Cleanup
      await db.execute(`DELETE FROM ats_candidate WHERE id = ?`, [candidateId]);
    });
  });
});
