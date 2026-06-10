# Phase B: Data Integrity Fixes

**Timeline**: Week 2 (9 hours)  
**Priority**: Priority 2 (High)  
**Status**: ⏸️ PLANNED

---

## Overview

Phase B addresses **7 Priority 2 issues** related to data integrity, queue token management, export capabilities, and state machine enforcement.

---

## Issues to Fix

| # | Issue | Est. Time | Complexity |
|---|-------|-----------|------------|
| 5 | Parallel queue token systems | 2h | Medium |
| 6 | Non-atomic duplicate token check | 1h | Low |
| 7 | Missing token status validation | 1h | Low |
| 14 | Resubmission audit snapshot incomplete | 1h | Low |
| 19 | No status transition state machine | 3h | High |
| 23 | No export capability | 2h | Medium |
| 24 | Admin proxy submissions not flagged | 30m | Low |

**Total**: 10.5 hours (rounded to 9 hours for planning)

---

## Task 1: Queue Token Consolidation (2 hours)

### Problem
Two parallel queue token systems exist:
- **System A**: `ats_queue_token` table (full-featured, unused)
- **System B**: Simple string in `ats_candidate.q_token` (currently used)

### Impact
- Walk-out/re-entry logic broken
- No token status tracking
- Data divergence

### Solution
Consolidate to System A (`ats_queue_token` table)

**Migration 134**:
```sql
-- Migrate existing q_tokens to ats_queue_token table
INSERT INTO ats_queue_token (id, candidate_id, token, arrival_time, current_stage, status, created_at)
SELECT 
  UUID(),
  id,
  q_token,
  TIMESTAMP(created_date, created_time),
  current_stage,
  CASE 
    WHEN status IN ('Selected', 'Rejected') THEN 'completed'
    WHEN status = 'No Show' THEN 'walked_out'
    ELSE 'active'
  END,
  TIMESTAMP(created_date, created_time)
FROM ats_candidate
WHERE q_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ats_queue_token qt WHERE qt.candidate_id = ats_candidate.id
  );
```

**Service Updates**:
```typescript
// atsFullParity.service.ts - intake() function
// BEFORE:
const qToken = await this.nextQueueToken(branch);

// AFTER:
import { createQueueToken } from '../ats/ats.queue.service.js';
const qToken = await createQueueToken(id, branch); // Uses ats_queue_token table
```

**Files to Update**:
- `backend/sql/134_queue_token_consolidation.sql`
- `backend/src/modules/ats-full-parity/atsFullParity.service.ts`
- `backend/src/modules/ats/ats.queue.service.ts`

---

## Task 2: Unique Token Constraint (1 hour)

### Problem
Non-atomic duplicate check allows concurrent token creation race condition

### Solution
Add unique partial index at database level

**Migration 134 (continued)**:
```sql
-- MySQL 8.0+ partial index
ALTER TABLE ats_queue_token
ADD UNIQUE INDEX uq_candidate_active_token (candidate_id, status)
WHERE status = 'active';

-- MySQL 5.7 workaround (functional index)
ALTER TABLE ats_queue_token
ADD UNIQUE INDEX uq_candidate_active 
  (candidate_id, (CASE WHEN status='active' THEN 1 ELSE NULL END));
```

**Application-Level Enforcement** (MySQL 5.7):
```typescript
// ats.queue.service.ts - createQueueToken()
try {
  await db.execute(
    `INSERT INTO ats_queue_token (...) VALUES (...)`,
    [...]
  );
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw Object.assign(
      new Error('Candidate already has an active queue token'),
      { statusCode: 409 }
    );
  }
  throw error;
}
```

---

## Task 3: Token Status Validation (1 hour)

### Problem
Interview submissions accepted for walked-out or completed tokens

### Solution
Join with `ats_queue_token` and validate `status='active'`

