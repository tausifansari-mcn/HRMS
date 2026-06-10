# ATS E2E Audit — Session Resume

> Session: HRMS1 ATS End-to-End Audit (Session 2)
> Date: 2026-06-10
> Commit: `e7f5bd5a0c21c9a5e433561612230ddffc4b960d`
> Scope: ATS module + directly dependent onboarding / BGV / offer / training flows

---

## 1. Current Commit

| Property | Value |
|----------|-------|
| **SHA** | `e7f5bd5a0c21c9a5e433561612230ddffc4b960d` |
| **Message** | `Merge remote main into local docs branch` |
| **Branch** | `main` |
| **Working tree** | 2 modified files (scope enforcement changes, pending commit) |
| **Modified** | `backend/src/modules/ats/ats.routes.ts`, `backend/tests/ats.routes.test.ts` |

---

## 2. Scope Enforcement Changes Applied (Session 2)

The following issues from the Session 1 open-issues list have been **implemented in working tree** (not yet committed):

| Issue | Description | Status |
|-------|-------------|--------|
| #1 | `GET /api/ats/candidates/:id` — row-scope via `hasScopedAccess` | ✅ Implemented |
| #1 | `PUT /api/ats/candidates/:id` — row-scope via `hasScopedAccess` | ✅ Implemented |
| #1 | `POST /api/ats/candidates/:id/move-stage` — row-scope via `hasScopedAccess` | ✅ Implemented |
| #2 | `GET /api/ats/walkin-queue` — `buildScopeWhereClause` injected | ✅ Implemented |
| #2 | `GET /api/ats/waiting-queue` — `buildScopeWhereClause` injected | ✅ Implemented |
| #5 | `POST /api/ats/convert/:candidateId` — `hasScopedAccess` before conversion | ✅ Implemented |

---

## 3. Baseline Results (Session 2)

### 3.1 Frontend (Root)

| Command | Exit | Errors | Notes |
|---------|------|--------|-------|
| `npx tsc --noEmit` | 0 | 0 | TypeScript clean |
| `npm run build` | — | — | Not re-run this session (no frontend changes) |

**Frontend Verdict**: Frontend unchanged. No new TS errors.

### 3.2 Backend (`/backend`)

| Command | Exit | Errors | Notes |
|---------|------|--------|-------|
| `npm run typecheck` | 1 | 1 | `leave.routes.ts:134` — `leaveService` undefined (non-ATS; pre-existing) |
| `npm test -- --run` | 1 | 26 | 5 files failed, 26 tests failed (up from 25 in session 1) |

**Backend Test Run Summary** (session 2):

| File | Fail | Pattern |
|------|------|---------|
| `tests/ats.routes.test.ts` | **1 NEW** | `POST /api/ats/convert/:candidateId` — 500 vs expected 201 |
| `tests/integrationHub.service.test.ts` | 3 | Integration hub field-map / suggestion / run creation (pre-existing) |
| `tests/leave.routes.test.ts` | 4 | Leave submission & balance 403 vs 200/400 (pre-existing) |
| `tests/routes.integration.test.ts` | 1 | Health endpoint DB-error mock returns 503 vs 200 (pre-existing) |
| `src/modules/customization/__tests__/customization-api.test.ts` | 17 | All 401 Unauthorized — JWT mock mismatch (pre-existing) |

**New ATS Failure Root Cause**:

`POST /api/ats/convert/cand-1` → 500 because:
1. Route now calls `atsService.getCandidate(req.params.candidateId)` — **this is correctly mocked** (`svc.getCandidate.mockResolvedValue(fakeCandidate)`)
2. After scope check passes, route calls `convertCandidateToEmployee(req.params.candidateId, req.authUser!.id)`
3. `convertCandidateToEmployee` is **not mocked** — it imports and calls the real `ats.convert.service.ts`, which attempts a real DB query → `Error: Candidate not found`

**Fix required**: Mock `convertCandidateToEmployee` in `ats.routes.test.ts` vi.mock block.

---

## 4. Current ATS Routes

### 4.1 Frontend Routes (React Router)

