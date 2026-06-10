# Attendance & WFM Test Execution Checklist

Quick reference for manual testing with checkboxes and expected outcomes.

---

## Pre-Test Setup

- [ ] Backend running on http://localhost:5055
- [ ] Frontend running on http://localhost:8080
- [ ] MySQL accessible at 122.184.128.90
- [ ] Test credentials ready (see below)
- [ ] Browser dev tools open (F12)
- [ ] Screenshot tool ready
- [ ] Test log file opened

---

## Test Credentials Quick Reference

| Role | Email | Code | Name | Use For |
|------|-------|------|------|---------|
| Employee | nixon.sethi@teammas.in | MAS00176 | Nixon Sethi | Clock in, view own attendance |
| Team Leader | RUPALI.CHOPRA@TEAMMAS.IN | MAS07761 | Rupali Chopra | Team view, roster |
| Manager | ANKIT.SHARMA@TEAMMAS.IN | MAS04461 | Ankit Sharma | Approvals, branch reports |
| Admin | shivam.giri@teammas.in | ADMIN001 | Shivam Giri | Full access |

---

## Test Execution

### Test 1: Clock In/Out Page ✓ / ✗

- [ ] **URL:** http://localhost:8080/attendance
- [ ] **Login as:** nixon.sethi@teammas.in
- [ ] Page loads without errors
- [ ] Current time displayed
- [ ] Clock In button visible (if not clocked in)
- [ ] Clock Out button visible (if clocked in)
- [ ] Today's attendance status card shown
- [ ] Employee's shift information visible
- [ ] Location capture works (if geo-fencing enabled)
- [ ] Break pause/resume controls visible

**Expected UI Elements:**
- Timer/Clock icon
- LogIn/LogOut icons
- Location pin icon
- Work mode selector (Office/Remote/Hybrid)
- Status badge (Present/Absent/On Break)

**Screenshot:** `test1_clock_in_page.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 2: My Attendance History ✓ / ✗

- [ ] **URL:** http://localhost:8080/attendance (same page, history section)
- [ ] **Login as:** nixon.sethi@teammas.in
- [ ] Attendance calendar/table loads
- [ ] Shows current month by default
- [ ] Month selector dropdown works
- [ ] Attendance records display:
  - [ ] Date
  - [ ] Day name
  - [ ] Clock In time
  - [ ] Clock Out time
  - [ ] Total hours
  - [ ] Break hours
  - [ ] Status (Present/Absent/Half-day)
  - [ ] Attendance source (biometric/dialler)
- [ ] Can navigate to previous months
- [ ] Status badges color-coded (green/red/amber)
- [ ] Pagination works for large datasets
- [ ] Columns sortable

**Database Validation:**
```sql
SELECT COUNT(*) FROM attendance_log 
WHERE employee_id = (SELECT id FROM employee WHERE employee_code = 'MAS00176');
-- Expected: At least 1 record if Nixon has attendance
```

**Screenshot:** `test2_attendance_history.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 3: Regularization Request Form ✓ / ✗

- [ ] **URL:** http://localhost:8080/attendance-regularization
- [ ] **Login as:** nixon.sethi@teammas.in
- [ ] Page loads
- [ ] "New Request" or "Submit Regularization" button visible
- [ ] Click button to open form
- [ ] Form fields present:
  - [ ] Attendance Date (date picker)
  - [ ] Current Status dropdown
  - [ ] Current Login Time
  - [ ] Current Logout Time
  - [ ] Requested Login Time
  - [ ] Requested Logout Time
  - [ ] Reason (textarea)
  - [ ] Supporting Document Upload
- [ ] Form validation works:
  - [ ] Cannot select future date
  - [ ] Reason is mandatory
  - [ ] Time format validated
- [ ] Submit button present
- [ ] Cancel button works

**Test Data:**
- Date: Yesterday
- Current Status: Absent
- Requested Login: 09:30
- Requested Logout: 18:30
- Reason: "Test - System did not capture my attendance"

**DO NOT SUBMIT** unless you want test data in database

**Screenshot:** `test3_regularization_form.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 4: Manager Team Attendance View ✓ / ✗

- [ ] **URL:** http://localhost:8080/attendance
- [ ] **Login as:** ANKIT.SHARMA@TEAMMAS.IN (Manager)
- [ ] Page loads
- [ ] "Team Attendance" tab/section visible
- [ ] Click to view team attendance
- [ ] Team members list displays:
  - [ ] Employee name
  - [ ] Employee code
  - [ ] Today's status (Present/Absent/On Leave)
  - [ ] Clock in time
  - [ ] Expected shift time
  - [ ] Late/Early indicators
- [ ] Filter by department/branch/process works
- [ ] Shows only direct reports (MEERUT branch for Ankit)
- [ ] Does NOT show other branches' employees
- [ ] Export to CSV/Excel button present
- [ ] Can drill down to individual employee

**Expected:** Should see MEERUT branch employees only

**Screenshot:** `test4_team_attendance.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 5: Regularization Approval Queue ✓ / ✗