**Service Update**:
```typescript
// atsFullParity.service.ts - submitRecruiterUpdate()
// BEFORE:
const rows = await candidateSelect(
  candidateId ? `(c.id = ? OR c.candidate_code = ?)` : `c.q_token = ?`,
  candidateId ? [candidateId, candidateId] : [qToken]
);

// AFTER:
const rows = await candidateSelect(
  candidateId 
    ? `(c.id = ? OR c.candidate_code = ?)` 
    : `c.q_token = ? AND EXISTS (
         SELECT 1 FROM ats_queue_token qt 
         WHERE qt.token = c.q_token 
           AND qt.status = 'active'
       )`,
  candidateId ? [candidateId, candidateId] : [qToken]
);

// Or add explicit validation after fetch:
if (!candidateId && qToken) {
  const [tokenRows] = await db.execute(
    `SELECT status FROM ats_queue_token WHERE token = ?`,
    [qToken]
  );
  if (tokenRows[0]?.status !== 'active') {
    throw Object.assign(
      new Error('Queue token is no longer active (candidate walked out or completed)'),
      { statusCode: 409 }
    );
  }
}
```

---

## Task 4: Resubmission Audit Enhancement (1 hour)

### Problem
Audit snapshot doesn't include resubmission tracking fields (`previous_submitted_time`, `last_walkin_end_stage`, `last_final_decision`)

### Solution
Enhance audit JSON snapshot

**Service Update**:
```typescript
// If using ats_interview_submission table
const snapshot = {
  process: input.interviewedForProcess,
  stages: { walkinEndStage, finalDecision },
  rounds: { round1Result, round2Result, round3Result },
  vocs: { round1Voc, round2Voc, round3Voc },
  recruiterCode: input.recruiterCode,
  
  // ADD: Resubmission metadata
  resubmission: {
    isResubmission: !!previous_submitted_time,
    previousTime: previous_submitted_time,
    lastStage: last_walkin_end_stage,
    lastDecision: last_final_decision,
    stageChanged: last_walkin_end_stage !== walkinEndStage,
    decisionChanged: last_final_decision !== finalDecision
  }
};
```

---

## Task 5: State Machine Documentation & Enforcement (3 hours)

### Problem
No documented state machine for candidate status transitions; invalid transitions possible

### Solution
Document valid transitions and add validation

**State Machine**:
```
Waiting → In Progress → Selected/Rejected/Hold/No Show
            ↓
Selected → Onboarding Sent → Profile Submitted → Offer Created
            ↓
Offer Created → Approved → Onboarded
            ↓
Onboarded → Active Employee

Rejected → [Terminal State]
No Show → [Terminal State]
Hold → Waiting (can be reactivated)
```

**Valid Transitions Matrix**:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Waiting': ['In Progress', 'No Show', 'Hold'],
  'In Progress': ['Waiting', 'Selected', 'Rejected', 'Hold', 'No Show'],
  'Selected': ['Onboarding Sent', 'Hold'],
  'Onboarding Sent': ['Profile Submitted', 'Hold'],
  'Profile Submitted': ['Offer Created', 'Hold'],
  'Offer Created': ['Approved', 'Rejected', 'Hold'],
  'Approved': ['Onboarded', 'Hold'],
  'Onboarded': [], // Terminal
  'Rejected': [], // Terminal
  'No Show': ['Waiting'], // Can re-register
  'Hold': ['Waiting', 'In Progress'], // Can resume
};
```

**Validation Function**:
```typescript
function validateStatusTransition(fromStatus: string, toStatus: string): void {
  const validNext = VALID_TRANSITIONS[fromStatus] || [];
  if (!validNext.includes(toStatus)) {
    throw Object.assign(
      new Error(`Invalid status transition: ${fromStatus} → ${toStatus}. Valid transitions: ${validNext.join(', ')}`),
      { statusCode: 400 }
    );
  }
}

// Apply in submitRecruiterUpdate()
validateStatusTransition(c.status, newStatus);
```

**Migration 134 (continued)**:
```sql
-- Add validation trigger (optional, for strict enforcement)
DELIMITER $$
CREATE TRIGGER validate_candidate_status_transition
BEFORE UPDATE ON ats_candidate
FOR EACH ROW
BEGIN
  -- Define valid transitions
  IF OLD.status = 'Rejected' AND NEW.status != 'Rejected' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Cannot change status from Rejected (terminal state)';
  END IF;
  
  IF OLD.status = 'Onboarded' AND NEW.status != 'Onboarded' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Cannot change status from Onboarded (terminal state)';
  END IF;
  
  -- Add more rules as needed
