import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Users, RefreshCcw, CheckCircle, XCircle, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";
import { useState } from "react";

interface LMSMapping {
  id: string;
  employee_id: string;
  lms_learner_id: string;
  email: string;
  employee_code?: string;
  employee_name?: string;
  mapped_at?: string;
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  sync_started_at: string;
  sync_completed_at?: string;
  error_message?: string;
}

export default function LMSIntegrationAdmin() {
  const [newMapping, setNewMapping] = useState({ employee_id: "", lms_learner_id: "", email: "" });
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ["lms-mappings"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: LMSMapping[] }>(
        "/api/lms/mapping"
      );
      return res.data.data;
    },
  });

  const { data: syncLog = [], isLoading: syncLoading } = useQuery({
    queryKey: ["lms-sync-log"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: SyncLogEntry[] }>(
        "/api/lms/sync-log"
      );
      return res.data.data;
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: { employee_id: string; lms_learner_id: string; email: string }) => {
      const res = await hrmsApi.post("/api/lms/mapping", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-mappings"] });
      setNewMapping({ employee_id: "", lms_learner_id: "", email: "" });
    },
  });

  const handleCreateMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMapping.employee_id && newMapping.lms_learner_id) {
      createMappingMutation.mutate(newMapping);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-950">LMS Integration</h1>
          <p className="mt-1 text-slate-600">
            Manage employee-to-learner mappings and view synchronization logs.
            Content management is done in the external LMS system.
          </p>
        </div>

        {/* External LMS Links */}
        <div className="grid gap-4 md:grid-cols-3">
          <a
            href="https://mcnlms.teammas.in/lms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
              <ExternalLink className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-950">Learner Portal</p>
              <p className="text-sm text-slate-500">Employee learning view</p>
            </div>
          </a>

          <a
            href="https://mcnlms.teammas.in/coordinator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="rounded-xl bg-green-100 p-3 text-green-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-950">Coordinator Portal</p>
              <p className="text-sm text-slate-500">Training coordination</p>
            </div>
          </a>

          <a
            href="https://mcnlms.teammas.in/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
              <ExternalLink className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-950">LMS Admin</p>
              <p className="text-sm text-slate-500">Content & curriculum</p>
            </div>
          </a>
        </div>

        {/* Learner Mapping */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Employee-Learner Mapping</h2>
              <p className="text-sm text-slate-600">Map HRMS employees to LMS learner accounts</p>
            </div>
          </div>

          {/* Create Mapping Form */}
          <form onSubmit={handleCreateMapping} className="mb-6 grid gap-4 rounded-xl border bg-slate-50 p-4 md:grid-cols-4">
            <input
              type="text"
              placeholder="Employee ID"
              value={newMapping.employee_id}
              onChange={(e) => setNewMapping({ ...newMapping, employee_id: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              placeholder="LMS Learner ID"
              value={newMapping.lms_learner_id}
              onChange={(e) => setNewMapping({ ...newMapping, lms_learner_id: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newMapping.email}
              onChange={(e) => setNewMapping({ ...newMapping, email: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={createMappingMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMappingMutation.isPending ? "Creating..." : "Create Mapping"}
            </button>
          </form>

          {/* Mappings List */}
          {mappingsLoading ? (
            <div className="py-8 text-center text-slate-500">Loading mappings...</div>
          ) : mappings.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No mappings found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee ID</th>
                    <th className="px-4 py-3 font-semibold">LMS Learner ID</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Mapped At</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-950">{mapping.employee_id}</td>
                      <td className="px-4 py-3 text-slate-700">{mapping.lms_learner_id}</td>
                      <td className="px-4 py-3 text-slate-700">{mapping.email}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {mapping.mapped_at ? new Date(mapping.mapped_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sync Log */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Synchronization Log</h2>
              <p className="text-sm text-slate-600">Recent LMS data sync operations</p>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["lms-sync-log"] })}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {syncLoading ? (
            <div className="py-8 text-center text-slate-500">Loading sync log...</div>
          ) : syncLog.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No sync operations recorded</div>
          ) : (
            <div className="space-y-3">
              {syncLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 rounded-xl border bg-slate-50 p-4"
                >
                  <div className="mt-0.5">
                    {entry.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : entry.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-slate-950">{entry.sync_type}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          entry.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : entry.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {entry.records_synced} records synced •{" "}
                      {new Date(entry.sync_started_at).toLocaleString()}
                    </p>
                    {entry.error_message && (
                      <p className="mt-2 text-sm text-red-600">{entry.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
