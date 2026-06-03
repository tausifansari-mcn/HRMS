import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { format } from "date-fns";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string;
  department: string;
  designation: string;
  joinDate: string;
  status: "active" | "inactive" | "onboarding" | "offboarded";
}

export interface EmployeeWithDetails {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  designation: string;
  hire_date: string;
  status: string;
  avatar_url: string | null;
  department: { name: string } | null;
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      // Local demo mode bypass
      if (localStorage.getItem("hrms_demo_session")) {
        return [
          {
            id: "demo-employee-id",
            employeeCode: "EMP-DEMO-001",
            name: "Demo Admin",
            email: "demo@mascallnet.com",
            phone: "+91 98765 43210",
            department: "HR & Operations",
            designation: "General Manager",
            joinDate: "Jan 10, 2024",
            status: "active",
          },
          {
            id: "emp-2",
            employeeCode: "EMP-MCN-002",
            name: "Ananya Sharma",
            email: "ananya.sharma@mascallnet.com",
            phone: "+91 99999 88888",
            department: "Operations",
            designation: "Operations Manager",
            joinDate: "Feb 15, 2024",
            status: "active",
          },
          {
            id: "emp-3",
            employeeCode: "EMP-MCN-003",
            name: "Rajesh Kumar",
            email: "rajesh.kumar@mascallnet.com",
            phone: "+91 88888 77777",
            department: "Technical Support",
            designation: "Tech Lead",
            joinDate: "Mar 01, 2024",
            status: "active",
          },
          {
            id: "emp-4",
            employeeCode: "EMP-MCN-004",
            name: "Siddharth Verma",
            email: "siddharth.verma@mascallnet.com",
            phone: "+91 77777 66666",
            department: "Human Resources",
            designation: "HR Specialist",
            joinDate: "Apr 20, 2024",
            status: "active",
          }
        ];
      }

      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/employees");
      return (res.data || []).map((emp: any): Employee => ({
        id: emp.id,
        employeeCode: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name ?? ""}`.trim(),
        email: emp.email,
        phone: emp.mobile ?? null,
        department: emp.department_name || "Unassigned",
        designation: emp.designation_name || emp.designation || "",
        joinDate: emp.date_of_joining ? format(new Date(emp.date_of_joining), "MMM d, yyyy") : "",
        status: emp.employment_status as Employee["status"],
      }));
    },
  });
}

export function useEmployeeStats() {
  return useQuery({
    queryKey: ["employee-stats"],
    queryFn: async () => {
      // Local demo mode bypass
      if (localStorage.getItem("hrms_demo_session")) {
        return { total: 4, active: 4, onboarding: 0 };
      }

      const res = await hrmsApi.get<{ data: any }>("/api/employees/stats");
      const stats = res.data ?? {};
      return {
        total: stats.total_employees ?? 0,
        active: stats.active_employees ?? 0,
        onboarding: stats.onboarding_employees ?? 0,
      };
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      // Local demo mode bypass
      if (localStorage.getItem("hrms_demo_session")) {
        return [
          { id: "dept-1", name: "HR & Operations", description: "Core HR and facilities operations" },
          { id: "dept-2", name: "Operations", description: "Operational execution and workforce" },
          { id: "dept-3", name: "Technical Support", description: "Product tech support and systems" },
          { id: "dept-4", name: "Human Resources", description: "Talent acquisition and engagement" }
        ];
      }

      const res = await hrmsApi.get<{ data: any[] }>("/api/org/departments");
      return (res.data ?? []).map((d: any) => ({
        id: d.id,
        name: d.dept_name,
        code: d.dept_code,
        description: d.description ?? "",
      }));
    },
  });
}

export function useBulkDeleteEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeIds: string[]) => {
      // Deactivate in parallel via backend API
      const errors: string[] = [];

      await Promise.all(
        employeeIds.map(async (id) => {
          try {
            await hrmsApi.delete(`/api/employees/${id}`);
          } catch (err: any) {
            errors.push(`Failed to delete employee ${id}: ${err.message}`);
          }
        })
      );

      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }

      return { deletedCount: employeeIds.length };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-stats"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });
}

export function useBulkUpdateEmployeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeIds, status }: { employeeIds: string[]; status: "active" | "inactive" }) => {
      await Promise.all(
        employeeIds.map((id) => hrmsApi.patch(`/api/employees/${id}`, { employment_status: status }))
      );
      return { updatedCount: employeeIds.length, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee-stats"] });
    },
  });
}
