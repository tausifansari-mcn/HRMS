# HRMS Attendance & WFM Frontend Testing Suite

Complete testing documentation for MCN HRMS Attendance and Workforce Management modules.

---

## Quick Navigation

| I Want To... | Document | Time Required |
|--------------|----------|---------------|
| **Get Started Fast** | [Quick Start Guide](QUICKSTART_ATTENDANCE_WFM_TESTING.md) | 30 min |
| **Run Full Test Suite** | [Execution Checklist](TEST_EXECUTION_CHECKLIST.md) | 2-3 hours |
| **Understand Everything** | [Comprehensive Report](ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md) | Reference |
| **See Overview** | [Testing Summary](ATTENDANCE_WFM_TESTING_SUMMARY.md) | 10 min read |
| **Run API Tests** | [test-attendance-wfm-api.sh](test-attendance-wfm-api.sh) | 5 min |
| **Document Results** | [TEST_RESULTS_TEMPLATE.json](TEST_RESULTS_TEMPLATE.json) | Fill as you test |

---

## What's Included

### 📄 Documents (5 files)

1. **ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md** (37KB)
   - Complete system documentation
   - All routes and API endpoints
   - 12-step test plan with details
   - Real employee data validation
   - Security test scenarios
   - Database queries

2. **QUICKSTART_ATTENDANCE_WFM_TESTING.md** (9KB)
   - 30-minute smoke test
   - 6 critical test cases
   - API shortcuts
   - Security test matrix
   - Common issues checklist

3. **TEST_EXECUTION_CHECKLIST.md** (17KB)
   - Checkbox-based execution
   - 11 functional tests
   - 5 security tests
   - 5 database validations
   - Screenshot tracking
   - Summary template

4. **ATTENDANCE_WFM_TESTING_SUMMARY.md** (11KB)
   - Overview of all documents
   - Testing flow recommendations
   - Issue classification guide
   - Automation opportunities
   - Support & references

5. **ATTENDANCE_WFM_TESTING_README.md** (This file)
   - Quick navigation
   - Setup instructions
   - Document index

### 🔧 Scripts (1 file)

6. **test-attendance-wfm-api.sh** (8KB)
   - Automated API testing
   - Color-coded output
   - Health checks
   - JSON formatting
   - Make executable with: `chmod +x test-attendance-wfm-api.sh`

### 📊 Templates (1 file)

7. **TEST_RESULTS_TEMPLATE.json** (12KB)
   - Structured results format
   - Issue tracking template
   - Summary metrics
   - Sign-off section

---

## Setup & Prerequisites

### 1. Verify Servers Running

```bash
# Check frontend (should return HTML)
curl http://localhost:8080

# Check backend (should return JSON health status)
curl http://localhost:5055/api/health
```

Expected backend response:
```json
{
  "success": true,
  "service": "MCN HRMS Backend API",
  "status": "ok",
  "db": "ok",
  "timestamp": "..."
}
```

### 2. Verify Database Access

```bash
mysql -h 122.184.128.90 -u <username> -p mas_hrms -e "SELECT COUNT(*) FROM employee;"
```

### 3. Get Test Credentials

All test user accounts are documented in:
- **File:** `/tmp/real_hrms_test_users.json`
- **Summary:** See any test document under "Test Credentials" section

Key accounts:
- **Employee:** nixon.sethi@teammas.in (MAS00176)
- **Manager:** ANKIT.SHARMA@TEAMMAS.IN (MAS04461)
- **Admin:** shivam.giri@teammas.in (ADMIN001)

### 4. Prepare Testing Tools

- **Browser:** Chrome/Firefox with DevTools
- **Screenshot Tool:** Any (Flameshot, built-in)
- **Text Editor:** For notes
- **Terminal:** For API tests

---

## Testing Approaches

### Approach 1: Quick Smoke Test (30 min)

**Best For:** Rapid validation, CI/CD gate, pre-deployment check

