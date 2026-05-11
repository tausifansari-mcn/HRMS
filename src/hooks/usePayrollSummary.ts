import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export interface PayrollSummaryRecord {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: string;
}

export interface PayrollSummary {
  month: number;
  year: number;
  monthName: string;
  totalBasic: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNetSalary: number;
  employeeCount: number;
  records: PayrollSummaryRecord[];
}

export function usePayrollSummary(month: number, year: number) {
  return useQuery({
    queryKey: ["payroll-summary", month, year],
    queryFn: async (): Promise<PayrollSummary> => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select(`
          id,
          basic_salary,
          total_allowances,
          total_deductions,
          net_salary,
          status,
          employee:employees(
            employee_code,
            first_name,
            last_name,
            department:departments!employees_department_id_fkey(name)
          )
        `)
        .eq("month", month)
        .eq("year", year)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const records: PayrollSummaryRecord[] = (data || []).map((record) => ({
        id: record.id,
        employeeCode: record.employee?.employee_code || "",
        employeeName: `${record.employee?.first_name || ""} ${record.employee?.last_name || ""}`.trim(),
        department: record.employee?.department?.name || "Unassigned",
        basicSalary: Number(record.basic_salary),
        allowances: Number(record.total_allowances || 0),
        deductions: Number(record.total_deductions || 0),
        netSalary: Number(record.net_salary),
        status: record.status,
      }));

      const totalBasic = records.reduce((sum, r) => sum + r.basicSalary, 0);
      const totalAllowances = records.reduce((sum, r) => sum + r.allowances, 0);
      const totalDeductions = records.reduce((sum, r) => sum + r.deductions, 0);
      const totalNetSalary = records.reduce((sum, r) => sum + r.netSalary, 0);

      return {
        month,
        year,
        monthName: `${MONTH_NAMES[month - 1]} ${year}`,
        totalBasic,
        totalAllowances,
        totalDeductions,
        totalNetSalary,
        employeeCount: records.length,
        records,
      };
    },
  });
}
