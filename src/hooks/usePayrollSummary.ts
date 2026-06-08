import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
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
      const result = await hrmsApi.get<{ success: boolean; data: any[] }>(`/api/payroll/runs?month=${month}&year=${year}`);
      const runs = result.data ?? [];
      // Build summary from runs data
      const records: PayrollSummaryRecord[] = runs.map((r: any) => ({
        employeeId: r.employee_id ?? r.id,
        employeeName: r.employee_name ?? 'Unknown',
        basicSalary: r.basic_salary ?? 0,
        allowances: r.allowances ?? 0,
        deductions: r.deductions ?? 0,
        netSalary: r.net_salary ?? 0,
      }));
      return {
        month, year,
        monthName: `${MONTH_NAMES[month - 1]} ${year}`,
        totalBasic: records.reduce((s, r) => s + r.basicSalary, 0),
        totalAllowances: records.reduce((s, r) => s + r.allowances, 0),
        totalDeductions: records.reduce((s, r) => s + r.deductions, 0),
        totalNetSalary: records.reduce((s, r) => s + r.netSalary, 0),
        employeeCount: records.length,
        records,
      };
    },
  });
}