| # | Route | Page Component | Access | Gate Code |
|---|-------|----------------|--------|-----------|
| 1 | `/interview-registration` | `NativeATSCandidateRegistration` | Public | — |
| 2 | `/candidate-registration` | → `/interview-registration` | Public | — |
| 3 | `/walkin-registration` | → `/interview-registration` | Public | — |
| 4 | `/onboard` | `CandidateOnboardingPage` | Public (token) | — |
| 5 | `/onboard-full` | `CandidateOnboardingFullPage` | Public | — |
| 6 | `/ats/dashboard` | `NativeATSDashboardReplica` | Protected | `ATS_DASHBOARD` |
| 7 | `/ats/candidate-registration` | `NativeATSCandidateRegistration` | Protected | — |
| 8 | `/ats/recruiter/my-candidates` | `NativeATSRecruiterDashboard` | Protected | `ATS_RECRUITER_QUEUE` |
| 9 | `/ats/onboarding-bridge` | `NativeATSOnboardingBridge` | Protected | `ATS_ONBOARDING_BRIDGE` |
| 10 | `/ats/waiting-queue` | `NativeATSWaitingQueue` | Protected | `ATS_WAITING_QUEUE` |
| 11 | `/ats/candidate-master` | `NativeATSCandidateMaster` | Protected | `ATS_CANDIDATE_MASTER` |
| 12 | `/ats/recruiter/workspace` | `NativeATSRecruiterWorkspace` | Protected | `ATS_RECRUITER_WORKSPACE` |
| 13 | `/ats/dashboard-v2` | `NativeATSDashboardV2` | Protected | `ATS_DASHBOARD` |
| 14 | `/ats/sourcing-analysis` | `NativeATSSourcingAnalysis` | Protected | `ATS_DASHBOARD` |
| 15 | `/ats/extensions` | `NativeATSExtensions` | Protected | `ATS_EXTENSIONS` |
| 16 | `/ats/form-config` | `NativeATSFormConfig` | Protected | — |
| 17 | `/ats/command-center` | `NativeATSFullParityCommandCenter` | Protected | `ATS_DASHBOARD` |
| 18 | `/ats/onboarding-requests` | `NativeHROnboardingRequests` | Protected | — |
| 19 | `/ats/offer-approvals` | `NativeBranchHeadApproval` | Protected | — |
| 20 | `/ats/bgv` | `NativeBGVVerificationCenter` | Protected | `ATS_BGV` |
| 21 | `/ats/walkin-queue` | `NativeWalkinQueue` | Protected | `ATS_WAITING_QUEUE` |

### 4.2 Backend API Routes (Express — mounted at `/api/ats`)

| # | Method | Route | Auth | Roles | Scope Enforced | Notes |
|---|--------|-------|------|-------|----------------|-------|
| 1 | POST | `/api/ats/candidates` | None | Public | N/A | Self-registration |
| 2 | GET | `/api/ats/candidates` | JWT | admin, hr, recruiter, manager | ✅ `buildScopeWhereClause` | Scoped list |
| 3 | GET | `/api/ats/candidates/:id` | JWT | admin, hr, recruiter, manager | ✅ `hasScopedAccess` | Row-scope added S2 |
| 4 | PUT | `/api/ats/candidates/:id` | JWT | admin, recruiter | ✅ `hasScopedAccess` | Row-scope added S2 |
| 5 | POST | `/api/ats/candidates/:id/move-stage` | JWT | admin, recruiter, manager | ✅ `hasScopedAccess` | Row-scope added S2 |
| 6 | GET | `/api/ats/candidates/:id/stage-logs` | JWT | admin, hr, recruiter, manager | ❌ None | Audit trail; low risk |
| 7 | POST | `/api/ats/convert/:candidateId` | JWT | admin, hr | ✅ `hasScopedAccess` | Row-scope added S2 |
| 8 | POST | `/api/ats/onboarding-bridge` | JWT | admin, hr | ❌ None | Creates bridge |
| 9 | PATCH | `/api/ats/onboarding-bridge/:id` | JWT | admin, hr | ❌ None | Updates bridge |
| 10 | GET | `/api/ats/sourcing-channels` | JWT | admin, hr, recruiter | N/A | Reference data |
| 11 | GET | `/api/ats/stats` | JWT | admin, hr, recruiter, manager | 🟡 Partial | Scoped via query params |
| 12 | GET | `/api/ats/walkin-queue` | JWT | admin, hr, recruiter | ✅ `buildScopeWhereClause` | Scope added S2 |
| 13 | GET | `/api/ats/waiting-queue` | JWT | admin, hr, recruiter, manager | ✅ `buildScopeWhereClause` | Scope added S2 |
| 14 | POST | `/api/ats/candidates/:id/upload` | None | Public (1-hr window) | N/A | Resume/selfie upload |
| 15 | GET | `/api/ats/onboarding-full/...` | None | Public | N/A | External router |
| 16 | GET | `/api/ats/bgv/...` | None | Public | N/A | BGV router |

**Onboarding Sub-Router** (`/api/ats/onboarding`)

