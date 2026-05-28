import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hrmsApi } from "@/lib/hrmsApi";
import { USE_HRMS_BACKEND } from "@/lib/dataSource";
import { format } from "date-fns";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee: {
    name: string;
    avatar?: string;
    department: string;
  };
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt: string;
  reviewedBy?: {
    name: string;
  };
  reviewedAt?: string;
  reviewNotes?: string;
}

export function useLeaveRequests() {
  return useQuery({
    queryKey: ["leave-requests"],
    queryFn: async () => {
      // Local demo mode bypass
      if (localStorage.getItem("hrms_demo_session")) {
        return [
          {
            id: "leave-1",
            employeeId: "emp-2",
            employee: {
              name: "Ananya Sharma",
              department: "Operations",
            },
            type: "Sick Leave",
            startDate: "May 24, 2026",
            endDate: "May 26, 2026",
            days: 3,
            reason: "Doctor advised rest due to fever",
            status: "pending",
            submittedAt: "May 23, 2026 at 10:15 AM",
          },
          {
            id: "leave-2",
            employeeId: "emp-3",
            employee: {
              name: "Rajesh Kumar",
              department: "Technical Support",
            },
            type: "Casual Leave",
            startDate: "May 20, 2026",
            endDate: "May 21, 2026",
            days: 2,
            reason: "Family function out of town",
            status: "approved",
            submittedAt: "May 18, 2026 at 4:30 PM",
            reviewedBy: { name: "Demo Admin" },
            reviewedAt: "May 19, 2026 at 11:00 AM",
            reviewNotes: "Approved, backup resource arranged.",
          }
        ];
      }

      if (USE_HRMS_BACKEND.leave) {
        const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/leave/requests");
        return (res.data || []) as unknown as LeaveRequest[];
      }

      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          days_count,
          reason,
          status,
          employee_id,
          created_at,
          reviewed_by,
          reviewed_at,
          review_notes,
          leave_type:leave_types(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch employee details separately to avoid the multiple relationship issue
      const employeeIds = [...new Set((data || []).map((r) => r.employee_id))];
      const reviewerIds = [...new Set((data || []).filter(r => r.reviewed_by).map((r) => r.reviewed_by))];
      const allEmployeeIds = [...new Set([...employeeIds, ...reviewerIds])];
      
      const { data: employees } = await supabase
        .from("employees")
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          department:departments!employees_department_id_fkey(name)
        `)
        .in("id", allEmployeeIds);

      const employeeMap = new Map(
        (employees || []).map((e) => [e.id, e])
      );

      return (data || []).map((req): LeaveRequest => {
        const emp = employeeMap.get(req.employee_id);
        const reviewer = req.reviewed_by ? employeeMap.get(req.reviewed_by) : null;
        return {
          id: req.id,
          employeeId: req.employee_id,
          employee: {
            name: emp ? `${emp.first_name} ${emp.last_name}` : "Unknown",
            avatar: emp?.avatar_url || undefined,
            department: emp?.department?.name || "Unassigned",
          },
          type: req.leave_type?.name || "Unknown",
          startDate: format(new Date(req.start_date), "MMM d, yyyy"),
          endDate: format(new Date(req.end_date), "MMM d, yyyy"),
          days: req.days_count,
          reason: req.reason || "",
          status: req.status as LeaveRequest["status"],
          submittedAt: format(new Date(req.created_at), "MMM d, yyyy 'at' h:mm a"),
          reviewedBy: reviewer ? { name: `${reviewer.first_name} ${reviewer.last_name}` } : undefined,
          reviewedAt: req.reviewed_at ? format(new Date(req.reviewed_at), "MMM d, yyyy 'at' h:mm a") : undefined,
          reviewNotes: req.review_notes || undefined,
        };
      });
    },
  });
}

export function useLeaveStats() {
  return useQuery({
    queryKey: ["leave-stats"],
    queryFn: async () => {
      // Local demo mode bypass
      if (localStorage.getItem("hrms_demo_session")) {
        return { pending: 1, approved: 1, rejected: 0 };
      }

      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, status");

      if (error) throw error;

      const pending = data?.filter((r) => r.status === "pending").length || 0;
      const approved = data?.filter((r) => r.status === "approved").length || 0;
      const rejected = data?.filter((r) => r.status === "rejected").length || 0;

      return { pending, approved, rejected };
    },
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      // Local demo mode bypass
      if (localStorage.getItem("hrms_demo_session")) {
        return [
          { id: "type-1", name: "Sick Leave", days_per_year: 10, is_paid: true },
          { id: "type-2", name: "Casual Leave", days_per_year: 12, is_paid: true },
          { id: "type-3", name: "Maternity Leave", days_per_year: 90, is_paid: true }
        ];
      }

      const { data, error } = await supabase
        .from("leave_types")
        .select("id, name, days_per_year, is_paid")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdateLeaveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ 
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-stats"] });
    },
  });
}
