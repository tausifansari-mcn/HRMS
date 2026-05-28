import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

export function useEmployeeGrowthData(year: number) {
  return useQuery({
    queryKey: ["employee-growth", year],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/employees?limit=500");
      const employees = res.data ?? [];

      const months = [];
      for (let month = 0; month < 12; month++) {
        const monthDate = new Date(year, month, 1);
        const monthEnd = endOfMonth(monthDate);
        const count = employees.filter((emp) => {
          const hireDate = new Date(emp.date_of_joining ?? emp.hire_date ?? "2000-01-01");
          return hireDate <= monthEnd && emp.employment_status !== "offboarded";
        }).length;
        months.push({ month: format(monthDate, "MMM"), employees: count });
      }
      return months;
    },
  });
}

export function useDepartmentDistribution() {
  return useQuery({
    queryKey: ["department-distribution"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/employees?limit=500");
      const employees = res.data ?? [];

      const deptMap = new Map<string, number>();
      for (const emp of employees) {
        const dept = emp.department_name ?? emp.department_id ?? "Unassigned";
        deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
      }

      return Array.from(deptMap.entries())
        .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
        .filter((d) => d.value > 0);
    },
  });
}

export function useLeaveStatistics(year: number) {
  return useQuery({
    queryKey: ["leave-statistics", year],
    queryFn: async () => {
      const [typesRes, reqRes] = await Promise.all([
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/leave/types"),
        hrmsApi.get<{ success: boolean; data: any[] }>(
          `/api/leave/requests?fromDate=${year}-01-01&toDate=${year}-12-31&limit=500`
        ),
      ]);
      const leaveTypes = typesRes.data ?? [];
      const leaveRequests = reqRes.data ?? [];

      const monthlyData = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = endOfMonth(monthStart);
        const monthData: Record<string, number | string> = { month: format(monthStart, "MMM") };
        for (const lt of leaveTypes) {
          const key = (lt.type_name ?? lt.name ?? "leave").toLowerCase().split(" ")[0];
          const days = leaveRequests.filter((lr) => {
            const d = new Date(lr.from_date ?? lr.start_date ?? "");
            return (lr.leave_type_id === lt.id || lr.leave_type_name === lt.type_name) &&
              d >= monthStart && d <= monthEnd && lr.status === "approved";
          }).reduce((s: number, lr: any) => s + (lr.total_days ?? lr.days_count ?? 0), 0);
          monthData[key] = days;
        }
        monthlyData.push(monthData);
      }

      const leaveTypeKeys = leaveTypes.map((lt: any) =>
        (lt.type_name ?? lt.name ?? "leave").toLowerCase().split(" ")[0]
      );
      return { monthlyData, leaveTypeKeys };
    },
  });
}

export function usePayrollTrend(year: number) {
  return useQuery({
    queryKey: ["payroll-trend", year],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/payroll/runs");
      const runs = (res.data ?? []).filter((r: any) => {
        const [y] = (r.run_month ?? "").split("-");
        return Number(y) === year;
      });

      return runs.map((r: any) => ({
        month: format(new Date(`${r.run_month}-01`), "MMM"),
        amount: r.total_net ?? 0,
      })).filter((r: any) => r.amount > 0);
    },
  });
}

export function useHeadcountSummary(year: number) {
  return useQuery({
    queryKey: ["headcount-summary", year],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/employees?limit=500");
      const employees = res.data ?? [];
      const yearStart = startOfYear(new Date(year, 0, 1));
      const yearEnd = endOfYear(new Date(year, 0, 1));

      const newHires = employees.filter((e) => {
        const d = new Date(e.date_of_joining ?? e.hire_date ?? "2000-01-01");
        return d >= yearStart && d <= yearEnd;
      }).length;

      const terminations = employees.filter((e) => {
        if (e.employment_status !== "offboarded") return false;
        const d = new Date(e.updated_at ?? e.date_of_joining ?? "2000-01-01");
        return d >= yearStart && d <= yearEnd;
      }).length;

      const currentHeadcount = employees.filter(
        (e) => e.employment_status === "active" || e.employment_status === "onboarding"
      ).length;

      const startOfYearHeadcount = employees.filter((e) => {
        const hireDate = new Date(e.date_of_joining ?? e.hire_date ?? "2000-01-01");
        if (hireDate >= yearStart) return false;
        if (e.employment_status === "offboarded") {
          const upd = new Date(e.updated_at ?? "2000-01-01");
          return upd >= yearStart;
        }
        return true;
      }).length;

      const monthlyBreakdown = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = startOfMonth(new Date(year, month, 1));
        const monthEnd = endOfMonth(new Date(year, month, 1));
        const hires = employees.filter((e) => {
          const d = new Date(e.date_of_joining ?? e.hire_date ?? "2000-01-01");
          return d >= monthStart && d <= monthEnd;
        }).length;
        const terms = employees.filter((e) => {
          if (e.employment_status !== "offboarded") return false;
          const d = new Date(e.updated_at ?? "2000-01-01");
          return d >= monthStart && d <= monthEnd;
        }).length;
        monthlyBreakdown.push({ month: format(monthStart, "MMM"), hires, terminations: terms, net: hires - terms });
      }

      return { newHires, terminations, netChange: newHires - terminations, currentHeadcount, startOfYearHeadcount, monthlyBreakdown };
    },
  });
}
