#!/bin/bash

# HRMS Attendance & WFM API Testing Script
# Usage: ./test-attendance-wfm-api.sh

set -e

# Configuration
BASE_URL="http://localhost:5055"
TOKEN="mock-token-admin"
EMPLOYEE_ID="emp-admin-001"
DATE_TODAY=$(date +%Y-%m-%d)
DATE_YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

# Test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    print_info "Testing: $description"
    echo "   $method $endpoint"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        print_success "Status: $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        print_error "Status: $http_code"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi

    echo ""
}

# Start testing
clear
print_header "HRMS Attendance & WFM API Test Suite"
echo "Base URL: $BASE_URL"
echo "Token: $TOKEN (admin)"
echo "Date: $DATE_TODAY"
echo ""

# ============================================================================
# 1. ATTENDANCE TESTS
# ============================================================================
print_header "1. Attendance Tests"

# 1.1 Check backend health
test_endpoint "GET" "/api/health" "" "Backend Health Check"

# 1.2 List WFM shifts
test_endpoint "GET" "/api/wfm/shifts" "" "List WFM Shifts"

# 1.3 Get attendance policy
test_endpoint "GET" "/api/wfm/attendance-policy/$EMPLOYEE_ID" "" "Get Attendance Policy"

# 1.4 List attendance sessions
test_endpoint "GET" "/api/wfm/sessions?limit=10" "" "List Recent Attendance Sessions"

# 1.5 Clock In (self-service simulation)
clock_in_data='{
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "workMode": "office"
}'
test_endpoint "POST" "/api/wfm/sessions/clock-in" "$clock_in_data" "Clock In Test"

# 1.6 Get attendance daily records
test_endpoint "GET" "/api/attendance-engine/daily?employeeId=$EMPLOYEE_ID&fromDate=$DATE_YESTERDAY&toDate=$DATE_TODAY&limit=10" "" "Get Daily Attendance Records"

# ============================================================================
# 2. REGULARIZATION TESTS
# ============================================================================
print_header "2. Regularization Tests"

# 2.1 List regularization requests
test_endpoint "GET" "/api/wfm/regularizations?limit=10" "" "List Regularization Requests"

# 2.2 Submit regularization (employee)
regularization_data='{
  "attendanceDate": "'$DATE_YESTERDAY'",
  "currentStatus": "Absent",
  "requestedLoginTime": "09:30",
  "requestedLogoutTime": "18:30",
  "reason": "API Test - System did not capture attendance",
  "attendanceSource": "biometric"
}'
test_endpoint "POST" "/api/wfm/regularizations" "$regularization_data" "Submit Regularization Request"

# ============================================================================
# 3. ATTENDANCE ENGINE TESTS
# ============================================================================
print_header "3. Attendance Engine Tests"

# 3.1 List attendance rules
test_endpoint "GET" "/api/attendance-engine/rules" "" "List Attendance Rules"

# 3.2 Resolve attendance rule (simulation)
test_endpoint "GET" "/api/attendance-engine/rules/resolve?date=$DATE_TODAY" "" "Resolve Attendance Rule for Today"

# ============================================================================
# 4. ROSTER GOVERNANCE TESTS
# ============================================================================
print_header "4. Roster Governance Tests"

# 4.1 Get processes
print_info "Getting processes for roster context..."
processes_response=$(curl -s -X GET \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/processes")
echo "$processes_response" | jq '.' 2>/dev/null || echo "$processes_response"
echo ""

# Extract first process ID (if available)
PROCESS_ID=$(echo "$processes_response" | jq -r '.data[0].id // empty' 2>/dev/null)

if [ -z "$PROCESS_ID" ]; then
    print_error "No process found, skipping roster tests"
else
    print_success "Using Process ID: $PROCESS_ID"

    # 4.2 List shift templates
    test_endpoint "GET" "/api/roster-gov/shifts/templates?process_id=$PROCESS_ID&active_status=1" "" "List Shift Templates"

    # 4.3 List roster cycles
    test_endpoint "GET" "/api/roster-gov/cycles?process_id=$PROCESS_ID" "" "List Roster Cycles"
fi

# ============================================================================
# 5. LIVE TRACKER TEST
# ============================================================================
print_header "5. Live Tracker Tests"

# 5.1 Get live tracker data
test_endpoint "GET" "/api/wfm/live?date=$DATE_TODAY" "" "Get Live Attendance Tracker"

# ============================================================================
# 6. ROSTER PREFERENCE TESTS
# ============================================================================
print_header "6. Roster Preference Tests"

# 6.1 Get my roster preferences
test_endpoint "GET" "/api/wfm/roster-preferences/my" "" "Get My Roster Preferences"

# 6.2 Get pending roster preferences (manager/admin)
test_endpoint "GET" "/api/wfm/roster-preferences/pending" "" "Get Pending Roster Preferences"

# ============================================================================
# 7. DATABASE VALIDATION
# ============================================================================
print_header "7. Database Validation (MySQL Queries)"

print_info "Attempting direct MySQL queries..."
echo "Note: This requires MySQL client and proper credentials"
echo ""

# Check if mysql command is available
if command -v mysql &> /dev/null; then
    print_success "MySQL client found"

    # Note: Update credentials as needed
    # These are placeholder credentials - actual credentials needed from .env
    MYSQL_HOST="122.184.128.90"
    MYSQL_USER="<update-from-.env>"
    MYSQL_PASS="<update-from-.env>"
    MYSQL_DB="mas_hrms"

    print_info "Run these queries manually with correct credentials:"
    echo ""
    echo "-- Today's attendance count"
    echo "SELECT COUNT(*) as today_punches FROM attendance_log WHERE punch_date = CURDATE();"
    echo ""
    echo "-- Pending regularizations"
    echo "SELECT COUNT(*) FROM employee_request WHERE request_type_code = 'ATTENDANCE_REGULARIZATION' AND current_status IN ('submitted', 'pending_manager');"
    echo ""
    echo "-- Active shifts"
    echo "SELECT COUNT(*) FROM wfm_shift WHERE active_status = 1;"
    echo ""
    echo "-- Current week roster assignments"
    echo "SELECT COUNT(*) FROM roster_assignment WHERE roster_date >= CURDATE();"
else
    print_error "MySQL client not found - skip database queries"
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_header "Test Execution Complete"

echo "Next Steps:"
echo "1. Review the API responses above"
echo "2. Verify data accuracy"
echo "3. Test the frontend pages manually"
echo "4. Document any issues found"
echo ""
echo "Frontend URLs to test:"
echo "  - http://localhost:8080/attendance"
echo "  - http://localhost:8080/attendance-regularization"
echo "  - http://localhost:8080/wfm/roster"
echo "  - http://localhost:8080/my-roster"
echo "  - http://localhost:8080/wfm/live-tracker"
echo ""
print_success "All API tests executed!"
echo ""