**Steps:**
1. Read: [QUICKSTART_ATTENDANCE_WFM_TESTING.md](QUICKSTART_ATTENDANCE_WFM_TESTING.md)
2. Run: `./test-attendance-wfm-api.sh` (5 min)
3. Test: 6 critical UI scenarios (20 min)
4. Validate: 5 security checks (5 min)

**Output:** GO/NO-GO decision

---

### Approach 2: Full Test Suite (2-3 hours)

**Best For:** Release testing, QA sign-off, major feature changes

**Steps:**
1. Read: [TEST_EXECUTION_CHECKLIST.md](TEST_EXECUTION_CHECKLIST.md)
2. Execute: All 11 functional tests (90 min)
3. Execute: All 5 security tests (20 min)
4. Execute: All 5 database checks (10 min)
5. Document: Fill [TEST_RESULTS_TEMPLATE.json](TEST_RESULTS_TEMPLATE.json) (20 min)

**Output:** Comprehensive test report with issues list

---

### Approach 3: Deep Dive (4+ hours)

**Best For:** Production readiness, security audit, performance analysis

**Steps:**
1. Read: [ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md](ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md)
2. Test: All documented scenarios
3. Explore: Edge cases and error conditions
4. Analyze: Performance and security
5. Document: Detailed findings report

**Output:** Production readiness certification

---

## Test Execution Workflow

```
┌─────────────────────────────────────────────────────────┐
│ START: Choose Testing Approach                          │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Quick Smoke Test (30 min)
             │   ├─► Run API tests
             │   ├─► Test 6 critical UIs
             │   ├─► Security validation
             │   └─► GO/NO-GO
             │
             ├─► Full Test Suite (2-3 hours)
             │   ├─► 11 functional tests
             │   ├─► 5 security tests
             │   ├─► 5 DB validations
             │   ├─► Screenshot all
             │   └─► Fill results JSON
             │
             └─► Deep Dive (4+ hours)
                 ├─► Comprehensive testing
                 ├─► Edge case exploration
                 ├─► Performance analysis
                 ├─► Security audit
                 └─► Production readiness report
                 
┌─────────────────────────────────────────────────────────┐
│ Document Findings                                        │
├─────────────────────────────────────────────────────────┤
│ • Fill TEST_RESULTS_TEMPLATE.json                       │
│ • Categorize issues by severity                         │
│ • Attach screenshots                                     │
│ • Document recommendations                               │
└─────────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│ Review & Sign-Off                                        │
├─────────────────────────────────────────────────────────┤
│ Critical Issues? → Block deployment                     │
│ High Issues? → Fix within 24h                           │
│ Medium/Low? → Backlog                                    │
│ All Pass? → Approve for production                      │
└─────────────────────────────────────────────────────────┘
```

---

## Document Details

### ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md

**Purpose:** Complete reference documentation

**Contents:**
- Real test credentials with roles
- 10+ frontend routes with descriptions
- 40+ API endpoints documented
- 12-step comprehensive test plan
- Each step includes:
  - Exact page URLs
  - Role requirements
  - Expected UI elements
  - API validation
  - Security checks
  - Screenshots reference
- 5 security test scenarios with reproduction steps
- 15+ database validation queries with real employee data
- Issue checklists (UI, Data, Security, Functional)
- Test result JSON template
- File references and appendix

**When to Use:**
- First time testing the module
- Need detailed context
- Training new testers
- Reference during testing
- Documentation purposes

---

### QUICKSTART_ATTENDANCE_WFM_TESTING.md

**Purpose:** Fast execution guide

**Contents:**
- Pre-flight checklist
- 6 critical test scenarios (5 min each)
- API testing shortcuts
- Database quick checks
- Security test matrix
- Common issues checklist
- Issue reporting template
- Test result summary template

**When to Use:**
- Time-constrained testing
- Smoke testing before release
- CI/CD pipeline validation
- Quick regression test
- Pre-demo sanity check

---

### TEST_EXECUTION_CHECKLIST.md

**Purpose:** Systematic test execution

