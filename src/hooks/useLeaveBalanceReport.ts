import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaveBalanceRecord {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  balances: {
    leaveType: string;
    total: number;
    used: number;
    remaining: number;
  }[];
}

export interface LeaveBalanceReport {
  year: number;
  leaveTypes: string[];
  records: LeaveBalanceRecord[];
}

export function useLeaveBalanceReport(year: number) {
  return useQuery({
    queryKey: ["leave-balance-report", year],
    queryFn: async (): Promise<LeaveBalanceReport> => {
      // Get all leave types with their annual allocation
      const { data: leaveTypes, error: typesError } = await supabase
        .from("leave_types")
        .select("id, name, days_per_year")
        .order("name");

      if (typesError) throw typesError;

      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select(`
          id,
          employee_code,
          first_name,
          last_name,
          department:departments!employees_department_id_fkey(name)
        `)
        .in("status", ["active", "onboarding"])
        .order("first_name");

      if (empError) throw empError;

      // Get approved leave requests for the year to calculate used days
      const { data: leaveRequests, error: lrError } = await supabase
        .from("leave_requests")
        .select("employee_id, leave_type_id, days_count")
        .eq("status", "approved")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`);

      if (lrError) throw lrError;

      // Build records with dynamic calculation
      const records: LeaveBalanceRecord[] = (employees || []).map((emp) => {
        const employeeBalances = (leaveTypes || []).map((lt) => {
          const used = (leaveRequests || [])
            .filter((lr) => lr.employee_id === emp.id && lr.leave_type_id === lt.id)
            .reduce((sum, lr) => sum + lr.days_count, 0);

          return {
            leaveType: lt.name,
            total: lt.days_per_year,
            used,
            remaining: lt.days_per_year - used,
          };
        });

        return {
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          department: emp.department?.name || "Unassigned",
          balances: employeeBalances,
        };
      });

      return {
        year,
        leaveTypes: (leaveTypes || []).map((lt) => lt.name),
        records,
      };
    },
  });
}
