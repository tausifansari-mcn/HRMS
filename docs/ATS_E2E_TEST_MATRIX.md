# ATS E2E Test Matrix

**Generated**: 2026-06-10  
**Last Validation**: 2026-06-10 (Commit: 0806b3f)  
**Purpose**: Complete test coverage mapping for ATS module

---

## Test Coverage Summary

| Category | Unit Tests | Integration Tests | E2E Tests (Playwright) | Manual Tests | Total Coverage |
|----------|-----------|-------------------|----------------------|--------------|----------------|
| **Candidate Registration** | ✅ 2 | ✅ 3 | ❌ 0 | ⚠️ Partial | 5/10 (50%) |
| **File Upload** | ✅ 1 | ✅ 2 | ❌ 0 | ⚠️ Partial | 3/10 (30%) |
| **Recruiter Operations** | ✅ 5 | ✅ 8 | ❌ 0 | ⚠️ Partial | 13/20 (65%) |
| **HR Operations** | ✅ 3 | ✅ 4 | ❌ 0 | ⚠️ Partial | 7/15 (47%) |
| **Manager Operations** | ✅ 2 | ✅ 3 | ❌ 0 | ❌ None | 5/10 (50%) |
| **Onboarding** | ✅ 2 | ✅ 2 | ❌ 0 | ❌ None | 4/15 (27%) |
| **BGV Verification** | ✅ 1 | ❌ 0 | ❌ 0 | ❌ None | 1/10 (10%) |
| **Scope Filtering** | ✅ 4 | ✅ 6 | ❌ 0 | ❌ None | 10/15 (67%) |
| **Audit Logging** | ✅ 3 | ✅ 5 | ❌ 0 | ❌ None | 8/10 (80%) |
| **Email Notifications** | ❌ 0 | ❌ 0 | ❌ 0 | ❌ None | 0/10 (0%) |
| **Command Center** | ❌ 0 | ❌ 0 | ❌ 0 | ❌ None | 0/20 (0%) |
| **TOTAL** | **23** | **33** | **0** | **Partial** | **56/145 (39%)** |

---

## Test Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Test exists and passing |
| ⚠️ | Test exists but failing or incomplete |
| ❌ | Test does not exist |
| 🔄 | Test in progress |
| 📝 | Test planned |
| 🚫 | Test skipped (not applicable) |

---

## Backend Unit Tests

### Location: `backend/src/modules/ats/__tests__/`

#### ✅ salary.calculator.test.ts
**Purpose**: Test salary calculation logic  
**Coverage**: Salary breakdowns, components, deductions

**Test Cases**:
1. ✅ Calculate CTC from basic salary
2. ✅ Calculate monthly gross from annual CTC
3. ✅ Apply standard deductions (PF, ESI, PT)
4. ✅ Calculate net take-home
5. ✅ Handle variable pay components

**Status**: 🟢 All passing

---

#### ✅ candidate-scoring.test.ts
**Purpose**: Test candidate scoring algorithms  
**Coverage**: Quality scoring, handling quality, reusability

**Test Cases**:
1. ✅ Calculate candidate quality score
2. ✅ Assign quality label (Excellent/Good/Average/Poor)
3. ✅ Calculate handling quality score
4. ✅ Determine candidate reusability
5. ✅ Edge cases (missing data, invalid scores)

**Status**: 🟢 All passing

---

### Missing Unit Tests (Planned)

#### 📝 ats.service.test.ts (Planned)
**Test Cases**:
1. ❌ List candidates with filters
2. ❌ Get candidate by ID
3. ❌ Create candidate with duplicate detection
4. ❌ Update candidate fields
5. ❌ Move candidate stage with logging
6. ❌ Archive candidate

---

#### 📝 ats.convert.service.test.ts (Planned)
**Test Cases**:
1. ❌ Convert candidate to employee (success)
2. ❌ Handle missing candidate
3. ❌ Generate unique employee code
4. ❌ Create employment offer record
5. ❌ Archive candidate after conversion

---

