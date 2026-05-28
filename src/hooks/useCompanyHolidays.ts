import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hrmsApi } from "@/lib/hrmsApi";
import { USE_HRMS_BACKEND } from "@/lib/dataSource";

export interface CompanyHoliday {
  id: string;
  title: string;
  event_date: string;
}

export function useCompanyHolidays() {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ["company-holidays", currentYear],
    queryFn: async () => {
      if (USE_HRMS_BACKEND.leave) {
        const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/leave/holidays");
        return (res.data || []).map((h: any): CompanyHoliday => ({
          id: h.id,
          title: h.holiday_name ?? h.title,
          event_date: h.holiday_date ?? h.event_date,
        }));
      }

      const { data, error } = await supabase
        .from("company_events")
        .select("id, title, event_date")
        .eq("is_holiday", true)
        .gte("event_date", `${currentYear}-01-01`)
        .lte("event_date", `${currentYear}-12-31`)
        .order("event_date");

      if (error) throw error;
      return (data || []) as CompanyHoliday[];
    },
  });
}
