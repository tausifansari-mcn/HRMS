import { useQuery } from "@tanstack/react-query";
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
      console.warn("[MIGRATION] No MySQL endpoint for payroll_records by month — returning empty");
      return {
        month, year,
        monthName: `${MONTH_NAMES[month - 1]} ${year}`,
        totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalNetSalary: 0,
        employeeCount: 0, records: [],
      };
    },
  });
}
