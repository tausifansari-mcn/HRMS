# HRMS Attendance & WFM Frontend Testing - Summary & Guide

**Generated:** 2026-06-08  
**System:** MCN HRMS Audit Instance  
**Scope:** Attendance marking, regularization, shift management, roster planning, live tracking

---

## Executive Summary

This testing suite provides comprehensive coverage for HRMS Attendance and Workforce Management (WFM) modules. The testing focuses on:

1. **Employee Self-Service** - Clock in/out, view attendance, submit regularizations
2. **Manager Functions** - Team attendance, approve regularizations, roster planning
3. **WFM Features** - Shift management, roster cycles, live tracking
4. **Security** - Role-based access control, data isolation, approval workflows
5. **Data Integrity** - Accurate calculations, timezone handling, audit trails

---

## Document Structure

### 1. Comprehensive Test Report
**File:** `ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md` (37KB)

**Contents:**
- Complete route mapping (10+ pages)
- Detailed API endpoint documentation
- 12-step comprehensive test plan
- Security validation scenarios
- Database validation queries with REAL employee data
- Test result JSON template
- Critical issues checklist

**Best For:** Full system understanding, detailed planning, reference documentation

---

### 2. Quick Start Guide
**File:** `QUICKSTART_ATTENDANCE_WFM_TESTING.md` (9KB)

**Contents:**
- 30-minute smoke test scenarios
- 6 critical test cases
- API testing shortcuts
- Database quick checks
- Security test matrix
- Common issues checklist
- Reporting template

**Best For:** Rapid testing, smoke tests, quick validation

---

### 3. Execution Checklist
**File:** `TEST_EXECUTION_CHECKLIST.md` (17KB)

**Contents:**
- Checkbox-based test execution
- 11 functional tests with exact steps
- 5 security tests with validation
- 5 database validation queries
- Test summary template
- Screenshots reference
- Quick commands appendix

**Best For:** Systematic testing, tracking progress, audit trail

---

### 4. Automated API Test Script
**File:** `test-attendance-wfm-api.sh` (8.2KB)

**Contents:**
- Automated API endpoint testing
- Color-coded output
- JSON response formatting
- Health checks
- Database validation placeholders
- Summary report generation

**Usage:**
```bash
cd /home/shuvam/hrms-audit
chmod +x test-attendance-wfm-api.sh
./test-attendance-wfm-api.sh
```

**Best For:** Automated regression testing, CI/CD integration, API validation

---

## Test Credentials (REAL Production Accounts)

### Primary Test Users

| Role | Email | Code | Name | Branch |
|------|-------|------|------|--------|
| Admin | shivam.giri@teammas.in | ADMIN001 | Shivam Giri | HEAD OFFICE |
| Employee | nixon.sethi@teammas.in | MAS00176 | Nixon Sethi | HEAD OFFICE |
| Team Leader | RUPALI.CHOPRA@TEAMMAS.IN | MAS07761 | Rupali Chopra | MEERUT |
| Manager | ANKIT.SHARMA@TEAMMAS.IN | MAS04461 | Ankit Sharma | MEERUT |
| Process Mgr | SUSHANT.CHOPRA@TEAMMAS.IN | MAS07068 | Sushant Chopra | MEERUT |
| HR Executive | deepika.kadyan@teammas.in | MAS05974 | Deepika Kadyan | KARNAL |

**Full User List:** `/tmp/real_hrms_test_users.json`

---

## Frontend Routes Reference

### Attendance Routes
```
/attendance                    - Clock in/out, view own attendance (all roles)
/attendance-regularization     - Request & approve regularizations (all roles)
/attendance-rules-master       - View attendance rules (all roles)
```

### WFM Routes (Gated)
```
/wfm/roster                    - Roster planning & governance (admin/wfm/manager)
/wfm/live-tracker              - Live attendance dashboard (admin/wfm/manager)
/wfm/extensions                - WFM advanced features (admin/wfm)
/wfm/auto-roster               - Automated roster generation (admin/wfm)
```

