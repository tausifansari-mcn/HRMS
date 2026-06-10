# HRMS Attendance & WFM Frontend Testing Report
**Date:** 2026-06-08  
**Environment:** 
- Frontend: http://localhost:8080
- Backend: http://localhost:5055
- Database: mas_hrms on MySQL 122.184.128.90

---

## Executive Summary

This document provides a comprehensive step-by-step testing plan for HRMS Attendance and Workforce Management (WFM) frontend pages including:
- Employee self-service attendance marking
- Attendance history and calendar views
- Regularization request and approval workflow
- Manager team attendance views
- Shift management
- Roster planning and assignment
- Live attendance dashboard
- Reporting and exports
- Security boundary validation

---

## Test Credentials

### REAL Production Accounts (Use these for testing)

**Admin Account:**
```
Employee Code: ADMIN001
Name: Shivam Giri
Email: shivam.giri@teammas.in
Designation: Admin
Role: admin
User ID: a4a4902e-6222-11f1-adb1-00155d0ab410
```

**Regular Employee (Self-service testing):**
```
Employee Code: MAS00176
Name: Nixon Sethi
Email: nixon.sethi@teammas.in
Designation: DY. MANAGER
Branch: HEAD OFFICE
Use Case: Clock in/out, view own attendance, submit regularization
```

**Team Leader (Team attendance view):**
```
Employee Code: MAS07761
Name: Rupali Chopra
Email: RUPALI.CHOPRA@TEAMMAS.IN
Designation: TEAM LEADER
Branch: MEERUT
Use Case: View team attendance, approve/reject regularizations for team members
```

**Branch Manager (Approval authority):**
```
Employee Code: MAS04461
Name: Ankit Sharma
Email: ANKIT.SHARMA@TEAMMAS.IN
Designation: BRANCH MANAGER
Branch: MEERUT
Use Case: Approve regularizations, manage roster, view branch-wide reports
```

**Process Manager (Roster planning):**
```
Employee Code: MAS07068
Name: Sushant Chopra
Email: SUSHANT.CHOPRA@TEAMMAS.IN
Designation: PROCESS MANAGER
Branch: MEERUT
Use Case: Create roster cycles, assign shifts, publish rosters
```

**HR Executive:**
```
Employee Code: MAS05974
Name: Deepika Kadyan
Email: deepika.kadyan@teammas.in
Designation: SR. EXECUTIVE - HR
Branch: KARNAL
Use Case: Attendance reports, HR analytics, policy management
```

**Demo/Test User (Fallback):**
```
Email: admin@mascallnet.com
Password: Admin@123
User ID: demo-admin-id
Employee ID: emp-admin-001
Note: This is a demo account from seeded data, may not have real attendance records
```

---

## Frontend Routes Mapping

### Attendance Routes
| Route | Page Component | Access Level | Description |
|-------|---------------|--------------|-------------|
| `/attendance` | `Attendance.tsx` | All employees | Self-service clock in/out, view own attendance |
| `/attendance-regularization` | `AttendanceRegularization.tsx` | All employees | Request attendance corrections |
| `/attendance-rules-master` | `NativeAttendanceRulesMaster.tsx` | All employees | View attendance rules |

### WFM Routes
| Route | Page Component | Access Level | Description |
|-------|---------------|--------------|-------------|
| `/wfm/roster` | `NativeWFMRoster.tsx` | Admin/WFM/Manager (Gate: WFM_ROSTER) | Weekly roster planning & governance |
| `/wfm/live-tracker` | Placeholder | Admin/WFM/Manager (Gate: WFM_LIVE_TRACKER) | Real-time attendance dashboard |
| `/wfm/extensions` | `NativeWFMExtensions.tsx` | Admin/WFM (Gate: WFM_EXTENSIONS) | WFM advanced features |
| `/wfm/auto-roster` | `NativeWFMAutoRoster.tsx` | Admin/WFM (Gate: WFM_AUTO_ROSTER) | Automated roster generation |

### Roster Routes
| Route | Page Component | Access Level | Description |
|-------|---------------|--------------|-------------|
| `/my-roster` | `NativeMyRoster.tsx` | All employees | View personal roster schedule |
| `/roster-preference` | `NativeRosterPreference.tsx` | All employees | Submit shift preferences |
| `/roster-master-builder` | `NativeRosterMasterBuilder.tsx` | Admin/WFM (Gate: ROSTER_MASTER) | Build roster templates |
| `/roster-capacity-config` | `NativeRosterCapacityConfig.tsx` | Admin/WFM (Gate: ROSTER_MASTER) | Configure capacity rules |

---

## Backend API Endpoints

### Attendance Endpoints
```
POST   /api/wfm/sessions/clock-in          - Employee clock in (self-service)
POST   /api/wfm/sessions/clock-out         - Employee clock out (self-service)
POST   /api/wfm/sessions/break             - Log break (self-service)
GET    /api/wfm/sessions                   - List sessions (admin/wfm/manager)
```

