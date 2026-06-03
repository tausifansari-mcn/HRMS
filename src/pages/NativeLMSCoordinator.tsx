import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Users, BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";
import { useUserRole } from "@/hooks/useUserRole";

export default function NativeLMSCoordinator() {
  const { data: roleData } = useUserRole();
  const employeeId = roleData?.employeeId ?? null;

  const { data: launchUrls } = useQuery({
    queryKey: ["lms-launch-urls", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const res = await hrmsApi.get<{ success: boolean; data: any }>(`/api/lms/launch-urls/${employeeId}`);
      return res.data ?? null;
    },
    enabled: !!employeeId,
  });

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["lms-mappings"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/lms/mapping");
      return res.data ?? [];
    },
  });

  const { data: syncLog = [], isLoading: loadingSync } = useQuery({
    queryKey: ["lms-sync-log"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/lms/sync-log");
      return res.data ?? [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">LMS Coordinator</h1>
          <p className="mt-1 text-slate-600">
            Training coordination and learner management via the deployed LMS system.
          </p>
        </div>

        {/* LMS Deep Links */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950 mb-4">Launch LMS</h2>
          <div className="flex flex-wrap gap-3">
            {launchUrls?.coordinator_url && (
              <a
                href={launchUrls.coordinator_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800"
              >
                <BookOpen className="h-4 w-4" />
                Open LMS Coordinator
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {launchUrls?.admin_url && (
              <a
                href={launchUrls.admin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <BookOpen className="h-4 w-4" />
                Open LMS Admin
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {!launchUrls && (
              <p className="text-sm text-slate-500">
                LMS launch URLs require your employee profile to be mapped to an LMS learner account.
              </p>
            )}
          </div>
        </div>

        {/* Learner Mappings */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-950 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Learner Mappings
            </h2>
            <span className="text-sm text-slate-500">{mappings.length} mapped</span>
          </div>
          {loadingMappings ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-slate-500">No learner mappings found. Add mappings via the LMS Integration page.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {mappings.map((m: any) => (
                <div key={m.id ?? m.employee_id} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="font-medium text-sm">{m.employee_id}</div>
                    <div className="text-xs text-slate-500">LMS ID: {m.lms_learner_id}</div>
                  </div>
                  {m.sync_status && (
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {m.sync_status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync Log */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-4 w-4 text-slate-600" />
            <h2 className="font-semibold text-slate-950">Sync Log</h2>
          </div>
          {loadingSync ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : syncLog.length === 0 ? (
            <p className="text-sm text-slate-500">No sync events recorded.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {syncLog.slice(0, 20).map((entry: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{entry.event_type ?? entry.sync_type ?? "sync"}</span>
                    {entry.message && <span className="ml-2 text-slate-500">{entry.message}</span>}
                  </div>
                  {entry.created_at && (
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
