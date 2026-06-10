# Interviewer / Branch Head Implementation Plan

**Created**: 2026-06-10  
**Status**: 🔄 **PLAN PHASE**  
**Current Context**: 44% (88K/200K tokens)

---

## Gap Analysis

### Current State
- ✅ Database: `ats_candidate` table has interview fields (round1/2/3_result, voc, remarks, rejection_voc)
- ✅ Database: `ats_interview_slot` table exists
- ✅ Database: `ats_candidate_stage_log` tracks stage transitions
- ❌ **MISSING**: No interviewer role in `workforce_role_catalog`
- ❌ **MISSING**: No interviewer-specific API endpoints
- ❌ **MISSING**: No interviewer frontend components
- ❌ **MISSING**: No branch head approval workflow
- ❌ **MISSING**: No scope filtering for interviewers (assigned interviews only)

---

## Required Implementation

### Phase 1: Database & Role Setup

#### 1.1 Add Interviewer Role
```sql
-- Insert interviewer role if not exists
INSERT INTO workforce_role_catalog (id, role_key, role_name, description, active_status)
SELECT UUID(), 'interviewer', 'Interviewer', 'Conducts candidate interviews and submits results', 1
WHERE NOT EXISTS (SELECT 1 FROM workforce_role_catalog WHERE role_key = 'interviewer');

-- Add page access for interviewers
INSERT INTO role_page_access (id, role_key, page_code, can_view, can_create, can_edit, can_delete, can_export)
VALUES
(UUID(), 'interviewer', 'ATS_INTERVIEW_QUEUE', 1, 0, 1, 0, 0),
(UUID(), 'interviewer', 'ATS_INTERVIEW_SUBMIT', 1, 1, 1, 0, 0);
```

#### 1.2 Add Branch Head Role (if not exists)
```sql
INSERT INTO workforce_role_catalog (id, role_key, role_name, description, active_status)
SELECT UUID(), 'branch_head', 'Branch Head', 'Branch-level approvals and oversight', 1
WHERE NOT EXISTS (SELECT 1 FROM workforce_role_catalog WHERE role_key = 'branch_head');
```

#### 1.3 Interview Assignment Table
```sql
CREATE TABLE IF NOT EXISTS ats_interview_assignment (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  candidate_id CHAR(36) NOT NULL,
  interviewer_id CHAR(36) NOT NULL,
  interview_round TINYINT NOT NULL, -- 1, 2, or 3
  assigned_by CHAR(36),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  interview_date DATE,
  interview_time TIME,
  status VARCHAR(50) DEFAULT 'Assigned', -- Assigned, Completed, NoShow, Rescheduled
  result VARCHAR(120),
  voc VARCHAR(255),
  remarks TEXT,
  submitted_at DATETIME,
  branch_id CHAR(36),
  FOREIGN KEY (candidate_id) REFERENCES ats_candidate(id),
  FOREIGN KEY (interviewer_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_by) REFERENCES employees(id),
  FOREIGN KEY (branch_id) REFERENCES branch_master(id),
  INDEX idx_interviewer (interviewer_id),
  INDEX idx_candidate (candidate_id),
  INDEX idx_round (interview_round),
  INDEX idx_status (status)
);
```

---

### Phase 2: Backend API Endpoints

#### 2.1 Interviewer Endpoints

**GET /api/ats/interviewer/my-interviews**
- **Auth**: interviewer role
- **Scope**: Only assigned interviews
- **Query params**: `?status=Assigned&date=2026-06-10`
- **Returns**: List of assigned interviews with candidate details

**GET /api/ats/interviewer/interview/:assignmentId**
- **Auth**: interviewer role
- **Scope**: Only if assigned to this interviewer
- **Returns**: Full interview assignment details + candidate info

**POST /api/ats/interviewer/submit-result**
- **Auth**: interviewer role
- **Scope**: Only if assigned to this interviewer
- **Body**: `{ assignmentId, result, voc, remarks, evidence_url? }`
- **Action**: 
  - Update `ats_interview_assignment` (result, voc, remarks, submitted_at)
  - Update `ats_candidate` (round1/2/3_result, voc, remarks)
  - Insert `ats_candidate_stage_log` entry
  - If rejected: update candidate stage to "Rejected"

**POST /api/ats/interviewer/mark-noshow**
- **Auth**: interviewer role
- **Body**: `{ assignmentId, remarks }`
- **Action**: Set status = 'NoShow', log in stage_log

**POST /api/ats/interviewer/reschedule**
- **Auth**: interviewer role
- **Body**: `{ assignmentId, newDate, newTime, reason }`
- **Action**: Update interview_date, interview_time, status = 'Rescheduled'

#### 2.2 Branch Head Endpoints

**GET /api/ats/branch-head/pending-approvals**
- **Auth**: branch_head role
- **Scope**: Only assigned branch
- **Returns**: Interviews requiring approval (e.g., rejections)

**POST /api/ats/branch-head/approve-rejection**
- **Auth**: branch_head role
- **Scope**: Only assigned branch
- **Body**: `{ assignmentId, approved, remarks }`
- **Action**: Update candidate stage, log approval

---

### Phase 3: Security & Scope Filtering

#### 3.1 Interviewer Scope Rules
```typescript
// Only see interviews assigned to them
WHERE interviewer_id = req.authUser.id

// Cannot view other interviewers' assignments
// Cannot modify completed interviews
// Cannot reassign interviews
```