### Regularization Endpoints
```
POST   /api/wfm/regularizations            - Submit regularization (employee)
GET    /api/wfm/regularizations            - List regularizations (admin/wfm/manager)
PATCH  /api/wfm/regularizations/:id/review - Approve/reject (admin/wfm/manager)
```

### Shift Endpoints
```
GET    /api/wfm/shifts                     - List shifts (admin/wfm/manager)
POST   /api/wfm/shifts                     - Create shift (admin/wfm)
GET    /api/wfm/shifts/:id                 - Get shift details (admin/wfm/manager)
PUT    /api/wfm/shifts/:id                 - Update shift (admin/wfm)
```

### Roster Governance Endpoints
```
GET    /api/roster-gov/shifts/templates    - List shift templates
POST   /api/roster-gov/shifts/templates    - Create shift template
GET    /api/roster-gov/cycles              - List roster cycles
POST   /api/roster-gov/cycles              - Create roster cycle
POST   /api/roster-gov/cycles/:id/status   - Advance cycle status
GET    /api/roster-gov/cycles/:id/assignments - Get cycle assignments
POST   /api/roster-gov/cycles/:id/assignments/bulk - Bulk assign
POST   /api/roster-gov/coverage-actions    - Raise coverage action
```

### Live Tracker Endpoint
```
GET    /api/wfm/live?date=YYYY-MM-DD       - Live attendance data (admin/wfm/manager)
```

### Roster Preference Endpoints
```
POST   /api/wfm/roster-preferences         - Submit preference (employee)
GET    /api/wfm/roster-preferences/my      - Get my preferences (employee)
GET    /api/wfm/roster-preferences/pending - Pending approvals (admin/hr/manager/wfm)
PATCH  /api/wfm/roster-preferences/:id/approve - Approve preference
PATCH  /api/wfm/roster-preferences/:id/reject  - Reject preference
```

### Attendance Engine Endpoints
```
GET    /api/attendance-engine/rules        - List attendance rules
POST   /api/attendance-engine/rules        - Create rule (admin)
PATCH  /api/attendance-engine/rules/:id    - Update rule (admin)
DELETE /api/attendance-engine/rules/:id    - Delete rule (admin)
GET    /api/attendance-engine/rules/resolve - Simulate rule resolution
POST   /api/attendance-engine/process      - Trigger attendance processing (admin/hr/wfm)
GET    /api/attendance-engine/daily        - List daily records
```

---

## Step-by-Step Test Plan

### STEP 1: Employee Self-Clock In
**Page:** `/attendance` (Attendance.tsx)
**Role:** Employee (self-service)

**Test Actions:**
1. Navigate to http://localhost:8080/attendance
2. Verify page loads without errors
3. Check UI elements:
   - Current time display
   - Clock In button (if not clocked in)
   - Clock Out button (if clocked in)
   - Employee's shift information visible
   - Today's attendance status card
   - Break controls (Pause/Resume)
   
**Expected Elements:**
- LogIn/LogOut icons from lucide-react
- Timer display showing current time
- Location capture (MapPin icon) if geo-fencing enabled
- Work mode selector (Office/Remote/Hybrid)
- Break timer display if break active

**API Call to Verify:**
```bash
curl -X POST http://localhost:5055/api/wfm/sessions/clock-in \
  -H "Authorization: Bearer mock-token-admin" \
  -H "Content-Type: application/json" \
  -d '{"location": {"latitude": 12.9716, "longitude": 77.5946}, "workMode": "office"}'
```

**Security Check:**
- Employee can only clock in for themselves (not others)
- Location validation if geo-fencing enabled
- Cannot clock in twice without clocking out

**Screenshot:** `step1_clock_in_page.png`

---

### STEP 2: My Attendance View
**Page:** `/attendance` (Attendance.tsx - History tab/section)
**Role:** Employee

**Test Actions:**
1. Same page as Step 1, scroll to attendance history section
2. Verify personal attendance calendar loads
3. Check month selector (dropdown showing months)
4. Verify attendance records table displays:
   - Date
   - Day
   - Clock In time
   - Clock Out time
   - Total hours
   - Break hours
   - Status (Present/Absent/Half-day)
   - Attendance source (biometric/dialler)
   
**Expected Behavior:**
- Shows current month by default
- Can navigate to previous months
- Color-coded status badges (green=Present, red=Absent, amber=Half-day)
- Pagination for large datasets
- Sortable columns

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/attendance-engine/daily?employeeId=emp-admin-001&fromDate=2026-06-01&toDate=2026-06-30" \
  -H "Authorization: Bearer mock-token-admin"