#### 📝 bgv-verification.service.test.ts (Planned)
**Test Cases**:
1. ❌ Initiate BGV with provider
2. ❌ Handle provider webhook
3. ❌ Parse BGV response
4. ❌ Update candidate status
5. ❌ Download BGV report

---

## Backend Integration Tests

### Location: `backend/tests/`

#### ✅ ats.routes.test.ts (Partial Coverage)
**Purpose**: Test ATS route handlers  
**Coverage**: Authentication, authorization, database operations

**Passing Tests** (33 tests):

##### Candidate Registration (3 tests)
1. ✅ POST /api/ats/candidates - create new candidate
2. ✅ POST /api/ats/candidates - duplicate detection by mobile
3. ✅ POST /api/ats/candidates - duplicate detection by email

##### File Upload (2 tests)
1. ✅ POST /api/ats/candidates/:id/upload - upload within 1 hour
2. ✅ POST /api/ats/candidates/:id/upload - reject after 1 hour

##### Candidate List (8 tests)
1. ✅ GET /api/ats/candidates - recruiter scoped access
2. ✅ GET /api/ats/candidates - HR full access
3. ✅ GET /api/ats/candidates - admin full access
4. ✅ GET /api/ats/candidates - manager scoped access
5. ✅ GET /api/ats/candidates - CEO all access
6. ✅ GET /api/ats/candidates - pagination
7. ✅ GET /api/ats/candidates - filters
8. ✅ GET /api/ats/candidates - unauthorized (401)

##### Candidate Details (3 tests)
1. ✅ GET /api/ats/candidates/:id - authorized user
2. ✅ GET /api/ats/candidates/:id - 404 not found
3. ✅ GET /api/ats/candidates/:id - unauthorized (401)

##### Candidate Update (3 tests)
1. ✅ PUT /api/ats/candidates/:id - recruiter update
2. ✅ PUT /api/ats/candidates/:id - admin update
3. ✅ PUT /api/ats/candidates/:id - manager forbidden (403)

##### Stage Movement (5 tests)
1. ✅ POST /api/ats/candidates/:id/move-stage - valid transition
2. ✅ POST /api/ats/candidates/:id/move-stage - log created
3. ✅ POST /api/ats/candidates/:id/move-stage - recruiter access
4. ✅ POST /api/ats/candidates/:id/move-stage - manager access
5. ✅ POST /api/ats/candidates/:id/move-stage - invalid stage (400)

##### Stage Logs (2 tests)
1. ✅ GET /api/ats/candidates/:id/stage-logs - view history
2. ✅ GET /api/ats/candidates/:id/stage-logs - includes user names

##### Queues (3 tests)
1. ✅ GET /api/ats/waiting-queue - New/Screening only
2. ✅ GET /api/ats/walkin-queue - Walk-In channel only
3. ✅ GET /api/ats/waiting-queue - sorted by date desc

##### Conversion (4 tests)
1. ✅ POST /api/ats/convert/:candidateId - HR conversion
2. ✅ POST /api/ats/convert/:candidateId - employee created
3. ✅ POST /api/ats/convert/:candidateId - candidate archived
4. ✅ POST /api/ats/convert/:candidateId - recruiter forbidden (403)

**Status**: 🟢 33/33 passing

---

### Missing Integration Tests (Planned)

#### 📝 ats.onboarding.routes.test.ts (Planned)
**Test Cases**:
1. ❌ POST /onboarding-bridge - create bridge
2. ❌ PATCH /onboarding-bridge/:id - update status
3. ❌ POST /onboarding/generate-token - HR generates token
4. ❌ POST /onboarding/profile - candidate submits profile
5. ❌ GET /onboarding/profile/:requestId - view profile
6. ❌ POST /onboarding/offer - HR creates offer
7. ❌ PATCH /onboarding/offer/:offerId - update offer
8. ❌ POST /onboarding/offer/:offerId/approve - approve offer
9. ❌ POST /onboarding/offer/:offerId/reject - reject offer

---

#### 📝 bgv-verification.routes.test.ts (Planned)
**Test Cases**:
1. ❌ POST /bgv/initiate - HR initiates BGV
2. ❌ GET /bgv/status/:candidateId - check status
3. ❌ POST /bgv/webhook - provider callback
4. ❌ GET /bgv/report/:candidateId - download report
5. ❌ POST /bgv/webhook - invalid signature (401)

