import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdminOrHR } from "@/hooks/useUserRole";

async function getEligibleLeaveTotals(empId: string, year: number) {
  try {
    const res = await hrmsApi.get<{ data: any[] }>(`/api/leave/balance/${empId}?year=${year}`);
    const rows = res.data ?? [];
      return {
        totalLeaves: rows.reduce((s, r) => s + (Number(r.allocated_days) ?? Number(r.max_days_per_year) ?? 0), 0),
        usedLeaves: rows.reduce((s, r) => s + (Number(r.used_days) ?? 0), 0),
        availableLeaves: rows.reduce(
          (s, r) => s + ((Number(r.allocated_days) ?? 0) - (Number(r.used_days) ?? 0) + (Number(r.adjusted_days) ?? 0)),
          0
        ),
      };
  } catch {
    return { totalLeaves: null, usedLeaves: null, availableLeaves: null };
  }
}

export function useDashboardStats() {
  const { user } = useAuth();
  const { isAdminOrHR, isLoading: roleLoading } = useIsAdminOrHR();

  // Realtime Supabase channel removed — polling via refetchInterval handles freshness.

  return useQuery({
    queryKey: ["dashboard-stats", user?.id, isAdminOrHR],
    refetchInterval: 30000,
    queryFn: async () => {
      // Local demo mode bypass
      if (user?.id === "demo-user-id") {
        return {
          totalEmployees: 142,
          onLeaveToday: 0,
          assetsAssigned: 3,
          pendingPayroll: 2,
          pendingApprovals: 5,
          isEmployee: true,
          totalLeaves: 30,
          usedLeaves: 8,
          availableLeaves: 22,
        };
      }

      // Resolve the logged-in user's employee record
      let myEmployee: { id: string } | null = null;
      try {
        const meRes = await hrmsApi.get<{ data: any }>("/api/employees/me");
        if (meRes.data?.id) myEmployee = { id: meRes.data.id };
      } catch {
        // Not an employee or not authenticated
      }

      if (!myEmployee) {
        return {
          totalEmployees: null,
          onLeaveToday: 0,
          assetsAssigned: 0,
          pendingPayroll: null,
          pendingApprovals: 0,
          isEmployee: false,
        };
      }

      // Is user on leave today?
      const today = new Date().toISOString().split("T")[0];
      let amOnLeave = false;
      try {
        const leavesRes = await hrmsApi.get<{ data: any[] }>(
          `/api/leave/requests?employeeId=${myEmployee.id}&status=approved&activeOn=${today}`
        );
        amOnLeave = (leavesRes.data ?? []).length > 0;
      } catch { /* non-fatal */ }

      // Leave balance totals
      const currentYear = new Date().getFullYear();
      const { totalLeaves, usedLeaves, availableLeaves } = await getEligibleLeaveTotals(
        myEmployee.id,
        currentYear
      );

      // Assigned assets count
      let myAssetsCount = 0;
      try {
        const assetsRes = await hrmsApi.get<{ data: any[] }>(
          `/api/assets-mgmt/employee/${myEmployee.id}`
        );
        myAssetsCount = (assetsRes.data ?? []).length;
      } catch { /* non-fatal */ }

      // Pending leave approvals (manager's direct reports)
      let pendingApprovals = 0;
      try {
        const pendingRes = await hrmsApi.get<{ data: any[] }>("/api/leave/requests?status=pending");
        pendingApprovals = (pendingRes.data ?? []).length;
      } catch { /* non-fatal */ }

      // Admin/HR: also fetch total employee count
      let totalEmployees: number | null = null;
      if (isAdminOrHR) {
        try {
          const statsRes = await hrmsApi.get<{ data: any }>("/api/employees/stats");
          totalEmployees = statsRes.data?.total_employees ?? null;
        } catch { /* non-fatal */ }
      }

      return {
        totalEmployees,
        onLeaveToday: amOnLeave ? 1 : 0,
        assetsAssigned: myAssetsCount,
        pendingPayroll: null,
        pendingApprovals,
        isEmployee: true,
        totalLeaves,
        usedLeaves,
        availableLeaves,
      };
    },
    enabled: !!user?.id && !roleLoading,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      // Return high-fidelity local activity logs for seamless demo rendering
      if (localStorage.getItem("hrms_demo_session")) {
        return [
          {
            id: "act-1",
            action: "onboarded",
            entity_type: "employee",
            details: { name: "Ananya Sharma", department: "Operations" },
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
          {
            id: "act-2",
            action: "approved",
            entity_type: "leave",
            details: { name: "Rajesh Kumar", type: "Sick Leave" },
            created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          },
          {
            id: "act-3",
            action: "allocated",
            entity_type: "asset",
            details: { name: "MacBook Pro M3", employee: "Ananya Sharma" },
            created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
          },
          {
            id: "act-4",
            action: "generated",
            entity_type: "payroll",
            details: { period: "May 2026", status: "Draft" },
            created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
          }
        ];
      }

      try {
        const res = await hrmsApi.get<{ data: any[] }>("/api/access/audit-log?limit=10");
        return res.data ?? [];
      } catch {
        return [];
      }
    },
  });
}