```

**Screenshot:** `step2_my_attendance_view.png`

---

### STEP 3: Regularization Request
**Page:** `/attendance-regularization` (AttendanceRegularization.tsx)
**Role:** Employee

**Test Actions:**
1. Navigate to http://localhost:8080/attendance-regularization
2. Click "New Request" or "Submit Regularization" button
3. Verify form fields:
   - Attendance Date (date picker)
   - Current Status dropdown (Absent/Present/Half-day)
   - Current Login Time (time picker)
   - Current Logout Time (time picker)
   - Requested Login Time (time picker)
   - Requested Logout Time (time picker)
   - Reason (textarea)
   - Supporting Document Upload (optional)
   
**Form Validation:**
- Date cannot be future date
- Requested times must be valid
- Reason is mandatory
- Cannot request for same date twice if pending

**API Call to Verify:**
```bash
curl -X POST http://localhost:5055/api/wfm/regularizations \
  -H "Authorization: Bearer mock-token-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "attendanceDate": "2026-06-07",
    "currentStatus": "Absent",
    "requestedLoginTime": "09:30",
    "requestedLogoutTime": "18:30",
    "reason": "System did not capture my attendance",
    "attendanceSource": "biometric"
  }'
```

**Expected Behavior:**
- Form submits successfully
- Request gets status "submitted" or "pending_manager"
- Confirmation message shown
- Redirects to requests list

**Screenshot:** `step3_regularization_request_form.png`

---

### STEP 4: Manager Team Attendance View
**Page:** `/attendance` (Attendance.tsx with manager role)
**Role:** Manager/Admin

**Test Actions:**
1. Login as manager/admin
2. Navigate to /attendance
3. Check for "Team Attendance" tab or section
4. Verify team members list with:
   - Employee name
   - Employee code
   - Today's status (Present/Absent/On Leave)
   - Clock in time
   - Expected shift time
   - Late/Early indicators
   - Department/Process filter
   
**Expected Behavior:**
- Shows all direct reports if manager
- Shows all employees if admin
- Filter by department/branch/process
- Export to CSV/Excel option
- Drill-down to individual employee details

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/wfm/sessions?date=2026-06-08&limit=50" \
  -H "Authorization: Bearer mock-token-admin"
```

**Screenshot:** `step4_team_attendance_dashboard.png`

---

### STEP 5: Regularization Approval Queue
**Page:** `/attendance-regularization` (AttendanceRegularization.tsx - Approvals tab)
**Role:** Manager/Admin/HR

**Test Actions:**
1. Login as manager/admin
2. Navigate to /attendance-regularization
3. Click "Pending Approvals" tab
4. Verify pending requests list showing:
   - Request number
   - Employee name
   - Date
   - Current status vs Requested status
   - Current timings vs Requested timings
   - Reason
   - Submitted date
   - Action buttons (Approve/Reject)
   
**Test Actions:**
- Click "View Details" on a request
- Verify details modal shows:
  - Full request information
  - Approval stage history
  - Action log
  - Approve button
  - Reject button with remarks field

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/wfm/regularizations?status=pending_manager,pending_admin" \
  -H "Authorization: Bearer mock-token-admin"
```

**Security Check:**
- Manager can only see team members' requests
- Admin/HR can see all requests
- Cannot approve own requests

**Screenshot:** `step5_regularization_approval_queue.png`

---

### STEP 6: Shift Management
**Page:** `/wfm/roster` (NativeWFMRoster.tsx - Shift Template section)
**Role:** Admin/WFM

**Test Actions:**
1. Navigate to http://localhost:8080/wfm/roster
2. Select a process from dropdown
3. Scroll to "Shift Template" section
4. Verify existing shifts list showing:
   - Shift code (DAY, NIGHT, EVENING, etc.)
   - Shift name
   - Start time
   - End time
   - Version
   
5. Test create new shift:
   - Code: "TEST_SHIFT"
   - Name: "Test Shift"
   - Start: 10:00
   - End: 19:00
   - Click "Save Shift"

**Expected Behavior:**
- New shift appears in list immediately
- Validation prevents overlapping shifts
- Shift templates are process-specific
- Version number increments on changes

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/roster-gov/shifts/templates?process_id=<process-id>&active_status=1" \
  -H "Authorization: Bearer mock-token-admin"
```

**Screenshot:** `step6_shift_management.png`

---

### STEP 7: Roster Planning (Weekly Cycle)
**Page:** `/wfm/roster` (NativeWFMRoster.tsx)
**Role:** Admin/WFM/Process Manager

**Test Actions:**
1. Same page as Step 6
2. Scroll to "Weekly Cycle" section
3. Test create new cycle:
   - Start Date: Monday of current week
   - End Date: Sunday of current week
   - Required HC: 50
   - Click "Create Draft Cycle"
   
4. Verify cycle appears in list with status "draft"
5. Click on cycle to select it
6. Verify "Advance to submitted" button appears
7. Test status transitions:
   - draft → submitted → reviewed → published

**Expected Behavior:**
- Only one draft cycle per week per process
- Cannot create overlapping cycles
- Status transitions are controlled
- Only Process Manager/WFM can advance status

**Roster Lifecycle:**
```
draft → submitted → reviewed → published → acknowledged → 
active → variance_review → attendance_locked → 
payroll_input_ready → closed
```

**Screenshot:** `step7_roster_planning_cycle.png`