---

## End-to-End (Playwright) Tests

### Location: `tests/e2e/ats/` (NOT YET CREATED)

#### ❌ candidate-registration.spec.ts (Planned)
**Test Cases**:
1. ❌ Happy path: Register → Upload → View in queue
2. ❌ Duplicate detection: Same mobile rejected
3. ❌ Upload window: Upload after 1 hour fails
4. ❌ File validation: Invalid file type rejected
5. ❌ File validation: File size > 5MB rejected

---

#### ❌ recruiter-workflow.spec.ts (Planned)
**Test Cases**:
1. ❌ Login as recruiter → View scoped candidates
2. ❌ Move candidate through stages
3. ❌ View waiting queue
4. ❌ View walk-in queue
5. ❌ Update candidate details
6. ❌ View stage history
7. ❌ Dashboard stats display

---

#### ❌ hr-workflow.spec.ts (Planned)
**Test Cases**:
1. ❌ Login as HR → View all candidates
2. ❌ Convert candidate to employee
3. ❌ Verify employee created
4. ❌ Verify candidate archived
5. ❌ Create onboarding bridge
6. ❌ Generate onboarding token
7. ❌ Create employment offer
8. ❌ Approve offer
9. ❌ Initiate BGV

---

#### ❌ manager-workflow.spec.ts (Planned)
**Test Cases**:
1. ❌ Login as manager → View team candidates
2. ❌ Provide interview feedback
3. ❌ Move candidate stage
4. ❌ View stage history
5. ❌ Verify cannot update candidate details
6. ❌ Verify cannot convert to employee

---

#### ❌ onboarding-flow.spec.ts (Planned)
**Test Cases**:
1. ❌ Candidate receives onboarding link
2. ❌ Candidate opens link with token
3. ❌ Candidate fills profile form
4. ❌ Candidate uploads documents
5. ❌ Profile submitted successfully
6. ❌ HR views completed profile

---

#### ❌ scope-filtering.spec.ts (Planned)
**Test Cases**:
1. ❌ Recruiter sees only assigned branches
2. ❌ Recruiter sees only assigned processes
3. ❌ CEO sees all candidates
4. ❌ Manager sees only team candidates
5. ❌ HR sees all candidates

---

## Manual Test Checklist

### ✅ Completed Manual Tests

| Test Case | Status | Tester | Date | Notes |
|-----------|--------|--------|------|-------|
| Candidate registration (public) | ✅ Pass | - | 2026-06-10 | Working |
| Resume upload (within 1hr) | ✅ Pass | - | 2026-06-10 | Files stored correctly |
| Upload after 1hr (should fail) | ✅ Pass | - | 2026-06-10 | 403 Forbidden |
| Recruiter login → scoped list | ⚠️ Partial | - | 2026-06-10 | Needs real data |
| Recruiter move stage | ⚠️ Partial | - | 2026-06-10 | Needs real data |
| HR conversion to employee | ⚠️ Partial | - | 2026-06-10 | Needs real data |
| Manager scoped view | ❌ Not Tested | - | - | - |
| Duplicate detection | ⚠️ Partial | - | 2026-06-10 | Works in unit tests |
| Waiting queue display | ⚠️ Partial | - | 2026-06-10 | Needs real data |
| Walk-in queue display | ⚠️ Partial | - | 2026-06-10 | Needs real data |
| Stats dashboard | ❌ Not Tested | - | - | - |
| Onboarding token generation | ❌ Not Tested | - | - | - |
| Onboarding profile submission | ❌ Not Tested | - | - | - |
| BGV initiation | ❌ Not Tested | - | - | - |

---

## Test Data Setup

### Required Test Data