- [ ] **URL:** http://localhost:8080/attendance-regularization
- [ ] **Login as:** ANKIT.SHARMA@TEAMMAS.IN (Manager)
- [ ] Page loads
- [ ] "Pending Approvals" tab visible
- [ ] Click tab
- [ ] Pending requests list displays:
  - [ ] Request number
  - [ ] Employee name
  - [ ] Date
  - [ ] Current status vs Requested status
  - [ ] Current timings vs Requested timings
  - [ ] Reason
  - [ ] Submitted date
  - [ ] Action buttons (Approve/Reject)
- [ ] Can click "View Details" on a request
- [ ] Details modal shows:
  - [ ] Full request information
  - [ ] Approval stage history
  - [ ] Action log
  - [ ] Approve button
  - [ ] Reject button with remarks field
- [ ] Shows only team members' requests
- [ ] Does NOT show requests from other branches

**Screenshot:** `test5_approval_queue.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 6: Shift Management ✓ / ✗

- [ ] **URL:** http://localhost:8080/wfm/roster
- [ ] **Login as:** Admin or WFM role
- [ ] Page loads (check for Gate protection)
- [ ] Select a process from dropdown
- [ ] "Shift Template" section visible
- [ ] Existing shifts list displays:
  - [ ] Shift code
  - [ ] Shift name
  - [ ] Start time
  - [ ] End time
  - [ ] Version
- [ ] Create new shift form visible:
  - [ ] Code field
  - [ ] Name field
  - [ ] Start time picker
  - [ ] End time picker
  - [ ] "Save Shift" button
- [ ] Can fill form (DON'T submit unless testing)

**Test Data (if creating):**
- Code: TEST_SHIFT
- Name: Test Shift
- Start: 10:00
- End: 19:00

**Screenshot:** `test6_shift_management.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 7: Roster Planning (Weekly Cycle) ✓ / ✗

- [ ] **URL:** http://localhost:8080/wfm/roster
- [ ] **Login as:** Admin or Process Manager
- [ ] Same page as Test 6
- [ ] "Weekly Cycle" section visible
- [ ] Existing cycles list displays:
  - [ ] Week start date
  - [ ] Week end date
  - [ ] Status (draft/submitted/reviewed/published)
- [ ] Create cycle form visible:
  - [ ] Start Date (date picker)
  - [ ] End Date (date picker)
  - [ ] Required HC (number field)
  - [ ] "Create Draft Cycle" button
- [ ] Can select an existing cycle
- [ ] When cycle selected:
  - [ ] Status transition button appears
  - [ ] "Advance to [next status]" button
  - [ ] Next status is correct (draft→submitted→reviewed→published)

**Expected Status Flow:**
draft → submitted → reviewed → published → acknowledged → active → variance_review → attendance_locked → payroll_input_ready → closed

**Screenshot:** `test7_roster_planning.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 8: Roster Assignment (Bulk Import) ✓ / ✗

- [ ] **URL:** http://localhost:8080/wfm/roster
- [ ] **Login as:** Admin or Process Manager
- [ ] Select a draft cycle from Test 7
- [ ] "Draft Allocations" section visible
- [ ] JSON import textarea visible
- [ ] Can paste JSON data
- [ ] "Save Assignments" button visible
- [ ] Below, "Roster Assignments" table visible showing existing assignments:
  - [ ] Employee
  - [ ] Date
  - [ ] Shift
  - [ ] Week Off
  - [ ] Acknowledgement status

**Test JSON (example):**
```json
[
  {
    "employee_id": "emp-admin-001",
    "roster_date": "2026-06-09",
    "shift_template_id": "<shift-id>",
    "is_week_off": 0
  }
]
```

**DO NOT SUBMIT** unless you have valid employee_id and shift_template_id

**Screenshot:** `test8_roster_assignment.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 9: My Roster (Employee View) ✓ / ✗

- [ ] **URL:** http://localhost:8080/my-roster
- [ ] **Login as:** nixon.sethi@teammas.in OR RUPALI.CHOPRA@TEAMMAS.IN
- [ ] Page loads
- [ ] Weekly calendar view displayed
- [ ] Week navigation arrows (previous/next) visible
- [ ] Current week highlighted
- [ ] 7 day columns (Mon-Sun) displayed
- [ ] Each day shows:
  - [ ] Date
  - [ ] Shift name (if assigned)
  - [ ] Shift timings
  - [ ] Week off indicator
  - [ ] Holiday indicator
  - [ ] Leave overlay (if leave approved)