---

### STEP 8: Roster Assignment (Bulk Import)
**Page:** `/wfm/roster` (NativeWFMRoster.tsx - Draft Allocations section)
**Role:** Admin/WFM/Process Manager

**Test Actions:**
1. Select a draft cycle from Step 7
2. Scroll to "Draft Allocations" section
3. See JSON import textarea
4. Prepare sample assignment JSON:

```json
[
  {
    "employee_id": "emp-admin-001",
    "roster_date": "2026-06-09",
    "shift_template_id": "<shift-id>",
    "is_week_off": 0
  },
  {
    "employee_id": "emp-admin-001",
    "roster_date": "2026-06-10",
    "shift_template_id": "<shift-id>",
    "is_week_off": 0
  }
]
```

5. Paste JSON and click "Save Assignments"
6. Verify assignments appear in "Roster Assignments" table below

**Expected Behavior:**
- JSON validation before save
- Validates employee_id exists
- Validates shift_template_id exists in process
- Cannot assign shifts for published cycles
- Duplicate date assignments are rejected

**API Call to Verify:**
```bash
curl -X POST "http://localhost:5055/api/roster-gov/cycles/<cycle-id>/assignments/bulk" \
  -H "Authorization: Bearer mock-token-admin" \
  -H "Content-Type: application/json" \
  -d '{"assignments": [...]}'
```

**Screenshot:** `step8_roster_assignment_bulk.png`

---

### STEP 9: My Roster (Employee View)
**Page:** `/my-roster` (NativeMyRoster.tsx)
**Role:** Employee

**Test Actions:**
1. Navigate to http://localhost:8080/my-roster
2. Verify weekly calendar view loads
3. Check elements:
   - Week navigation arrows (previous/next week)
   - Current week highlighted
   - 7 day columns (Mon-Sun)
   - Each day shows:
     - Date
     - Shift name (if assigned)
     - Shift timings
     - Week off indicator
     - Holiday indicator
     - Leave overlay (if leave approved)
   
4. Test week navigation:
   - Click "Next Week" arrow
   - Click "Previous Week" arrow
   - Verify roster updates

5. Test acknowledgement:
   - If cycle is published but not acknowledged
   - "Acknowledge Roster" button appears
   - Click to acknowledge
   - Status changes to "acknowledged"

**Expected Behavior:**
- Shows only employee's own roster
- Cannot view other employees' rosters
- Leave overlays shown with leave type
- Holidays marked clearly
- Can download roster as PDF

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/roster-gov/cycles/<cycle-id>/assignments?employee_id=emp-admin-001" \
  -H "Authorization: Bearer mock-token-admin"
```

**Screenshot:** `step9_my_roster_view.png`

---

### STEP 10: Live Attendance Dashboard
**Page:** `/wfm/live-tracker` (Currently placeholder, but API exists)
**Role:** Admin/WFM/Manager

**Test Actions:**
1. Navigate to http://localhost:8080/wfm/live-tracker
2. Expected to see placeholder or live implementation
3. If implemented (based on NativeWFMLiveTracker.tsx):
   - Date selector (defaults to today)
   - Summary stats cards:
     - Total Rostered
     - Logged In (green)
     - Logged Out (gray)
     - Absent (red)
     - Overall Adherence %
   
   - Live employee list table:
     - Employee name
     - Process
     - Branch
     - Shift timings
     - Login time
     - Status badge (Logged In/On Break/Logged Out/Absent)
     
   - Filters:
     - Process filter
     - Branch filter
     - Search by name

4. Test SSE real-time updates:
   - Stats should auto-refresh every 30 seconds
   - No page reload needed

**Expected Behavior:**
- Real-time updates via Server-Sent Events (SSE)
- Color-coded status badges
- Late arrivals highlighted in amber
- Early departures shown
- Can drill down to employee details

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/wfm/live?date=2026-06-08" \
  -H "Authorization: Bearer mock-token-admin"
```

**Screenshot:** `step10_live_attendance_dashboard.png`

---

### STEP 11: Attendance Reports
**Page:** `/attendance` (Attendance.tsx - Reports section) or dedicated reports page
**Role:** Admin/HR/Manager

**Test Actions:**
1. Navigate to attendance page or reports section
2. Look for "Reports" or "Export" tab/button
3. Verify report generation form:
   - Date range picker (From - To)
   - Employee filter (single/multiple/all)
   - Department filter
   - Branch filter
   - Process filter
   - Report type dropdown:
     - Monthly Attendance Summary
     - Daily Attendance Log
     - Regularization History
     - Late Arrival Report
     - Early Departure Report
   
4. Test report generation:
   - Select date range: 2026-06-01 to 2026-06-30
   - Select all employees
   - Click "Generate Report"
   
5. Verify export options:
   - Download as CSV
   - Download as PDF
   - Download as Excel

**Expected Behavior:**
- Report shows correct data
- Filters apply correctly
- Export formats work
- Large datasets paginated
- Manager sees only team reports
- Admin/HR sees all

