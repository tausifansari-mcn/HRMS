import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";

interface BranchOption { id: string; branch_name: string; }
interface ProcessOption { id: string; process_name: string; }

interface ReportMasters {
  branches: BranchOption[];
  processes: ProcessOption[];
}

export function useReportMasters() {
  return useQuery({
    queryKey: ["report-masters"],
    queryFn: async (): Promise<ReportMasters> => {
      const res = await hrmsApi.get<{ success: boolean; data: { branches: BranchOption[]; processes: ProcessOption[] } }>(
        "/api/employees/directory-masters"
      );
      return res.data ?? { branches: [], processes: [] };
    },
    staleTime: 5 * 60 * 1000,
  });
}