**Contents:**
- Pre-test setup checklist
- Test credentials quick reference
- 11 functional tests with checkboxes:
  - Each test has 10-15 checkboxes
  - Expected UI elements listed
  - Database validation queries
  - Screenshot tracking
  - Issue documentation space
- 5 security tests with validation:
  - Expected vs actual results
  - Pass/Fail status
  - Evidence tracking
- 5 database queries with results
- Summary table (Total/Pass/Fail/Skip)
- Overall status section
- Quick commands appendix

**When to Use:**
- Formal QA testing
- Need audit trail
- Multiple testers (consistent approach)
- Tracking progress
- Sign-off requirements

---

### ATTENDANCE_WFM_TESTING_SUMMARY.md

**Purpose:** Overview and navigation guide

**Contents:**
- Executive summary
- Document structure explanation
- Testing approaches (3 levels)
- Recommended testing flow
- Critical security tests matrix
- Common issues & solutions
- Test metrics & KPIs
- Issue severity classification
- Reporting guidelines
- Automation opportunities
- Support & references

**When to Use:**
- Understanding the testing suite
- Choosing testing approach
- Planning test execution
- Reference for issue classification
- Onboarding new testers

---

### test-attendance-wfm-api.sh

**Purpose:** Automated API testing

**Features:**
- Color-coded output (green=pass, red=fail)
- Tests all major endpoints:
  - Health check
  - Attendance (clock in/out, sessions)
  - Regularization (submit, list)
  - Shifts (list, policy)
  - Roster (cycles, assignments, shifts)
  - Live tracker
  - Preferences
- JSON formatting with jq
- HTTP status code checking
- Database validation placeholders
- Summary at end

**Usage:**
```bash
cd /home/shuvam/hrms-audit
chmod +x test-attendance-wfm-api.sh
./test-attendance-wfm-api.sh
```

**Output:** Terminal output with test results (redirect to file with `> results.log`)

---

### TEST_RESULTS_TEMPLATE.json

**Purpose:** Structured results documentation

**Sections:**
- `test_execution`: Metadata (date, tester, duration, environment)
- `test_accounts_used`: Which accounts were tested
- `functional_tests`: 11 tests with detailed checkboxes and results
- `security_tests`: 5 tests with pass/fail and evidence
- `database_validation`: 5 queries with actual results
- `issues`: Array of issues with full details
- `summary`: Rollup metrics and pass rates
- `screenshots`: File tracking
- `performance_metrics`: Load times and API response times
- `recommendations`: Prioritized action items
- `sign_off`: Tester approval and conditions

**Usage:**
1. Copy template: `cp TEST_RESULTS_TEMPLATE.json my_test_results.json`
2. Fill as you test
3. Use for reporting and tracking

---

## Key Test Scenarios

### Critical Path (Must Pass)

1. **Employee Self-Service**
   - Clock in/out works
   - View own attendance accurate
   - Submit regularization successful

2. **Manager Approval**
   - See team attendance only
   - Approve regularization works
   - Cannot approve own requests

3. **Security Boundaries**
   - Cannot mark attendance for others
   - Cannot view others' data
   - Role-based access enforced
   - WFM pages gated correctly

4. **Data Integrity**
   - Hours calculated correctly
   - Timezone handled properly
   - Late flags accurate
   - Break hours deducted

5. **Roster Management**
   - Shifts displayed correctly
   - Roster cycles work
   - Assignments validated
   - Published rosters immutable

---

## Common Issues & Quick Fixes

| Issue | Quick Check | Fix |
|-------|-------------|-----|
| Page not loading | Backend up? `curl localhost:5055/api/health` | Start backend |
| Cannot clock in | Already clocked in? Check `wfm_attendance_session` | Clock out first |
| Regularization missing | Status correct? Query `employee_request` | Check status field |
| Roster empty | Cycle published? Check `roster_cycle` | Publish cycle |
| Live tracker stale | Date filter? Check query params | Set date=today |

---

## Test Environment

