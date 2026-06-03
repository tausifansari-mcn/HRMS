import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
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
      const [typesRes, empsRes] = await Promise.all([
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/leave/types"),
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/employees?limit=500"),
      ]);
      const leaveTypeNames = (typesRes.data ?? []).map((t: any) => t.type_name ?? t.name);
      const records: LeaveBalanceRecord[] = (empsRes.data ?? []).map((e: any): LeaveBalanceRecord => ({
        employeeId: e.id,
        employeeCode: e.employee_code,
        employeeName: `${e.first_name} ${e.last_name ?? ""}`.trim(),
        department: e.department_name ?? "Unassigned",
        balances: leaveTypeNames.map((name: string) => ({ leaveType: name, total: 0, used: 0, remaining: 0 })),
      }));
      return { year, leaveTypes: leaveTypeNames, records };
    },
  });
}