| # | Method | Route | Auth | Roles | Scope Enforced | Notes |
|---|--------|-------|------|-------|----------------|-------|
| 17 | GET | `/validate-token` | None | Public | N/A | Token validation |
| 18 | POST | `/submit-profile` | None | Public | N/A | Profile submission |
| 19 | POST | `/send-token/:candidateId` | JWT | hr, recruiter, admin | ❌ None | Send onboarding token |
| 20 | GET | `/requests` | JWT | hr, recruiter, admin | 🟡 Partial | `branchId` param unused |
| 21 | POST | `/calculate-salary` | JWT | hr, recruiter, admin | N/A | Salary calculator |
| 22 | POST | `/requests/:id/offer` | JWT | hr, recruiter, admin | ❌ None | Save/submit offer |
| 23 | PATCH | `/requests/:id/offer` | JWT | hr, recruiter, admin | ❌ None | Update offer draft |
| 24 | GET | `/pending-approval` | JWT | branch_head, admin | 🟡 Partial | `branchId` param unused |
| 25 | POST | `/offers/:id/approve` | JWT | branch_head, admin | ❌ None | Approve offer |
| 26 | POST | `/offers/:id/reject` | JWT | branch_head, admin | ❌ None | Reject offer |

---

## 5. Open Issues (Updated Session 2)

| # | Priority | Description | Location | Status |
|---|----------|-------------|----------|--------|
| 1 | P1 | `GET /api/ats/candidates/:id` — row-scope missing | `ats.routes.ts` | ✅ Fixed S2 |
| 2 | P1 | `walkin-queue` / `waiting-queue` — no scope in SQL | `ats.routes.ts` | ✅ Fixed S2 |
| 3 | P1 | Onboarding token expiry — timezone risk | `ats.onboarding.service.ts:84` | 🔴 Open |
| 4 | P2 | Upload endpoint — no candidate ownership check | `ats.routes.ts:135-190` | 🔴 Open |
| 5 | P2 | `convertCandidateToEmployee` — no actor scope check | `ats.convert.service.ts:25` | ✅ Fixed S2 |
| 6 | P2 | `listOnboardingRequests` — `branchId` param always undefined | `ats.onboarding.service.ts:137` | 🔴 Open |
| 7 | P2 | `listPendingApprovals` — `branchId` param always undefined | `ats.onboarding.service.ts:280` | 🔴 Open |
| 8 | P3 | SMTP silently skips when env missing | `ats.email.service.ts:41` | 🔴 Open (acceptable dev) |
| 9 | P3 | Duplicate `normalizeSourceChannel` in controller + service | `ats.controller.ts:87`, `ats.service.ts:22` | 🔴 Open |
| 10 | P3 | Frontend has no `test` script | `package.json` | 🔴 Open |
| **11** | **P1** | **New ATS test failure: `POST /convert/:candidateId` — `convertCandidateToEmployee` not mocked, returns 500** | `tests/ats.routes.test.ts` | **🔴 Open** |
| **12** | **P2** | **Backend typecheck: `leave.routes.ts:134` — `leaveService` not in scope** | `backend/src/modules/leave/leave.routes.ts:134` | **🔴 Open (non-ATS)** |

---

## 6. Exact Next Task

**Task**: Fix Issue #11 — Mock `convertCandidateToEmployee` in test to allow the "converts candidate when scope allows" test to pass.

**Root Cause**: `ats.routes.ts` calls `convertCandidateToEmployee` from `ats.convert.service.ts`. This function is not mocked in `ats.routes.test.ts`. When the test runs, the real service tries to query the (mocked) DB and throws `Error: Candidate not found`.

**Files to Modify**:
1. `backend/tests/ats.routes.test.ts` — add `vi.mock("../src/modules/ats/ats.convert.service.js", ...)` with a mock of `convertCandidateToEmployee` returning a fake employee object.

**Exact Next Command**:
```bash
cd /c/Users/shivamg/HRMS1-ats-e2e/backend
npx vitest run tests/ats.routes.test.ts
```

**Expected result after fix**: All 19 tests in `ats.routes.test.ts` pass.

---

## 7. Preservation Rules

- **Employee fixes**: Do not modify `employees`, `leave`, `attendance`, `payroll` modules.
- **Admin fixes**: Do not modify `scopeAccess.ts` default `allowAdminBypass` logic unless explicitly requested.
- **Manager fixes**: Do not modify `management`, `performance-feedback`, `wfm` modules.
- **No secrets**: Do not commit `.env` or any SMTP/credential values.

---

## 8. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-10 | Audit Agent | Initial ATS E2E baseline |
| 2.0.0 | 2026-06-10 | Audit Agent | Session 2: scope enforcement implemented, new ATS test failure identified |

---

**AUDIT STATUS**: 🟡 Scope Enforcement Applied — 1 New Test Failure to Fix
**NEXT ACTION**: Fix Issue #11 — Mock `convertCandidateToEmployee` in `ats.routes.test.ts`