**API Call to Verify:**
```bash
curl "http://localhost:5055/api/attendance-engine/daily?fromDate=2026-06-01&toDate=2026-06-30&limit=1000" \
  -H "Authorization: Bearer mock-token-admin"
```

**Screenshot:** `step11_attendance_reports.png`

---

### STEP 12: Security Validation Tests

#### Test 12.1: Employee Cannot Mark Others' Attendance
**Scenario:** Employee A tries to clock in for Employee B

**Steps:**
1. Login as Employee A (emp-admin-001)
2. Try to manipulate API request to clock in for Employee B:

```bash
curl -X POST http://localhost:5055/api/wfm/sessions/clock-in \
  -H "Authorization: Bearer <employee-a-token>" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "emp-other-001", "location": {...}}'
```

**Expected Result:**
- 403 Forbidden error
- Message: "Cannot mark attendance for other employees"
- Clock in fails

**Security Check:** ✓ PASS / ✗ FAIL

---

#### Test 12.2: Cannot Approve Own Regularization
**Scenario:** Employee submits regularization and tries to approve it themselves

**Steps:**
1. Login as Employee (emp-admin-001)
2. Submit regularization request
3. Try to approve it via API:

```bash
curl -X PATCH "http://localhost:5055/api/wfm/regularizations/<request-id>/review" \
  -H "Authorization: Bearer <same-employee-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "approved", "remarks": "Self-approved"}'
```

**Expected Result:**
- 403 Forbidden error
- Message: "Cannot approve own regularization request"
- Request remains in pending state

**Security Check:** ✓ PASS / ✗ FAIL

---

#### Test 12.3: Role-Based Access Control
**Scenario:** Non-manager tries to access team attendance

**Steps:**
1. Login as regular employee (non-manager)
2. Try to access manager endpoints:

```bash
curl "http://localhost:5055/api/wfm/sessions?limit=50" \
  -H "Authorization: Bearer <employee-token>"
```

**Expected Result:**
- 403 Forbidden error
- Message: "Insufficient permissions"
- Access denied

**Security Check:** ✓ PASS / ✗ FAIL

---

#### Test 12.4: WFM Route Gate Protection
**Scenario:** Non-admin tries to access WFM roster page

**Steps:**
1. Login as regular employee
2. Navigate to http://localhost:8080/wfm/roster
3. Verify Gate component blocks access

**Expected Result:**
- Redirected to access denied page OR
- Message: "You don't have permission to view this page"
- Page content not rendered

**Security Check:** ✓ PASS / ✗ FAIL

---

#### Test 12.5: Roster Modification After Publication
**Scenario:** Try to modify published roster

**Steps:**
1. Create and publish a roster cycle
2. Try to add/modify assignments:

```bash
curl -X POST "http://localhost:5055/api/roster-gov/cycles/<cycle-id>/assignments/bulk" \
  -H "Authorization: Bearer mock-token-admin" \
  -H "Content-Type: application/json" \
  -d '{"assignments": [...]}'
```

**Expected Result:**
- 400 Bad Request error
- Message: "Cannot modify published roster without change control"
- Assignments not updated

**Security Check:** ✓ PASS / ✗ FAIL

---

## Database Validation Queries

### REAL Employee Attendance Data Checks

```sql
-- 1. Nixon Sethi (MAS00176) Recent Attendance
SELECT 
    e.employee_code,
    e.first_name,
    e.last_name,
    al.punch_date,
    al.punch_time,
    al.punch_type,
    al.punch_source
FROM attendance_log al
JOIN employee e ON e.id = al.employee_id
WHERE e.employee_code = 'MAS00176'
ORDER BY al.punch_date DESC, al.punch_time DESC
LIMIT 10;

-- 2. Rupali Chopra Team Attendance (MEERUT Branch)
SELECT 
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    e.designation,
    COUNT(DISTINCT al.punch_date) as days_present
FROM employee e
LEFT JOIN attendance_log al ON al.employee_id = e.id 
    AND al.punch_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE e.branch = 'MEERUT'
  AND e.status = 'active'
GROUP BY e.id, e.employee_code, employee_name, e.designation
ORDER BY e.employee_code;

-- 3. Today's Attendance Summary by Branch
SELECT 
    b.branch_name,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE 
        WHEN al.punch_date = CURDATE() AND al.punch_type = 'IN' 
        THEN al.employee_id 
    END) as present_today
FROM branch b
LEFT JOIN employee e ON e.branch_id = b.id AND e.status = 'active'
LEFT JOIN attendance_log al ON al.employee_id = e.id
GROUP BY b.id, b.branch_name
ORDER BY b.branch_name;
```

