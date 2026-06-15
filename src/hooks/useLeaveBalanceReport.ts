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

export function useLeaveBalanceReport(year: number, branchId?: string, processId?: string) {
  return useQuery({
    queryKey: ["leave-balance-report", year, branchId, processId],
    queryFn: async (): Promise<LeaveBalanceReport> => {
      const params = [
        `year=${year}`,
        branchId  ? `branchId=${branchId}`   : "",
        processId ? `processId=${processId}` : "",
      ].filter(Boolean).join("&");
      const response = await hrmsApi.get<{ success: boolean; data: LeaveBalanceReport }>(
        `/api/reports/leave-balances?${params}`
      );
      return response.data;
    },
  });
}
