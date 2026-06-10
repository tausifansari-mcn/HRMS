# Quick Start: Attendance & WFM Frontend Testing

**Date:** 2026-06-08  
**Time Required:** 2-3 hours for full test suite  
**Prerequisites:** Both servers running, test credentials ready

---

## Pre-Flight Checklist

```bash
# 1. Check servers are running
curl http://localhost:8080          # Frontend (should return HTML)
curl http://localhost:5055/api/health  # Backend (should return JSON)

# 2. Make API test script executable
cd /home/shuvam/hrms-audit
chmod +x test-attendance-wfm-api.sh

# 3. Run API tests first
./test-attendance-wfm-api.sh > api_test_results.log 2>&1
```

---

## Critical Test Scenarios (30-min smoke test)

### 1. Employee Self-Service (5 min)
**Login as:** nixon.sethi@teammas.in (MAS00176)

- Navigate to `/attendance`
- Verify you see YOUR OWN attendance only
- Click "Clock In" (DON'T submit)
- Check time display is correct
- Check location capture works (if enabled)

**Security Check:** Try to manipulate employeeId in API request - should fail

---

### 2. View My Attendance History (5 min)
**Same page** - Scroll to attendance table

- Verify attendance records load
- Check date range filter works
- Verify total hours calculation accurate
- Look for any missing data or null values

**Database Validation:**
```sql
-- Should return Nixon's recent attendance
SELECT punch_date, punch_time, punch_type 
FROM attendance_log 
WHERE employee_id = (SELECT id FROM employee WHERE employee_code = 'MAS00176')
ORDER BY punch_date DESC LIMIT 10;
```

---

### 3. Submit Regularization Request (5 min)
**Navigate to:** `/attendance-regularization`

- Click "New Request"
- Fill form:
  - Date: Yesterday
  - Current Status: Absent
  - Requested Login: 09:30
  - Requested Logout: 18:30
  - Reason: "Test - System missed my attendance"
- Submit (DON'T actually submit if you don't want test data)

**Expected:** Request created with status "pending_manager"

---

### 4. Manager Approval Flow (5 min)
**Login as:** ANKIT.SHARMA@TEAMMAS.IN (MAS04461 - Branch Manager)

- Navigate to `/attendance-regularization`
- Click "Pending Approvals" tab
- Verify you see team members' requests only (not all company)
- Click "View Details" on a request
- Check approve/reject buttons present

**Security Check:** Should NOT see requests from other branches (unless admin)

---

### 5. Roster View (5 min)
**Login as:** RUPALI.CHOPRA@TEAMMAS.IN (MAS07761 - Team Leader)

- Navigate to `/my-roster`
- Verify weekly roster calendar loads
- Check shift timings displayed correctly
- Navigate to next week/previous week
- Check week-off days marked clearly

**Expected:** Should see your OWN roster, not others'

---

### 6. Live Attendance Dashboard (5 min)
**Login as:** Admin or Manager

- Navigate to `/wfm/live-tracker`
- Check stats cards at top:
  - Total Rostered
  - Logged In (green)
  - Logged Out (gray)
  - Absent (red)
- Verify employee list loads
- Test filters (Branch, Process)
- Check auto-refresh works

**Note:** If page is placeholder, document it

---

## Full Test Execution (2-3 hours)

Follow the comprehensive test plan in:
- `ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md` (Steps 1-12)

---

## API Testing Shortcuts

```bash
# Test clock-in endpoint
curl -X POST http://localhost:5055/api/wfm/sessions/clock-in \
  -H "Authorization: Bearer mock-token-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "location": {"latitude": 12.9716, "longitude": 77.5946},
    "workMode": "office"
  }'

# Get attendance for Nixon Sethi
curl "http://localhost:5055/api/attendance-engine/daily?employeeId=<nixon-id>&fromDate=2026-06-01&toDate=2026-06-08&limit=50" \
  -H "Authorization: Bearer mock-token-admin"

# List pending regularizations
curl "http://localhost:5055/api/wfm/regularizations?status=pending_manager" \
  -H "Authorization: Bearer mock-token-admin"

# Get live tracker data
curl "http://localhost:5055/api/wfm/live?date=2026-06-08" \
  -H "Authorization: Bearer mock-token-admin"
```

---

## Database Quick Checks

```bash
# Connect to MySQL (update password)
mysql -h 122.184.128.90 -u <user> -p<pass> mas_hrms

# Then run these queries:
```

```sql
-- 1. Today's attendance count
SELECT COUNT(*) FROM attendance_log WHERE punch_date = CURDATE();

-- 2. Nixon's recent attendance
SELECT * FROM attendance_log 
WHERE employee_id = (SELECT id FROM employee WHERE employee_code = 'MAS00176')
ORDER BY punch_date DESC LIMIT 5;

-- 3. Pending regularizations
SELECT COUNT(*) FROM employee_request 
WHERE request_type_code = 'ATTENDANCE_REGULARIZATION' 
  AND current_status IN ('submitted', 'pending_manager');

-- 4. Active shifts
SELECT COUNT(*) FROM wfm_shift WHERE active_status = 1;

-- 5. Current week roster assignments
SELECT COUNT(*) FROM roster_assignment WHERE roster_date >= CURDATE();
```

---

## Security Test Matrix (CRITICAL)

| Test | Employee | Manager | Admin | Expected Result |
|------|----------|---------|-------|-----------------|
| View own attendance | ✓ | ✓ | ✓ | PASS |
| View others' attendance | ✗ | ✓ (team only) | ✓ | Block employee |
| Clock in for self | ✓ | ✓ | ✓ | PASS |
| Clock in for others | ✗ | ✗ | ✗ | Block all |
| Submit regularization | ✓ | ✓ | ✓ | PASS |
| Approve own regularization | ✗ | ✗ | ✗ | Block all |
| Approve team regularization | ✗ | ✓ | ✓ | Block employee |
| Access WFM roster page | ✗ | ✓ | ✓ | Gate protection |
| Modify published roster | ✗ | ✗ | ✗ | Block all |

**How to Test:**
1. Login as employee
2. Try each restricted action via UI or API
3. Verify 403 Forbidden or access denied message
4. Document any security bypass found

---

## Common Issues Checklist

### UI Issues
- [ ] Page load > 3 seconds?
- [ ] Buttons not clickable?
- [ ] Forms not validating?
- [ ] Date/time pickers broken?
- [ ] Tables not sorting?
- [ ] Export buttons not working?
- [ ] Mobile layout broken?
- [ ] Error messages unclear?

### Data Issues
- [ ] Times in wrong timezone?
- [ ] Hours calculation wrong?
- [ ] Late flags incorrect?
- [ ] Break hours not deducted?
- [ ] Week-offs showing as absent?
- [ ] Leave not overlaid on roster?
- [ ] Holiday attendance marked present?

### Security Issues
- [ ] Can view others' data?
- [ ] Can mark attendance for others?
- [ ] Can approve own requests?
- [ ] Non-manager accessing team data?
- [ ] Non-admin accessing WFM pages?
- [ ] Can modify locked/published data?
- [ ] Missing audit trail?
- [ ] Tokens not expiring?

### Functional Issues
- [ ] Clock in fails?
- [ ] Clock out not updating?
- [ ] Break timer not working?
- [ ] Regularization timeout?
- [ ] Approval not updating status?
- [ ] Roster validation missing?
- [ ] Live dashboard not refreshing?
- [ ] Reports empty?
- [ ] Export files corrupt?

---

## Reporting Findings

### Issue Template

```markdown
## Issue: [Brief title]

**Severity:** Critical / High / Medium / Low

**Category:** Security / UI / Data / Functional

**Steps to Reproduce:**
1. Login as [role]
2. Navigate to [page]
3. Click [button]
4. Observe [behavior]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:**
[Attach screenshots]

**Database State:**
[Relevant DB query results]

**API Response:**
[If applicable]

**Browser Console Errors:**
[If any]

**Impact:**
[Who is affected and how]

**Suggested Fix:**
[If obvious]
```

---

## Test Result Summary Template

```json
{
  "test_date": "2026-06-08",
  "tester": "Your Name",
  "duration_minutes": 120,
  "tests_executed": 12,
  "tests_passed": 10,
  "tests_failed": 2,
  "critical_issues": 0,
  "high_issues": 1,
  "medium_issues": 3,
  "low_issues": 2,
  "security_gaps": 0,
  "overall_status": "PASS_WITH_ISSUES",
  "blocking_issues": [],
  "recommended_actions": [
    "Fix timezone display in attendance table",
    "Add validation to regularization form",
    "Improve error messages on clock-in failure"
  ]
}
```

---

## Next Steps After Testing

1. **Compile Results:**
   - Fill in test results JSON
   - Organize screenshots
   - Write summary report

2. **Prioritize Issues:**
   - Critical (blocks functionality) - Fix immediately
   - High (affects accuracy/security) - Fix within 1 day
   - Medium (UX/minor bugs) - Fix within 1 week
   - Low (cosmetic) - Backlog

3. **Create Fix Tickets:**
   - One ticket per issue
   - Include all reproduction details
   - Assign severity and owner

4. **Retest After Fixes:**
   - Verify each fix works
   - Check no regressions introduced
   - Update test results

---

## Help & References

**Full Test Plan:** `ATTENDANCE_WFM_FRONTEND_TEST_REPORT.md`  
**API Test Script:** `test-attendance-wfm-api.sh`  
**Real User List:** `/tmp/real_hrms_test_users.json`

**Key Files:**
- Frontend: `/src/pages/Attendance.tsx`, `/src/pages/AttendanceRegularization.tsx`
- Backend: `/backend/src/modules/wfm/wfm.routes.ts`
- Database: `mas_hrms` on `122.184.128.90`

**Common Commands:**
```bash
# Restart backend
cd backend && npm run dev

# Restart frontend
cd .. && npm run dev

# View backend logs
tail -f backend/logs/app.log

# Check database connection
mysql -h 122.184.128.90 -u <user> -p mas_hrms -e "SELECT 1"
```

---

**Happy Testing!** Document everything, be thorough, and focus on security first.