### Roster Routes
```
/my-roster                     - View personal roster (all roles)
/roster-preference             - Submit shift preferences (all roles)
/roster-master-builder         - Build roster templates (admin/wfm)
/roster-capacity-config        - Configure capacity rules (admin/wfm)
```

---

## Key API Endpoints

### Attendance
- `POST /api/wfm/sessions/clock-in` - Clock in (employee)
- `POST /api/wfm/sessions/clock-out` - Clock out (employee)
- `GET /api/wfm/sessions` - List sessions (manager+)
- `GET /api/attendance-engine/daily` - Daily records

### Regularization
- `POST /api/wfm/regularizations` - Submit request (employee)
- `GET /api/wfm/regularizations` - List requests (manager+)
- `PATCH /api/wfm/regularizations/:id/review` - Approve/reject (manager+)

### Roster
- `GET /api/roster-gov/shifts/templates` - List shift templates
- `POST /api/roster-gov/cycles` - Create roster cycle
- `POST /api/roster-gov/cycles/:id/assignments/bulk` - Bulk assign
- `GET /api/wfm/roster-preferences/my` - My preferences

### Live Tracking
- `GET /api/wfm/live?date=YYYY-MM-DD` - Live data (manager+)

---

## Recommended Testing Flow

### Phase 1: Quick Smoke Test (30 minutes)
Use `QUICKSTART_ATTENDANCE_WFM_TESTING.md`

1. Run API test script - 5 min
2. Test employee self-service - 10 min
3. Test manager approval - 10 min
4. Security validation - 5 min

**Goal:** Verify core functionality works

---

### Phase 2: Comprehensive Test (2-3 hours)
Use `TEST_EXECUTION_CHECKLIST.md`

1. All 11 functional tests - 90 min
2. All 5 security tests - 20 min
3. All 5 database checks - 10 min
4. Document findings - 20 min

**Goal:** Complete functional and security validation

---

### Phase 3: Deep Dive (4+ hours)
Use `ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md`

1. Detailed route mapping
2. API contract validation
3. Edge case testing
4. Performance analysis
5. Security audit
6. Database integrity checks

**Goal:** Production readiness validation

---

## Critical Security Tests

### Must-Pass Security Checks

| Test | Description | Expected Result |
|------|-------------|-----------------|
| Self-Service Isolation | Employee can only mark own attendance | 403 if trying to mark others |
| Approval Segregation | Cannot approve own regularization | 403 on self-approval attempt |
| RBAC Enforcement | Non-manager cannot access team data | 403 or gate blocks access |
| WFM Gate Protection | Non-admin cannot access WFM pages | Access denied message |
| Roster Immutability | Published roster cannot be modified | 400 error on modification attempt |

**If any of these FAIL, it's a CRITICAL security issue requiring immediate fix.**

---

## Database Validation (Quick)

Essential queries to run:

```sql
-- 1. Today's activity
SELECT COUNT(*) FROM attendance_log WHERE punch_date = CURDATE();

-- 2. Pending regularizations
SELECT COUNT(*) FROM employee_request 
WHERE request_type_code = 'ATTENDANCE_REGULARIZATION' 
  AND current_status IN ('submitted', 'pending_manager', 'pending_admin');

-- 3. Active shifts
SELECT COUNT(*) FROM wfm_shift WHERE active_status = 1;

-- 4. Current roster assignments
SELECT COUNT(*) FROM roster_assignment WHERE roster_date >= CURDATE();

-- 5. Nixon's recent attendance (test user)
SELECT * FROM attendance_log 
WHERE employee_id = (SELECT id FROM employee WHERE employee_code = 'MAS00176')
ORDER BY punch_date DESC LIMIT 5;
```

---

## Common Issues & Solutions