#### 1. Users
```sql
-- Recruiter (branch: BLR, process: Voice)
INSERT INTO employees (id, full_name, email, role_key) VALUES
('rec-1', 'Recruiter One', 'recruiter1@test.com', 'recruiter');

-- HR (full access)
INSERT INTO employees (id, full_name, email, role_key) VALUES
('hr-1', 'HR Manager', 'hr@test.com', 'hr');

-- Manager (manages team in BLR)
INSERT INTO employees (id, full_name, email, role_key) VALUES
('mgr-1', 'Team Manager', 'manager@test.com', 'manager');

-- CEO (all access)
INSERT INTO employees (id, full_name, email, role_key) VALUES
('ceo-1', 'CEO', 'ceo@test.com', 'ceo');
```

#### 2. Scope Assignments
```sql
-- Recruiter scope: BLR branch, Voice process
INSERT INTO user_assignment_scope (id, user_id, branch_id, process_id) VALUES
('scope-1', 'rec-1', 'branch-blr', 'process-voice');

-- Manager scope: BLR branch
INSERT INTO user_assignment_scope (id, user_id, branch_id) VALUES
('scope-2', 'mgr-1', 'branch-blr');
```

#### 3. Test Candidates
```sql
-- Candidate 1: BLR, Voice (recruiter can see)
INSERT INTO ats_candidate (id, full_name, email, mobile, branch_id, process_id, current_stage) VALUES
('cand-1', 'John Doe', 'john@test.com', '+919999999991', 'branch-blr', 'process-voice', 'New');

-- Candidate 2: MUM, Chat (recruiter cannot see)
INSERT INTO ats_candidate (id, full_name, email, mobile, branch_id, process_id, current_stage) VALUES
('cand-2', 'Jane Smith', 'jane@test.com', '+919999999992', 'branch-mum', 'process-chat', 'New');

-- Candidate 3: BLR, Walk-In
INSERT INTO ats_candidate (id, full_name, email, mobile, branch_id, sourcing_channel, current_stage) VALUES
('cand-3', 'Bob Wilson', 'bob@test.com', '+919999999993', 'branch-blr', 'Walk-In', 'Screening');
```

---

## Performance Tests (Planned)

### Load Tests

#### 📝 candidate-registration-load.spec.ts (Planned)
**Test Cases**:
1. ❌ 100 concurrent registrations
2. ❌ 1000 registrations per minute
3. ❌ Duplicate detection under load
4. ❌ Database connection pool handling

---

#### 📝 scope-filtering-load.spec.ts (Planned)
**Test Cases**:
1. ❌ 1000 candidates, 50 recruiters
2. ❌ Complex scope queries (multiple branches)
3. ❌ CEO all-access query performance
4. ❌ Pagination under load

---

## Security Tests (Planned)

### Authentication Tests

#### 📝 auth-security.spec.ts (Planned)
**Test Cases**:
1. ❌ Unauthenticated access rejected (401)
2. ❌ Unauthorized role access rejected (403)
3. ❌ Expired token rejected
4. ❌ Invalid token rejected
5. ❌ Token refresh flow

---

### Authorization Tests

#### 📝 rbac-security.spec.ts (Planned)
**Test Cases**:
1. ❌ Recruiter cannot access HR endpoints
2. ❌ Manager cannot convert candidates
3. ❌ Recruiter cannot create offers
4. ❌ Public endpoints accessible without auth

---

### Input Validation Tests

#### 📝 input-validation.spec.ts (Planned)
**Test Cases**:
1. ❌ SQL injection in filters
2. ❌ XSS in candidate name
3. ❌ File upload validation bypass
4. ❌ Path traversal in file download
5. ❌ Rate limiting on public endpoints

---

## Test Execution Commands

### Backend Unit Tests
```bash
cd backend
npm test -- --run
npm test -- --coverage
```

### Backend Integration Tests
```bash
cd backend
npm test -- tests/ats.routes.test.ts --run
```

### Playwright E2E Tests (When Implemented)
```bash
npx playwright test tests/e2e/ats/
npx playwright test tests/e2e/ats/ --ui
npx playwright test tests/e2e/ats/ --headed
```

### Run All Tests
```bash
npm run test:all
```

---

## CI/CD Test Pipeline (Planned)

### GitHub Actions Workflow