### URLs
- **Frontend:** http://localhost:8080
- **Backend:** http://localhost:5055
- **Health:** http://localhost:5055/api/health

### Database
- **Host:** 122.184.128.90
- **Database:** mas_hrms
- **User:** (See .env file)

### Key Routes
- `/attendance` - Main attendance page
- `/attendance-regularization` - Regularization workflow
- `/wfm/roster` - Roster governance (gated)
- `/my-roster` - Employee roster view
- `/wfm/live-tracker` - Live dashboard (gated)

---

## Success Criteria

### Smoke Test (Quick)
- [ ] All API tests pass (green)
- [ ] 6 critical UI tests work
- [ ] 5 security tests pass
- [ ] No critical issues

### Full Test (Standard)
- [ ] 11 functional tests pass
- [ ] 5 security tests pass
- [ ] 5 DB validations confirm data
- [ ] All screenshots captured
- [ ] Issues documented
- [ ] No blocking issues

### Production Ready (Deep)
- [ ] 100% test coverage
- [ ] All security tests pass
- [ ] Performance benchmarks met
- [ ] Edge cases tested
- [ ] Audit trail verified
- [ ] Documentation complete
- [ ] Sign-off obtained

---

## Getting Help

### Issues During Testing

1. **Backend errors:** Check logs in `/backend/logs/`
2. **Database errors:** Verify connection with `mysql` command
3. **Frontend errors:** Check browser console (F12)
4. **API errors:** Use Postman or curl to isolate

### Document Issues

If you find issues with this testing suite:
- Document what's unclear
- Suggest improvements
- Share with team

---

## Next Steps

### Before Testing
1. ✓ Read [Testing Summary](ATTENDANCE_WFM_TESTING_SUMMARY.md) (10 min)
2. ✓ Choose testing approach (Quick/Full/Deep)
3. ✓ Verify environment setup
4. ✓ Get test credentials

### During Testing
1. ✓ Follow chosen test document
2. ✓ Take screenshots at each step
3. ✓ Document issues immediately
4. ✓ Fill results template as you go

### After Testing
1. ✓ Complete results JSON
2. ✓ Categorize issues by severity
3. ✓ Create fix tickets
4. ✓ Share report with team
5. ✓ Schedule retest after fixes

---

## File Checklist

All files present in `/home/shuvam/hrms-audit/`:

- [x] ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md (37KB)
- [x] QUICKSTART_ATTENDANCE_WFM_TESTING.md (9KB)
- [x] TEST_EXECUTION_CHECKLIST.md (17KB)
- [x] ATTENDANCE_WFM_TESTING_SUMMARY.md (11KB)
- [x] ATTENDANCE_WFM_TESTING_README.md (This file)
- [x] test-attendance-wfm-api.sh (8KB)
- [x] TEST_RESULTS_TEMPLATE.json (12KB)

**Total Documentation:** 7 files, ~94KB

---

## Quick Start Commands

```bash
# 1. Navigate to project
cd /home/shuvam/hrms-audit

# 2. Verify servers
curl http://localhost:5055/api/health
curl http://localhost:8080 | head -20

# 3. Run API tests
chmod +x test-attendance-wfm-api.sh
./test-attendance-wfm-api.sh

# 4. Copy results template
cp TEST_RESULTS_TEMPLATE.json my_test_$(date +%Y%m%d).json

# 5. Start testing
# Open QUICKSTART_ATTENDANCE_WFM_TESTING.md for 30-min test
# OR open TEST_EXECUTION_CHECKLIST.md for full test
```

---

**Testing Suite Created:** 2026-06-08  
**Last Updated:** 2026-06-08  
**Status:** Ready for Use  
**Tested:** Not Yet (Awaiting Execution)

**Happy Testing!** 🚀

---

## License & Credits

**Created for:** MCN HRMS Audit Project  
**Purpose:** Frontend testing of Attendance & WFM modules  
**Audience:** QA Engineers, Developers, Project Managers  
**Maintenance:** Update after feature changes or bug fixes  

---

**END OF README**