### Check Attendance Data
```sql
-- Today's attendance count
SELECT COUNT(*) as today_punches 
FROM attendance_log 
WHERE punch_date = CURDATE();

-- Today's unique employees who clocked in
SELECT COUNT(DISTINCT employee_id) as unique_employees_today
FROM attendance_log
WHERE punch_date = CURDATE() 
  AND punch_type = 'IN';

-- Active sessions (not yet clocked out)
SELECT COUNT(*) as active_sessions 
FROM wfm_attendance_session 
WHERE clock_out_at IS NULL
  AND DATE(clock_in_at) = CURDATE();

-- Late arrivals today (based on attendance_daily_processed)
SELECT COUNT(*) as late_count 
FROM attendance_daily_processed 
WHERE attendance_date = CURDATE() 
  AND late_arrival_flag = 1;

-- Attendance by source (dialler vs biometric)
SELECT 
    punch_source,
    COUNT(*) as punch_count,
    COUNT(DISTINCT employee_id) as unique_employees
FROM attendance_log
WHERE punch_date = CURDATE()
GROUP BY punch_source;
```

### Check Regularization Requests
```sql
-- Pending regularizations (detailed)
SELECT 
    er.request_no,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    rrd.attendance_date,
    rrd.current_status,
    rrd.requested_login_time,
    rrd.requested_logout_time,
    er.current_status,
    er.submitted_at
FROM employee_request er
JOIN regularization_request_detail rrd ON rrd.request_id = er.id
JOIN employee e ON e.id = er.employee_id
WHERE er.request_type_code = 'ATTENDANCE_REGULARIZATION' 
  AND er.current_status IN ('submitted', 'pending_manager', 'pending_admin')
ORDER BY er.submitted_at DESC;

-- Regularizations by status
SELECT 
    current_status,
    COUNT(*) as count,
    COUNT(DISTINCT employee_id) as unique_employees
FROM employee_request 
WHERE request_type_code = 'ATTENDANCE_REGULARIZATION' 
GROUP BY current_status
ORDER BY count DESC;

-- Recent approvals/rejections
SELECT 
    er.request_no,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    er.current_status,
    er.final_decision_at,
    ras.remarks
FROM employee_request er
JOIN employee e ON e.id = er.employee_id
LEFT JOIN request_approval_stage ras ON ras.request_id = er.id 
    AND ras.acted_at = er.final_decision_at
WHERE er.request_type_code = 'ATTENDANCE_REGULARIZATION' 
  AND er.current_status IN ('approved', 'rejected')
ORDER BY er.final_decision_at DESC
LIMIT 10;
```

### Check WFM Shifts
```sql
-- Active shifts (global)
SELECT 
    shift_id, 
    shift_name, 
    shift_code,
    in_time, 
    out_time, 
    total_hours,
    active_status 
FROM wfm_shift 
WHERE active_status = 1
ORDER BY shift_name;

-- Shift templates by process (Roster Governance)
SELECT 
    st.id, 
    st.shift_code, 
    st.shift_name, 
    st.start_time, 
    st.end_time, 
    st.version,
    p.process_name,
    st.effective_from,
    st.effective_to
FROM roster_shift_template st
JOIN process p ON p.id = st.process_id
WHERE st.active_status = 1
ORDER BY p.process_name, st.shift_code;

-- Employee shift assignments (current)
SELECT 
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    s.shift_name,
    s.in_time,
    s.out_time
FROM employee e
LEFT JOIN wfm_shift s ON s.shift_id = e.shift_id
WHERE e.status = 'active'
  AND e.branch = 'MEERUT'
ORDER BY e.employee_code
LIMIT 20;
```

### Check Roster Assignments
```sql
-- Current week roster for MEERUT branch
SELECT 
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    ra.roster_date,
    DAYNAME(ra.roster_date) as day_name,
    st.shift_name,
    st.start_time,
    st.end_time,
    ra.is_week_off,
    ra.acknowledgement_status
FROM roster_assignment ra
JOIN employee e ON e.id = ra.employee_id
LEFT JOIN roster_shift_template st ON st.id = ra.shift_template_id
WHERE e.branch = 'MEERUT'
  AND ra.roster_date BETWEEN DATE_FORMAT(NOW(), '%Y-%m-%d') 
    AND DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-%d'), INTERVAL 6 DAY)
ORDER BY e.employee_code, ra.roster_date;

-- Roster cycles by status
SELECT 
    rc.id,
    rc.week_start_date,
    rc.week_end_date,
    rc.status,
    p.process_name,
    rc.created_at,
    COUNT(ra.id) as assignment_count
FROM roster_cycle rc
LEFT JOIN process p ON p.id = rc.process_id
LEFT JOIN roster_assignment ra ON ra.cycle_id = rc.id
GROUP BY rc.id, rc.week_start_date, rc.week_end_date, rc.status, p.process_name, rc.created_at
ORDER BY rc.week_start_date DESC
LIMIT 10;

-- Unacknowledged rosters
SELECT 
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    COUNT(*) as unacknowledged_days
FROM roster_assignment ra
JOIN employee e ON e.id = ra.employee_id
WHERE ra.acknowledgement_status = 'pending' 
  AND ra.roster_date >= CURDATE()
GROUP BY e.id, e.employee_code, employee_name
ORDER BY unacknowledged_days DESC;

-- Coverage action tracking
SELECT 
    ca.action_date,
    ca.coverage_gap,
    ca.root_cause,
    ca.recovery_plan,
    ca.status,
    ca.raised_by,
    ca.raised_at
FROM roster_coverage_action ca
WHERE ca.action_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY ca.action_date DESC;
```

