import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { getExpectedHours } from "@/lib/shiftUtils";

interface AttendanceReportRecord {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  totalDays: number;
  totalHours: number;
  lateArrivals: number;
  totalLateMinutes: number;
  totalOvertimeHours: number;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
}

interface AttendanceReportSummary {
  monthName: string;
  records: AttendanceReportRecord[];
  totalEmployees: number;
  totalLateArrivals: number;
  totalOvertimeHours: number;
  avgLateMinutes: number;
}

export function useAttendanceReportData(month: number, year: number) {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(startDate);
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance-report-data", month, year],
    queryFn: async (): Promise<AttendanceReportSummary> => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>(
        `/api/wfm/attendance/daily?from=${start}&to=${end}`
      );
      const sessions = res.data ?? [];
      const empMap = new Map<string, AttendanceReportRecord>();
      for (const s of sessions) {
        if (!empMap.has(s.employee_id)) {
          empMap.set(s.employee_id, {
            employeeId: s.employee_id,
            employeeName: s.employee_name ?? s.employee_id,
            employeeCode: s.employee_code ?? "",
            department: s.department_name ?? "-",
            totalDays: 0, totalHours: 0, lateArrivals: 0,
            totalLateMinutes: 0, totalOvertimeHours: 0,
            workingHoursStart: null,
            workingHoursEnd: null,
          });
        }
        const r = empMap.get(s.employee_id)!;
        r.totalDays++;
        r.totalHours += (s.total_hours ?? 0);
      }
      const records = Array.from(empMap.values());
      return {
        monthName: format(startDate, "MMMM yyyy"),
        records,
        totalEmployees: records.length,
        totalLateArrivals: 0,
        totalOvertimeHours: 0,
        avgLateMinutes: 0,
      };
    },
  });
}
