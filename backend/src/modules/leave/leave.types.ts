export interface LeaveType {
  id: string;
  leave_code: string;
  leave_name: string;
  max_days_per_year: number;
  carry_forward: number;
  requires_approval: number;
  paid_leave: number;
  active_status: number;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  applied_at: string;
  created_at: string;
}

export interface LeaveBalanceLedger {
  id: string;
  employee_id: string;
  leave_type_id: string;
  balance_year: number;
  allocated_days: number;
  used_days: number;
  adjusted_days: number;
  updated_at: string;
}

export interface LeaveHoliday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  holiday_type: string;
  branch_id: string | null;
  active_status: number;
  created_at: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
