import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";

export interface LeaveBalance {
  id: string;
  leave_type: { name: string; is_paid: boolean | null };
  total_days: number;
  used_days: number;
  year: number;
}

export function useLeaveBalances(employeeId: string | undefined) {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ["leave-balances", employeeId, currentYear],
    queryFn: async () => {
      if (!employeeId) return [];

      // Try current year first
      let res = await hrmsApi.get<{ success: boolean; data: any[] }>(
        `/api/leave/balance/${employeeId}?year=${currentYear}`
      );
      let rows = res.data ?? [];

      // Fallback to previous year if no balances found for current year
      if (rows.length === 0) {
        res = await hrmsApi.get<{ success: boolean; data: any[] }>(
          `/api/leave/balance/${employeeId}?year=${currentYear - 1}`
        );
        rows = res.data ?? [];
      }

      // Backend returns LeaveBalanceLedger rows:
      // { id, employee_id, leave_type_id, balance_year, allocated_days, used_days, adjusted_days, leave_name?, paid_leave?, ... }
      return rows.map((row: any): LeaveBalance => ({
        id: row.id ?? row.leave_type_id,
        leave_type: {
          name: row.leave_name ?? row.leave_code ?? row.leave_type_id ?? "Unknown",
          is_paid: row.paid_leave != null ? Boolean(row.paid_leave) : null,
        },
        total_days: Number(row.allocated_days ?? row.total_days ?? 0),
        used_days: Number(row.used_days ?? 0),
        year: Number(row.balance_year ?? currentYear),
      }));
    },
    enabled: !!employeeId,
  });
}