### Attendance Rules Resolution
```sql
-- Active attendance rules
SELECT 
    ar.id,
    ar.rule_name,
    ar.scope_type,
    ar.attendance_source,
    ar.full_day_minutes,
    ar.half_day_minutes,
    ar.grace_minutes,
    ar.effective_from,
    ar.effective_to,
    ar.active_status
FROM attendance_rule ar
WHERE ar.active_status = 1
ORDER BY ar.scope_type, ar.effective_from DESC;

-- Which rule applies to Nixon Sethi?
SELECT 
    ar.*,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    e.designation,
    e.branch
FROM employee e
LEFT JOIN attendance_rule ar ON (
    (ar.scope_type = 'global') OR
    (ar.scope_type = 'designation' AND ar.designation_id = e.designation_id) OR
    (ar.scope_type = 'branch' AND ar.branch_id = e.branch_id) OR
    (ar.scope_type = 'process' AND ar.process_id = e.current_process_id)
)
WHERE e.employee_code = 'MAS00176'
  AND (ar.active_status = 1 OR ar.id IS NULL)
  AND (ar.effective_from <= CURDATE() OR ar.effective_from IS NULL)
  AND (ar.effective_to >= CURDATE() OR ar.effective_to IS NULL)
ORDER BY 
    CASE ar.scope_type
        WHEN 'designation' THEN 1
        WHEN 'process' THEN 2
        WHEN 'branch' THEN 3
        WHEN 'global' THEN 4
    END;
```

---

## Critical Issues to Document

### UI/UX Issues
- [ ] Page load times > 3 seconds
- [ ] Broken layouts on mobile devices
- [ ] Buttons not responsive to clicks
- [ ] Forms not validating input
- [ ] Error messages not user-friendly
- [ ] Missing loading indicators
- [ ] Date pickers not working
- [ ] Time pickers showing wrong format
- [ ] Tables not paginating correctly
- [ ] Export buttons not generating files

### Data Accuracy Issues
- [ ] Attendance times showing in wrong timezone
- [ ] Total hours calculation incorrect
- [ ] Late/early flags not applied correctly
- [ ] Break hours not deducted from total
- [ ] Week-off days showing as absent
- [ ] Leave days not overlaid on roster
- [ ] Holiday attendance marked as present
- [ ] Shift timings not matching roster

### Security Gaps
- [ ] Employee can view others' attendance
- [ ] Employee can mark attendance for others
- [ ] Employee can approve own regularization
- [ ] Non-manager accessing team data
- [ ] Non-admin accessing WFM pages
- [ ] Published roster can be modified
- [ ] No audit trail for approvals
- [ ] Missing CSRF protection
- [ ] JWT tokens not expiring
- [ ] Sensitive data in browser console

### Functional Bugs
- [ ] Clock in fails with location error
- [ ] Clock out not updating session
- [ ] Break timer not stopping on resume
- [ ] Regularization submission times out
- [ ] Approval action not updating status
- [ ] Roster assignment validation missing
- [ ] Live dashboard not refreshing
- [ ] Reports showing empty data
- [ ] Export generating corrupt files
- [ ] Acknowledgement not saving

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend server running on port 5055
- [ ] Frontend dev server running on port 8080
- [ ] MySQL database accessible at 122.184.128.90
- [ ] Test user accounts created
- [ ] Sample data seeded (employees, shifts, processes)
- [ ] Browser dev tools ready for network inspection
- [ ] Screenshot tool ready

### Test Execution
- [ ] Step 1: Clock In Page - TESTED
- [ ] Step 2: My Attendance View - TESTED
- [ ] Step 3: Regularization Request - TESTED
- [ ] Step 4: Team Attendance View - TESTED
- [ ] Step 5: Regularization Approvals - TESTED
- [ ] Step 6: Shift Management - TESTED
- [ ] Step 7: Roster Planning - TESTED
- [ ] Step 8: Roster Assignment - TESTED
- [ ] Step 9: My Roster View - TESTED
- [ ] Step 10: Live Dashboard - TESTED
- [ ] Step 11: Attendance Reports - TESTED
- [ ] Step 12: Security Validation - TESTED

### Post-Test
- [ ] All screenshots captured
- [ ] Issues documented with severity
- [ ] Security findings reported
- [ ] Performance issues logged
- [ ] Test result JSON generated
- [ ] Database validation queries run
- [ ] Final report compiled

---

## Test Results JSON Template