### Issue: Page Not Loading
**Symptoms:** Blank page, spinner forever  
**Check:**
- Backend running? `curl http://localhost:5055/api/health`
- API errors? Check browser console (F12)
- Network errors? Check Network tab in dev tools

---

### Issue: Cannot Clock In
**Symptoms:** Button disabled, error on submit  
**Check:**
- Already clocked in? Check `wfm_attendance_session` table
- Shift assigned? Check `employee.shift_id` not null
- Geo-fencing? Check location permissions in browser

---

### Issue: Regularization Not Appearing
**Symptoms:** Submitted but not in approval queue  
**Check:**
- Status is `pending_manager` or `pending_admin`?
- Manager role correctly assigned?
- Request in `employee_request` table?
- Check `request_approval_stage` for workflow state

---

### Issue: Roster Not Showing
**Symptoms:** My Roster page empty  
**Check:**
- Roster cycle exists and published?
- Assignments created in `roster_assignment` table?
- Date range correct (not looking at past weeks)?
- Employee mapped to process?

---

### Issue: Live Tracker Shows Wrong Data
**Symptoms:** Counts don't match, data stale  
**Check:**
- Date filter set correctly?
- SSE connection active? (Check Network tab → EventStream)
- Attendance data processed? Run `POST /api/attendance-engine/process`
- Check `attendance_daily_processed` table

---

## Test Metrics & KPIs

### Functional Coverage
- **Total Test Cases:** 21 (11 functional + 5 security + 5 DB)
- **Expected Pass Rate:** > 90%
- **Critical Tests:** 5 security tests (must be 100%)

### Performance Benchmarks
- **Page Load:** < 3 seconds
- **API Response:** < 1 second (list endpoints)
- **API Response:** < 500ms (detail endpoints)
- **Live Refresh:** Every 30 seconds (SSE)

### Data Accuracy
- **Attendance Calculation:** ±1 minute tolerance
- **Late Flags:** Accurate within grace period
- **Break Deduction:** Exact to the minute
- **Roster Assignment:** No double-bookings

---

## Issue Severity Classification

