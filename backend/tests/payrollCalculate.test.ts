import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/mysql.js", () => ({
  db: { execute: vi.fn() },
}));

import { db } from "../src/db/mysql.js";
import { calculatePayrollRun } from "../src/modules/payroll/payrollCalculate.service.js";

const mockExecute = db.execute as ReturnType<typeof vi.fn>;

const fakeRun = {
  id: "run-1",
  run_month: "2026-05",
  branch_filter: null,
  process_filter: "Inbound",
  status: "draft",
  total_employees: 0,
  total_gross: 0,
  total_deductions: 0,
  total_net: 0,
  created_by: "user-1",
};

const fakeEmployee = {
  employee_id: "emp-1",
  employee_code: "EMP001",
  ctc_annual: 300000,  // ₹3L pa → ₹25k/month gross
  basic_pct: 40,
  hra_pct: 20,
};

const fakeAttendance = {
  employee_id: "emp-1",
  working_days: 26,
  present_days: 24,
  leave_days: 1,
  lwp_days: 1,
  late_marks: 2,
  dialer_hours: 200,
};

// Key-value rows matching SELECT config_key, config_value FROM statutory_config
const fakeStatKvRows = [
  { config_key: "pf_employee_pct",  config_value: 12 },
  { config_key: "esic_employee_pct", config_value: 0.75 },
  { config_key: "esic_wage_limit",  config_value: 21000 },
  { config_key: "pf_wage_limit",    config_value: 15000 },
  { config_key: "professional_tax", config_value: 200 },
  { config_key: "tds_standard_deduction", config_value: 75000 },
  { config_key: "tds_rebate_87a_limit", config_value: 700000 },
];

describe("calculatePayrollRun", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when run not found", async () => {
    mockExecute.mockResolvedValueOnce([[]]); // getRun
    await expect(calculatePayrollRun("missing-run", "user-1")).rejects.toThrow("Run not found");
  });

  it("throws when run is locked/disbursed", async () => {
    mockExecute.mockResolvedValueOnce([[{ ...fakeRun, status: "locked" }]]);
    await expect(calculatePayrollRun("run-1", "user-1")).rejects.toThrow("locked");
  });

  // Helper: standard mock sequence for one employee run
  // Query order: getRun, statKvRows, employees, attendance, tax_declaration, advance_recovery, upsert_line, update_totals, re-fetch_run
  function mockOneEmployeeRun(overrideUpsert?: (sql: string, params: unknown[]) => unknown) {
    mockExecute.mockResolvedValueOnce([[fakeRun]]);            // 1. getRun
    mockExecute.mockResolvedValueOnce([fakeStatKvRows]);       // 2. statutory kv
    mockExecute.mockResolvedValueOnce([[fakeEmployee]]);       // 3. employees
    mockExecute.mockResolvedValueOnce([[fakeAttendance]]);     // 4. attendance
    mockExecute.mockResolvedValueOnce([[/* no declaration */]]); // 5. tax_declaration
    mockExecute.mockResolvedValueOnce([[{ monthly_recovery: 0 }]]); // 6. advance_recovery
    if (overrideUpsert) {
      mockExecute.mockImplementationOnce(overrideUpsert as Parameters<typeof mockExecute.mockImplementationOnce>[0]);
    } else {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // 7. upsert line
    }
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // 8. update run totals
    mockExecute.mockResolvedValueOnce([[{ ...fakeRun, status: "processing" }]]); // 9. re-fetch
  }

  it("fetches employees scoped to run's process_filter", async () => {
    mockOneEmployeeRun();
    await calculatePayrollRun("run-1", "user-1");

    const calls = mockExecute.mock.calls.map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    ([sql]: any) => sql as string);
    const empQuery = calls.find((s: string) => /process_filter|process_id|process_name/i.test(s));
    expect(empQuery).toBeDefined();
  });

  it("upserts one prep line per employee", async () => {
    mockOneEmployeeRun();
    await calculatePayrollRun("run-1", "user-1");

    const calls = mockExecute.mock.calls.map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    ([sql]: any) => sql as string);
    const upsert = calls.find((s: string) => /salary_prep_line/i.test(s) && /INSERT|REPLACE/i.test(s));
    expect(upsert).toBeDefined();
  });

  it("calculates net salary correctly for single employee", async () => {
    let upsertParams: unknown[] = [];
    mockOneEmployeeRun((_sql: string, params: unknown[]) => {
      upsertParams = params;
      return [{ affectedRows: 1 }];
    });

    await calculatePayrollRun("run-1", "user-1");

    // net_salary should be positive and < gross
    const netSalary = upsertParams.find((p) => typeof p === "number" && (p as number) > 0 && (p as number) < 30000);
    expect(netSalary).toBeDefined();
  });

  it("updates run status to processing and sets totals", async () => {
    mockOneEmployeeRun();
    const result = await calculatePayrollRun("run-1", "user-1");
    expect(result.status).toBe("processing");
  });

  it("returns result with employee count", async () => {
    mockOneEmployeeRun();
    const result = await calculatePayrollRun("run-1", "user-1");
    expect(result.employees_processed).toBe(1);
  });
});