```json
{
  "test_execution_date": "2026-06-08",
  "environment": {
    "frontend_url": "http://localhost:8080",
    "backend_url": "http://localhost:5055",
    "database": "mas_hrms @ 122.184.128.90"
  },
  "test_results": {
    "clock_in": {
      "status": "pass|fail",
      "ui_works": true|false,
      "api_response": "200|error",
      "issues": ["..."]
    },
    "my_attendance": {
      "status": "pass|fail",
      "data_accurate": true|false,
      "calendar_loads": true|false,
      "issues": ["..."]
    },
    "regularization_request": {
      "status": "pass|fail",
      "form_complete": true|false,
      "submission_works": true|false,
      "validation_works": true|false,
      "issues": ["..."]
    },
    "team_attendance": {
      "status": "pass|fail",
      "manager_view_works": true|false,
      "filters_work": true|false,
      "issues": ["..."]
    },
    "regularization_approvals": {
      "status": "pass|fail",
      "queue_loads": true|false,
      "approve_action_works": true|false,
      "reject_action_works": true|false,
      "issues": ["..."]
    },
    "shift_management": {
      "status": "pass|fail",
      "shifts_visible": true|false,
      "create_shift_works": true|false,
      "issues": ["..."]
    },
    "roster_planning": {
      "status": "pass|fail",
      "cycle_creation_works": true|false,
      "status_transitions_work": true|false,
      "issues": ["..."]
    },
    "roster_assignment": {
      "status": "pass|fail",
      "bulk_import_works": true|false,
      "validation_works": true|false,
      "issues": ["..."]
    },
    "my_roster": {
      "status": "pass|fail",
      "schedule_visible": true|false,
      "navigation_works": true|false,
      "acknowledgement_works": true|false,
      "issues": ["..."]
    },
    "live_dashboard": {
      "status": "pass|fail",
      "real_time_updates": true|false,
      "filters_work": true|false,
      "stats_accurate": true|false,
      "issues": ["..."]
    },
    "attendance_reports": {
      "status": "pass|fail",
      "report_generation_works": true|false,
      "export_csv_works": true|false,
      "export_pdf_works": true|false,
      "issues": ["..."]
    }
  },
  "security_tests": {
    "employee_cannot_mark_others": {
      "tested": true|false,
      "pass": true|false,
      "details": "..."
    },
    "cannot_approve_own_regularization": {
      "tested": true|false,
      "pass": true|false,
      "details": "..."
    },
    "role_based_access_control": {
      "tested": true|false,
      "pass": true|false,
      "details": "..."
    },
    "wfm_gate_protection": {
      "tested": true|false,
      "pass": true|false,
      "details": "..."
    },
    "roster_immutability_after_publish": {
      "tested": true|false,
      "pass": true|false,
      "details": "..."
    }
  },
  "database_validation": {
    "today_attendance_count": 0,
    "pending_regularizations": 0,
    "active_shifts": 0,
    "current_week_roster_assignments": 0,
    "queries_run": true|false
  },
  "summary": {
    "total_tests": 12,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "critical_issues_count": 0,
    "security_gaps_count": 0,
    "ui_bugs_count": 0
  },
  "critical_issues": [],
  "security_gaps": [],
  "ui_bugs": [],
  "recommendations": []
}
```

---

## Next Steps for Tester

1. **Setup Environment:**
   - Ensure both servers are running
   - Login with test credentials
   - Verify database connectivity

2. **Execute Tests:**
   - Follow steps 1-12 sequentially
   - Take screenshots at each step
   - Document all issues immediately
   - Note API response times

3. **Document Findings:**
   - Fill in the test results JSON
   - Categorize issues by severity (Critical/High/Medium/Low)
   - Provide reproduction steps for each issue
   - Suggest fixes where obvious

4. **Report:**
   - Generate final test report
   - Share screenshots
   - Prioritize critical security issues
   - Recommend immediate fixes

---

## Appendix: Key Files Reference

### Frontend Files
- `/src/pages/Attendance.tsx` - Main attendance page (1544 lines)
- `/src/pages/AttendanceRegularization.tsx` - Regularization workflows (823 lines)
- `/src/pages/NativeWFMRoster.tsx` - Roster governance (78 lines)
- `/src/pages/NativeMyRoster.tsx` - Employee roster view (405 lines)
- `/src/pages/NativeWFMLiveTracker.tsx` - Live attendance (491 lines)
- `/src/App.tsx` - Route definitions

### Backend Files
- `/backend/src/modules/wfm/wfm.routes.ts` - WFM API routes
- `/backend/src/modules/wfm/wfm.controller.ts` - WFM business logic
- `/backend/src/modules/wfm/attendance-engine.routes.ts` - Attendance processing
- `/backend/src/modules/wfm/roster.routes.ts` - Roster governance API
- `/backend/src/modules/wfm/liveTracker.service.ts` - Live tracker logic

### Database Schema
- `/backend/sql/005_attendance_wfm.sql` - Attendance & WFM schema
- `/backend/sql/012_roster_shift_times.sql` - Roster tables
- `/backend/sql/020_roster_governance.sql` - Governance model

---

**END OF TEST REPORT**