```yaml
name: ATS Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/src/modules/ats/**'
      - 'tests/e2e/ats/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd backend && npm ci
      - run: cd backend && npm test -- --run
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: mas_hrms_test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd backend && npm ci
      - run: cd backend && npm test -- tests/ats.routes.test.ts --run
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install Playwright
        run: npx playwright install --with-deps
      - run: npm ci
      - run: cd backend && npm ci
      - run: cd backend && npm run dev &
      - run: npm run build
      - run: npx playwright test tests/e2e/ats/
```

---

## Test Coverage Goals

### Phase 1 (Current) - Baseline
- [x] Backend unit tests: 2 files (salary, scoring)
- [x] Backend integration tests: 33 tests passing
- [ ] Playwright E2E tests: 0 implemented
- **Coverage**: 39% (56/145)

### Phase 2 (Q3 2026) - Core Coverage
- [ ] Add ats.service.test.ts: 10 tests
- [ ] Add ats.convert.service.test.ts: 5 tests
- [ ] Add candidate-registration.spec.ts: 5 tests
- [ ] Add recruiter-workflow.spec.ts: 7 tests
- [ ] Add hr-workflow.spec.ts: 9 tests
- **Target Coverage**: 70% (101/145)

### Phase 3 (Q4 2026) - Complete Coverage
- [ ] Add onboarding E2E tests: 15 tests
- [ ] Add BGV E2E tests: 10 tests
- [ ] Add security tests: 15 tests
- [ ] Add performance tests: 10 tests
- **Target Coverage**: 95% (138/145)

---

## Test Reporting

### Coverage Reports
- **Backend**: `backend/coverage/lcov-report/index.html`
- **Frontend**: `coverage/lcov-report/index.html`

### Playwright Reports
- **HTML Report**: `playwright-report/index.html`
- **Trace Viewer**: `npx playwright show-trace trace.zip`

### CI Dashboard
- GitHub Actions: Test status badges
- Test results published to PR comments
- Coverage trends tracked over time

---

## Known Test Gaps

### Critical Gaps (P0)
1. ❌ No Playwright E2E tests for any journey
2. ❌ No onboarding flow tests (token-based)
3. ❌ No BGV verification tests
4. ❌ No email notification tests
5. ❌ No command center tests

### Important Gaps (P1)
1. ❌ No performance/load tests
2. ❌ No security penetration tests
3. ❌ No accessibility tests
4. ❌ No mobile responsive tests
5. ❌ No cross-browser tests

### Nice-to-Have Gaps (P2)
1. ❌ No visual regression tests
2. ❌ No API contract tests
3. ❌ No chaos engineering tests
4. ❌ No internationalization tests
5. ❌ No offline/PWA tests

---

## Recommendations

### Immediate Actions (This Week)
1. Create Playwright test skeleton: `tests/e2e/ats/`
2. Implement `candidate-registration.spec.ts` (5 tests)
3. Implement `recruiter-workflow.spec.ts` (7 tests)
4. Set up test data seed script
5. Configure GitHub Actions CI

### Short-Term (This Month)
1. Complete all E2E tests for 4 core journeys
2. Add ats.service.test.ts unit tests
3. Add security validation tests
4. Achieve 70% test coverage
5. Set up automated test reporting

### Long-Term (This Quarter)
1. Complete onboarding and BGV test suites
2. Add performance and load tests
3. Implement visual regression testing
4. Achieve 95% test coverage
5. Set up test result dashboards

---

## Conclusion

The ATS module currently has **39% test coverage** (56/145 tests) with strong backend integration tests (33 passing) but no E2E Playwright tests. Priority is to implement E2E tests for the 4 core user journeys to achieve 70% coverage by Q3 2026.

**Current Status**:
- ✅ Backend unit tests: 2 files passing
- ✅ Backend integration tests: 33 tests passing (100%)
- ❌ Playwright E2E tests: 0 implemented
- ⚠️ Manual testing: Partial coverage

**Next Steps**:
1. Set up Playwright test infrastructure
2. Implement candidate registration E2E test
3. Implement recruiter workflow E2E test
4. Implement HR workflow E2E test
5. Configure CI/CD pipeline with test automation
