import { useState, useEffect, useCallback } from "react";
import { Database, CheckCircle2, RefreshCcw, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

interface ModuleStatus {
  module: string;
  mysql_count: number;
  status: "empty" | "has_data";
}

interface MigrationStatusResponse {
  success: boolean;
  data: ModuleStatus[];
}

const MODULE_LABELS: Record<string, string> = {
  employees: "Employees",
  attendance: "Attendance",
  wfm: "Workforce Management",
  leave: "Leave",
  ats: "ATS / Recruitment",
  payroll: "Payroll",
};

export default function NativeMigrationConsole() {
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hrmsApi.get<MigrationStatusResponse>("/api/migration/status");
      setModules(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load migration status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const modulesWithData = modules.filter((m) => m.status === "has_data").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5">
              <Database className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Migration Console</h1>
              <p className="text-sm text-gray-500">MySQL data status per module</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary card */}
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            {error ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            <span className="text-sm font-medium text-gray-700">
              {error
                ? "Error loading status"
                : loading
                ? "Loading module status..."
                : `${modulesWithData} of ${modules.length} modules have data`}
            </span>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Module table */}
        {!error && (
          <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Module
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    MySQL Rows
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-4">
                          <div className="h-4 w-36 rounded bg-gray-200" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="ml-auto h-4 w-16 rounded bg-gray-200" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="mx-auto h-6 w-24 rounded-full bg-gray-200" />
                        </td>
                      </tr>
                    ))
                  : modules.map((m) => (
                      <tr key={m.module} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-800">
                          {MODULE_LABELS[m.module] ?? m.module}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums text-gray-600">
                          {m.mysql_count.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {m.status === "has_data" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Has Data
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                              <span className="h-3.5 w-3.5 rounded-sm border border-gray-300 bg-white inline-block" />
                              Empty
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
