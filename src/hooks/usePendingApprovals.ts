import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePendingApprovals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-approvals", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0, requests: [] };

      // Get current user's employee record
      const { data: myEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myEmployee) return { count: 0, requests: [] };

      // Get direct reports
      const { data: directReports } = await supabase
        .from("employees")
        .select("id")
        .eq("manager_id", myEmployee.id);

      if (!directReports || directReports.length === 0) {
        return { count: 0, requests: [] };
      }

      const reportIds = directReports.map((r) => r.id);

      // Get pending leave requests from direct reports
      const { data: pendingRequests, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          start_date,
          end_date,
          days_count,
          employee_id,
          employees!leave_requests_employee_id_fkey (
            first_name,
            last_name
          ),
          leave_types!leave_requests_leave_type_id_fkey (
            name
          )
        `)
        .eq("status", "pending")
        .in("employee_id", reportIds)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return {
        count: pendingRequests?.length || 0,
        requests: pendingRequests || [],
      };
    },
    enabled: !!user?.id,
  });
}