#### 3.2 Branch Head Scope Rules
```typescript
// Only see candidates from assigned branch
WHERE branch_id IN (
  SELECT branch_id FROM user_assignment_scope 
  WHERE user_id = req.authUser.id
)

// Only approve/reject within their branch
// Cannot directly interview (branch_head != interviewer)
```

#### 3.3 Tampering Prevention
- **Assignment ID tampering**: Verify interviewer_id = req.authUser.id
- **Candidate ID tampering**: Join through assignment table only
- **Result tampering**: Validate enum values server-side
- **Status tampering**: Only allow valid state transitions

---

### Phase 4: Frontend Components

#### 4.1 Interviewer Dashboard
**Route**: `/interviewer/dashboard`
**Component**: `src/pages/InterviewerDashboard.tsx`
**Features**:
- Today's interviews
- Pending submissions
- Interview history
- Quick actions (submit result, mark no-show, reschedule)

#### 4.2 Interview Submission Form
**Route**: `/interviewer/submit/:assignmentId`
**Component**: `src/pages/InterviewSubmitResult.tsx`
**Fields**:
- Result dropdown (Selected/Rejected/OnHold)
- VOC dropdown (predefined reasons)
- Remarks (textarea, required)
- Evidence upload (optional)
- Submit button

#### 4.3 Branch Head Approval Queue
**Route**: `/branch-head/approvals`
**Component**: `src/pages/BranchHeadApprovals.tsx`
**Features**:
- List of pending rejections
- Candidate details panel
- Interview history
- Approve/Reject buttons with remarks

---

### Phase 5: Testing Strategy

#### 5.1 Backend Tests
```typescript
// tests/interviewer.routes.test.ts
- GET /my-interviews - interviewer sees only assigned
- GET /my-interviews - interviewer cannot see others' assignments
- POST /submit-result - valid submission
- POST /submit-result - tampering attempt (different interviewer)
- POST /submit-result - duplicate submission (already completed)
- POST /mark-noshow - valid no-show
- POST /reschedule - valid reschedule

// tests/branch-head.routes.test.ts
- GET /pending-approvals - branch head sees only assigned branch
- POST /approve-rejection - valid approval
- POST /approve-rejection - tampering attempt (different branch)
```

#### 5.2 Frontend Tests (Playwright)
```typescript
// tests/e2e/interviewer-workflow.spec.ts
- Login as interviewer → see assigned interviews
- Submit interview result (happy path)
- Mark candidate as no-show
- Reschedule interview
- Verify cannot access other interviewer's assignments

// tests/e2e/branch-head-workflow.spec.ts
- Login as branch head → see pending approvals
- Approve rejection
- Reject rejection (send back for re-interview)
- Verify cannot approve from other branches
```

---

## Implementation Order

### Sprint 1: Database & Core Backend (4 hours)
1. ✅ Create `ats_interview_assignment` table
2. ✅ Seed interviewer & branch_head roles
3. ✅ Implement interviewer service layer
4. ✅ Implement interviewer routes with scope guards
5. ✅ Write backend integration tests
6. ✅ Run typecheck & tests

### Sprint 2: Frontend Components (3 hours)
1. ✅ Create InterviewerDashboard component
2. ✅ Create InterviewSubmitResult component
3. ✅ Add routes to App.tsx
4. ✅ Implement API client functions
5. ✅ Add navigation links for interviewer role
6. ✅ Run frontend build & typecheck

### Sprint 3: Branch Head Features (2 hours)
1. ✅ Implement branch head service layer
2. ✅ Implement branch head routes
3. ✅ Create BranchHeadApprovals component
4. ✅ Add branch head navigation
5. ✅ Write branch head tests

### Sprint 4: Testing & Documentation (2 hours)
1. ✅ Write Playwright E2E tests
2. ✅ Manual testing of all flows
3. ✅ Create INTERVIEWER_E2E_RESUME.md
4. ✅ Create INTERVIEWER_ROLE_E2E_SPECIFICATION.md
5. ✅ Create INTERVIEWER_E2E_TEST_MATRIX.md
6. ✅ Create INTERVIEWER_SCOPE_MATRIX.md
7. ✅ Commit & push

**Total Estimated Time**: 11 hours

---

## Security Checklist

- [ ] Interviewer role added with proper permissions
- [ ] Branch head role added with proper permissions
- [ ] Assignment-based scope filtering implemented
- [ ] Cannot tamper with assignment IDs
- [ ] Cannot view other interviewers' assignments
- [ ] Cannot modify completed interviews
- [ ] Branch head sees only assigned branch
- [ ] Result enum values validated server-side
- [ ] State transitions validated (Assigned → Completed/NoShow/Rescheduled)
- [ ] Audit log for all interview submissions
- [ ] Audit log for all branch head approvals

---

## Current Status

**Phase**: Planning Complete  
**Next Action**: Begin Sprint 1 - Database & Core Backend  
**Blocker**: None  
**Context Usage**: 44% (safe to proceed)

---

## Notes

1. **Local Deployment**: Application will be deployed locally, not on Railway/Vercel
2. **Database**: MySQL (122.184.128.90, mas_hrms)
3. **No Duplicate Work**: ATS core audit already complete (commit 1cfb746)
4. **Focus Areas**: Interview result submission, rejection flow, no-show/reschedule
5. **Scope**: Interviewer = assigned interviews only, Branch Head = assigned branch only

---

**Ready to implement**: Awaiting confirmation to proceed with Sprint 1
