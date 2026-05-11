import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from "date-fns";
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
      // Fetch attendance records with employee data
      const { data: records, error } = await supabase
        .from("attendance_records")
        .select(`
          *,
          employee:employees(
            first_name, 
            last_name, 
            employee_code, 
            working_hours_start, 
            working_hours_end,
            department:departments!employees_department_id_fkey(name)
          )
        `)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (error) throw error;

      // Group by employee and calculate metrics
      const employeeMap = new Map<string, AttendanceReportRecord>();

      records?.forEach((record) => {
        const emp = record.employee as {
          first_name: string;
          last_name: string;
          employee_code: string;
          working_hours_start: string | null;
          working_hours_end: string | null;
          department: { name: string } | null;
        } | null;
        
        if (!emp) return;

        const key = record.employee_id;
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            employeeId: record.employee_id,
            employeeName: `${emp.first_name} ${emp.last_name}`,
            employeeCode: emp.employee_code,
            department: emp.department?.name || "-",
            totalDays: 0,
            totalHours: 0,
            lateArrivals: 0,
            totalLateMinutes: 0,
            totalOvertimeHours: 0,
            workingHoursStart: emp.working_hours_start,
            workingHoursEnd: emp.working_hours_end,
          });
        }

        const empData = employeeMap.get(key)!;
        empData.totalDays++;
        empData.totalHours += record.total_hours || 0;

        // Calculate late arrival
        if (record.clock_in && emp.working_hours_start) {
          const clockInTime = new Date(record.clock_in);
          const [startHour, startMinute] = emp.working_hours_start.split(":").map(Number);
          const scheduledStart = new Date(clockInTime);
          scheduledStart.setHours(startHour, startMinute, 0, 0);

          if (clockInTime > scheduledStart) {
            const lateMinutes = differenceInMinutes(clockInTime, scheduledStart);
            // 1-minute grace period to account for seconds precision
            if (lateMinutes > 1) {
              empData.lateArrivals++;
              empData.totalLateMinutes += lateMinutes;
            }
          }
        }

        // Calculate overtime (handles cross-midnight shifts)
        if (record.total_hours && emp.working_hours_start && emp.working_hours_end) {
          const expectedHours = getExpectedHours(emp.working_hours_start, emp.working_hours_end);
          
          if (record.total_hours > expectedHours) {
            empData.totalOvertimeHours += record.total_hours - expectedHours;
          }
        }
      });

      const reportRecords = Array.from(employeeMap.values()).sort((a, b) => 
        b.lateArrivals - a.lateArrivals || b.totalOvertimeHours - a.totalOvertimeHours
      );

      const totalLateArrivals = reportRecords.reduce((sum, r) => sum + r.lateArrivals, 0);
      const totalLateMinutes = reportRecords.reduce((sum, r) => sum + r.totalLateMinutes, 0);
      const totalOvertimeHours = reportRecords.reduce((sum, r) => sum + r.totalOvertimeHours, 0);

      const monthName = format(startDate, "MMMM yyyy");

      return {
        monthName,
        records: reportRecords,
        totalEmployees: reportRecords.length,
        totalLateArrivals,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        avgLateMinutes: totalLateArrivals > 0 ? Math.round(totalLateMinutes / totalLateArrivals) : 0,
      };
    },
  });
}