### Critical
- Security breach (can access others' data)
- Data corruption (hours calculated wrong)
- System down (cannot clock in/out)
- Approval bypass (can approve own requests)

**Action:** Fix immediately, block deployment

---

### High
- Feature not working (roster not loading)
- Major UX issue (buttons not clickable)
- Data inconsistency (late flags wrong)
- Performance < benchmarks (page load > 5s)

**Action:** Fix within 24 hours

---

### Medium
- Minor UX issue (unclear labels)
- Missing validation (but no data risk)
- Cosmetic bugs (alignment off)
- Non-critical feature missing

**Action:** Fix within 1 week

---

### Low
- Typos in messages
- Color contrast minor issues
- Nice-to-have features
- Documentation gaps

**Action:** Backlog

---

## Reporting Results

### After Testing, Provide:

1. **Completed Checklist**
   - Use `TEST_EXECUTION_CHECKLIST.md`
   - Check all boxes
   - Document all issues

2. **Screenshots**
   - One per test step
   - Name clearly: `test1_clock_in_page.png`
   - Include in report

3. **Issue List**
   - Use issue template from quickstart
   - Categorize by severity
   - Include reproduction steps

4. **Test Summary JSON**
   - Fill template from comprehensive report
   - Include metrics
   - List blocking issues

5. **Database Query Results**
   - Run all validation queries
   - Document actual vs expected
   - Flag discrepancies

---

## Next Steps After Testing

### If All Tests Pass
1. ✓ Mark module as production-ready
2. ✓ Document any minor issues for backlog
3. ✓ Schedule periodic regression tests
4. ✓ Update test cases for new features

### If Critical Issues Found
1. ⚠ Block deployment
2. ⚠ Create urgent fix tickets
3. ⚠ Retest after fixes
4. ⚠ Document root cause for prevention

### If High/Medium Issues Found
1. → Prioritize fixes
2. → Document workarounds if needed
3. → Schedule fix sprint
4. → Retest after fixes

---

## Automation Opportunities

### Current Manual Tests That Can Be Automated

1. **API Tests** - Already scriptable via `test-attendance-wfm-api.sh`
2. **Database Validation** - Can be scripted with SQL
3. **Security Tests** - Can use Postman collections
4. **Smoke Tests** - Can use Playwright/Cypress for UI

### Recommended Automation Stack

```yaml
API Testing: 
  - Tool: Jest + Supertest
  - Coverage: All endpoints in wfm.routes.ts
  - Frequency: Every commit

UI Testing:
  - Tool: Playwright
  - Coverage: Critical paths (clock in, submit regularization)
  - Frequency: Nightly

Database Testing:
  - Tool: Custom SQL scripts
  - Coverage: Data integrity, constraints
  - Frequency: After migrations

Security Testing:
  - Tool: OWASP ZAP + custom scripts
  - Coverage: All RBAC boundaries
  - Frequency: Weekly
```

---

## Support & References

### Key Files
- **Frontend Code:** `/src/pages/Attendance.tsx`, `/src/pages/AttendanceRegularization.tsx`
- **Backend Code:** `/backend/src/modules/wfm/wfm.routes.ts`, `/backend/src/modules/wfm/wfm.controller.ts`
- **Database Schema:** `/backend/sql/005_attendance_wfm.sql`, `/backend/sql/020_roster_governance.sql`
- **Test Files:** `/backend/tests/wfm.routes.test.ts`, `/backend/tests/roster.governance.test.ts`

### Environment
- **Frontend:** http://localhost:8080
- **Backend:** http://localhost:5055
- **Database:** mas_hrms @ 122.184.128.90
- **Health Check:** http://localhost:5055/api/health

### Commands
```bash
# Start backend
cd /home/shuvam/hrms-audit/backend && npm run dev

# Start frontend
cd /home/shuvam/hrms-audit && npm run dev

# Run API tests
cd /home/shuvam/hrms-audit && ./test-attendance-wfm-api.sh

# Database access
mysql -h 122.184.128.90 -u <user> -p mas_hrms
```

---

## Conclusion

This testing suite provides:

✓ **Comprehensive Coverage** - All attendance & WFM features  
✓ **Real Production Data** - Actual employee accounts and data  
✓ **Security Focus** - 5 critical security validations  
✓ **Easy Execution** - Step-by-step checklists  
✓ **Automation Ready** - API test script included  
✓ **Database Validation** - SQL queries for data integrity  

**Estimated Testing Time:**
- Quick Smoke Test: 30 minutes
- Full Test Suite: 2-3 hours
- Deep Dive + Analysis: 4+ hours

**Success Criteria:**
- All functional tests pass
- All security tests pass
- Database validation confirms data accuracy
- No critical or high severity issues
- Performance meets benchmarks

---

**Testing Guide Created:** 2026-06-08  
**Last Updated:** 2026-06-08  
**Status:** Ready for Execution

---

## Quick Links

| Document | Purpose | Size | Link |
|----------|---------|------|------|
| Comprehensive Report | Full documentation | 37KB | `ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md` |
| Quick Start Guide | Rapid testing | 9KB | `QUICKSTART_ATTENDANCE_WFM_TESTING.md` |
| Execution Checklist | Systematic testing | 17KB | `TEST_EXECUTION_CHECKLIST.md` |
| API Test Script | Automated testing | 8KB | `test-attendance-wfm-api.sh` |
| This Summary | Overview & guide | 11KB | `ATTENDANCE_WFM_TESTING_SUMMARY.md` |

**Start Here:** `QUICKSTART_ATTENDANCE_WFM_TESTING.md` for 30-min smoke test  
**Then:** `TEST_EXECUTION_CHECKLIST.md` for full test execution  
**Reference:** `ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md` for detailed info

---

**Happy Testing!** 🎯