- [ ] Can navigate to next week
- [ ] Can navigate to previous week
- [ ] Roster updates when navigating
- [ ] If cycle published but not acknowledged:
  - [ ] "Acknowledge Roster" button appears
- [ ] Shows only employee's OWN roster
- [ ] Cannot view other employees' rosters

**Screenshot:** `test9_my_roster.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 10: Live Attendance Dashboard ✓ / ✗

- [ ] **URL:** http://localhost:8080/wfm/live-tracker
- [ ] **Login as:** Admin or Manager
- [ ] Page loads (or shows placeholder)
- [ ] If implemented:
  - [ ] Date selector visible (defaults to today)
  - [ ] Summary stats cards visible:
    - [ ] Total Rostered
    - [ ] Logged In (green badge)
    - [ ] Logged Out (gray badge)
    - [ ] Absent (red badge)
    - [ ] Overall Adherence %
  - [ ] Live employee list table visible:
    - [ ] Employee name
    - [ ] Process
    - [ ] Branch
    - [ ] Shift timings
    - [ ] Login time
    - [ ] Status badge (color-coded)
  - [ ] Filters work:
    - [ ] Process filter
    - [ ] Branch filter
    - [ ] Search by name
  - [ ] Stats auto-refresh (wait 30 seconds to verify)
  - [ ] No page reload needed for updates
- [ ] If placeholder:
  - [ ] Document that page is not yet implemented

**Screenshot:** `test10_live_dashboard.png`

**Issues Found:**
```
[Write any issues here]
```

---

### Test 11: Attendance Reports ✓ / ✗

- [ ] **URL:** http://localhost:8080/attendance (Reports tab) or dedicated reports page
- [ ] **Login as:** Admin or HR
- [ ] Reports section/tab visible
- [ ] Report generation form displays:
  - [ ] Date range picker (From - To)
  - [ ] Employee filter (single/multiple/all)
  - [ ] Department filter
  - [ ] Branch filter
  - [ ] Process filter
  - [ ] Report type dropdown
- [ ] Can select date range
- [ ] Can select filters
- [ ] "Generate Report" button visible
- [ ] After generation:
  - [ ] Report displays data
  - [ ] Data is accurate
  - [ ] Export options visible:
    - [ ] Download CSV
    - [ ] Download PDF
    - [ ] Download Excel
- [ ] Export buttons work
- [ ] Manager sees only team reports
- [ ] Admin/HR sees all reports

**Test Data:**
- Date Range: 2026-06-01 to 2026-06-30
- Employee: All
- Report Type: Monthly Attendance Summary

**Screenshot:** `test11_reports.png`

**Issues Found:**
```
[Write any issues here]
```

---

## Security Tests

### Security Test 1: Employee Cannot Mark Others' Attendance ✓ / ✗

- [ ] **Test:** Employee A tries to clock in for Employee B
- [ ] Login as nixon.sethi@teammas.in
- [ ] Open browser dev tools → Network tab
- [ ] Click Clock In
- [ ] Before submitting, modify request to change employeeId to another employee
- [ ] Submit

**Expected Result:**
- [ ] 403 Forbidden error
- [ ] Error message: "Cannot mark attendance for other employees"
- [ ] Clock in fails
- [ ] No attendance record created for other employee

**Status:** PASS / FAIL  
**Evidence:**
```
[Screenshot or description]
```

---

### Security Test 2: Cannot Approve Own Regularization ✓ / ✗

- [ ] **Test:** Employee submits regularization and tries to approve it
- [ ] Login as nixon.sethi@teammas.in
- [ ] Submit a regularization request (or use existing)
- [ ] Note the request ID
- [ ] Try to approve it via API (use curl or browser):

```bash
curl -X PATCH "http://localhost:5055/api/wfm/regularizations/<request-id>/review" \
  -H "Authorization: Bearer <employee-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "approved", "remarks": "Self-approved"}'
```

**Expected Result:**
- [ ] 403 Forbidden error
- [ ] Error message: "Cannot approve own regularization request"
- [ ] Request remains in pending state

**Status:** PASS / FAIL  
**Evidence:**
```
[Screenshot or description]
```

---

### Security Test 3: Role-Based Access Control ✓ / ✗

- [ ] **Test:** Non-manager tries to access team attendance
- [ ] Login as nixon.sethi@teammas.in (regular employee)
- [ ] Try to access manager endpoints via API:

```bash
curl "http://localhost:5055/api/wfm/sessions?limit=50" \
  -H "Authorization: Bearer <employee-token>"