END$$
DELIMITER ;
```

**Files to Create**:
- `backend/src/utils/stateMachine.ts` (validation logic)
- `docs/CANDIDATE_STATUS_STATE_MACHINE.md` (documentation)

---

## Task 6: Export Capability with Audit (2 hours)

### Problem
No CSV export capability; when added, must be audited

### Solution
Add export endpoint with comprehensive audit logging

**New Route**:
```typescript
// atsFullParity.routes.ts
router.post(
  "/export/submission-history",
  requireRole("admin", "hr", "branch_head"),
  h(async (req: any, res) => {
    const { recruiterCode, fromDate, toDate, format = 'csv' } = req.body;
    
    // Get data
    const rows = await svc.getSubmissionHistoryExport(recruiterCode, fromDate, toDate);
    
    // Apply PII redaction based on role
    const redacted = await piiRedactionService.redactMany(
      rows,
      req.authUser.role,
      'ats_interview_submission'
    );
    
    // Log export action
    await db.execute(
      `INSERT INTO ats_sensitive_action_log 
       (id, actor_user_id, action_type, target_entity, action_details, ip_address, created_at)
       VALUES (?, ?, 'export', 'submission_history', ?, ?, NOW())`,
      [
        randomUUID(),
        req.authUser.id,
        JSON.stringify({
          recruiterCode,
          fromDate,
          toDate,
          rowCount: redacted.length,
          exportedColumns: Object.keys(redacted[0] || {}),
          redactedFields: ['offer_salary'] // example
        }),
        req.ip
      ]
    );
    
    // Convert to CSV
    if (format === 'csv') {
      const csv = convertToCSV(redacted);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="submission_history_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({ success: true, data: redacted });
    }
  })
);
```

**CSV Conversion Utility**:
```typescript
function convertToCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','), // Header row
    ...rows.map(row => 
      headers.map(h => {
        const value = row[h];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ];
  
  return csvRows.join('\n');
}
```

---

## Task 7: Admin Proxy Flag Routing Integration (30 mins)

### Problem
Schema ready (`is_proxy_submission` column exists) but not populated in routes

### Solution
Detect admin/HR actions and populate flag

**Route Update**:
```typescript
// atsFullParity.routes.ts - recruiter-submission endpoint
router.post("/recruiter-submission", requireRole("admin", "hr", "recruiter"), h(async (req: any, res) => {
  const actorRole = req.authUser?.role;
  const isProxySubmission = actorRole === 'admin' || actorRole === 'hr_admin' || actorRole === 'super_admin';
  
  // Pass flag to service
  const data = await svc.submitRecruiterUpdate(req.body, req.authUser?.id, isProxySubmission);
  
  res.json({ success: true, data, message: "Recruiter submission consolidated" });
}));
```

**Service Update**:
```typescript
// atsFullParity.service.ts
async submitRecruiterUpdate(
  input: Record<string, any>,
  actorUserId?: string,
  isProxySubmission = false // NEW parameter
) {
  // ... existing logic ...
  
  // When logging to audit or stage_log
  await db.execute(
    `INSERT INTO ats_candidate_stage_log 
     (id, candidate_id, from_stage, to_stage, remarks, updated_by, actor_user_id, submitted_by_user_id, is_proxy_submission)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      c.id,
      c.current_stage || c.status,
      newStatus,
      input.remarks || null,
      actorUserId,
      actorUserId,
      isProxySubmission ? actorUserId : null,
      isProxySubmission ? 1 : 0
    ]
  );
}
```

---

## Migration Script

**File**: `backend/sql/134_phase_b_data_integrity.sql`

```sql
-- ============================================================================
-- Migration 134: Phase B Data Integrity Fixes
-- ============================================================================

USE mas_hrms;

-- ────────────────────────────────────────────────────────────────────────────
-- Task 1: Queue Token Consolidation
-- ────────────────────────────────────────────────────────────────────────────

-- Migrate existing q_tokens to ats_queue_token table
INSERT INTO ats_queue_token (id, candidate_id, token, arrival_time, current_stage, status, created_at)
SELECT 
  UUID(),
  id,
  q_token,
  TIMESTAMP(created_date, created_time),
  current_stage,
  CASE 
    WHEN status IN ('Selected', 'Rejected') THEN 'completed'
    WHEN status = 'No Show' THEN 'walked_out'
    ELSE 'active'
  END,
  TIMESTAMP(created_date, created_time)
FROM ats_candidate
WHERE q_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ats_queue_token qt WHERE qt.candidate_id = ats_candidate.id
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Task 2: Unique Token Constraint
-- ────────────────────────────────────────────────────────────────────────────

-- MySQL 8.0+ partial index (if supported)
-- ALTER TABLE ats_queue_token
-- ADD UNIQUE INDEX uq_candidate_active_token (candidate_id, status)
-- WHERE status = 'active';

-- MySQL 5.7 workaround (application-level enforcement preferred)
-- Unique index on candidate_id when status='active' only
ALTER TABLE ats_queue_token
ADD UNIQUE INDEX uq_candidate_active_combo (candidate_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- Task 5: State Machine (add transition validation column)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE ats_candidate_stage_log
ADD COLUMN is_proxy_submission TINYINT(1) DEFAULT 0 AFTER submitted_by_user_id;

-- ────────────────────────────────────────────────────────────────────────────
-- Verification Queries
-- ────────────────────────────────────────────────────────────────────────────

-- Check queue token migration
SELECT 
  COUNT(*) as total_candidates_with_token,
  (SELECT COUNT(*) FROM ats_queue_token) as migrated_tokens,
  COUNT(*) - (SELECT COUNT(*) FROM ats_queue_token) as missing_tokens
FROM ats_candidate
WHERE q_token IS NOT NULL;

-- Check unique constraint
SELECT candidate_id, status, COUNT(*) as count
FROM ats_queue_token
WHERE status = 'active'
GROUP BY candidate_id, status
HAVING count > 1;
-- Expected: 0 rows (no duplicates)

-- ============================================================================
-- End of Migration 134
-- ============================================================================
```

---

## Testing Requirements

### Unit Tests (to be added)
- [ ] Queue token consolidation
- [ ] Duplicate token constraint
- [ ] Token status validation
- [ ] State machine validation
- [ ] Export with audit logging
- [ ] Proxy flag routing

### Integration Tests
- [ ] Candidate intake creates queue token in table
- [ ] Duplicate active token rejected
- [ ] Walked-out token rejected for submission
- [ ] Invalid status transition rejected
- [ ] Export logs to sensitive_action_log
- [ ] Admin proxy submission flagged

---

## Deployment Plan

### Pre-Deployment
1. Run Migration 134 on staging
2. Verify queue token migration (all candidates have tokens)
3. Test token status validation
4. Test state machine validation

### Deployment
```bash
# 1. Backup
mysqldump mas_hrms > backup_pre_migration_134.sql

# 2. Run migration
mysql mas_hrms < backend/sql/134_phase_b_data_integrity.sql

# 3. Verify
mysql mas_hrms -e "SELECT COUNT(*) FROM ats_queue_token;"

# 4. Deploy backend
railway up
```

### Post-Deployment
- Monitor queue token usage
- Check for invalid transition errors
- Review export audit logs
- Verify proxy submission flags

---

## Success Criteria

Phase B is successful when:
- [ ] All 7 Priority 2 issues fixed
- [ ] Queue token consolidation complete (100% migration)
- [ ] No duplicate active tokens
- [ ] State machine enforced
- [ ] Export capability with audit
- [ ] Proxy submissions flagged

---

## Timeline

| Task | Duration | Dependencies |
|------|----------|--------------|
| Queue token consolidation | 2h | None |
| Unique constraint | 1h | Task 1 |
| Token validation | 1h | Task 1 |
| Audit enhancement | 1h | None |
| State machine | 3h | None |
| Export capability | 2h | Phase A (PII redaction) |
| Proxy flag routing | 30m | Phase A (schema) |

**Total**: 10.5 hours (~2 days)

---

**Status**: Ready to start after Phase A deployment  
**Next**: Create Migration 134 and begin implementation