```

**Expected Result:**
- [ ] 403 Forbidden error
- [ ] Error message: "Insufficient permissions"
- [ ] Access denied

**Status:** PASS / FAIL  
**Evidence:**
```
[Screenshot or description]
```

---

### Security Test 4: WFM Route Gate Protection ✓ / ✗

- [ ] **Test:** Non-admin tries to access WFM roster page
- [ ] Login as nixon.sethi@teammas.in (regular employee)
- [ ] Navigate to http://localhost:8080/wfm/roster

**Expected Result:**
- [ ] Redirected to access denied page OR
- [ ] Error message: "You don't have permission to view this page" OR
- [ ] Gate component blocks rendering
- [ ] Page content not visible

**Status:** PASS / FAIL  
**Evidence:**
```
[Screenshot or description]
```

---

### Security Test 5: Roster Immutability After Publication ✓ / ✗

- [ ] **Test:** Try to modify published roster
- [ ] Login as admin
- [ ] Create and publish a roster cycle
- [ ] Try to add/modify assignments via API:

```bash
curl -X POST "http://localhost:5055/api/roster-gov/cycles/<cycle-id>/assignments/bulk" \
  -H "Authorization: Bearer mock-token-admin" \
  -H "Content-Type: application/json" \
  -d '{"assignments": [...]}'
```

**Expected Result:**
- [ ] 400 Bad Request error
- [ ] Error message: "Cannot modify published roster without change control"
- [ ] Assignments not updated
- [ ] Audit trail recorded

**Status:** PASS / FAIL  
**Evidence:**
```
[Screenshot or description]
```

---

## Database Validation

### DB Check 1: Today's Attendance Count ✓ / ✗

```sql
SELECT COUNT(*) as today_punches 
FROM attendance_log 
WHERE punch_date = CURDATE();
```

**Expected:** > 0 if any employee has clocked in today  
**Actual:** ___________  
**Status:** PASS / FAIL

---

### DB Check 2: Nixon's Recent Attendance ✓ / ✗

```sql
SELECT punch_date, punch_time, punch_type 
FROM attendance_log 
WHERE employee_id = (SELECT id FROM employee WHERE employee_code = 'MAS00176')
ORDER BY punch_date DESC LIMIT 5;
```

**Expected:** At least 1 record if Nixon has attendance  
**Actual:** ___________  
**Status:** PASS / FAIL

---

### DB Check 3: Pending Regularizations ✓ / ✗

```sql
SELECT COUNT(*) as pending_count
FROM employee_request 
WHERE request_type_code = 'ATTENDANCE_REGULARIZATION' 
  AND current_status IN ('submitted', 'pending_manager', 'pending_admin');
```

**Expected:** >= 0  
**Actual:** ___________  
**Status:** PASS / FAIL

---

### DB Check 4: Active Shifts ✓ / ✗

```sql
SELECT COUNT(*) as active_shifts
FROM wfm_shift 
WHERE active_status = 1;
```

**Expected:** > 0 (at least 1 shift configured)  
**Actual:** ___________  
**Status:** PASS / FAIL

---

### DB Check 5: Current Week Roster Assignments ✓ / ✗

```sql
SELECT COUNT(*) as assigned_days
FROM roster_assignment 
WHERE roster_date >= CURDATE();
```

**Expected:** >= 0  
**Actual:** ___________  
**Status:** PASS / FAIL

---

## Test Summary

**Date Executed:** __________  
**Tester Name:** __________  
**Duration:** __________ minutes  

### Results

| Category | Total | Pass | Fail | Skip |
|----------|-------|------|------|------|
| Functional Tests | 11 | ___ | ___ | ___ |
| Security Tests | 5 | ___ | ___ | ___ |
| DB Validation | 5 | ___ | ___ | ___ |
| **TOTAL** | **21** | **___** | **___** | **___** |

### Issues Summary

**Critical Issues:** ___________  
**High Priority Issues:** ___________  
**Medium Priority Issues:** ___________  
**Low Priority Issues:** ___________  

**Security Gaps Found:** ___________  

### Overall Status

- [ ] PASS - All tests passed, no critical issues
- [ ] PASS WITH ISSUES - Tests passed but minor issues found
- [ ] FAIL - Critical issues blocking functionality
- [ ] INCOMPLETE - Tests not completed

### Recommendations

```
[Write recommendations here]
```

---

## Appendix: Quick Commands

### Start Servers
```bash
# Backend
cd /home/shuvam/hrms-audit/backend && npm run dev

# Frontend
cd /home/shuvam/hrms-audit && npm run dev
```

### Run API Tests
```bash
cd /home/shuvam/hrms-audit
chmod +x test-attendance-wfm-api.sh
./test-attendance-wfm-api.sh
```

### Database Connection
```bash
mysql -h 122.184.128.90 -u <user> -p mas_hrms
```

### Check Health
```bash
curl http://localhost:5055/api/health | jq '.'
```

---

**Test Complete!** Upload results and screenshots for review.
