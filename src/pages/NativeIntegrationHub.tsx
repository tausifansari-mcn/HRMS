import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  GitBranch,
  Loader,
  Plus,
  RefreshCcw,
  Settings,
  ToggleLeft,
  ToggleRight,
  X,
  Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";
import { DatabaseConnectorCard } from "@/components/integrations/DatabaseConnectorCard";
import { DatabaseConfigModal } from "@/components/integrations/DatabaseConfigModal";
import { SimpleConnectorWizard } from "@/components/integrations/SimpleConnectorWizard";

// ─── Types ──────────────────────────────────────────────────────────────────

type ConnectorType = "manual" | "api" | "db" | "scheduled";
type ConnectorStatus = "active" | "inactive" | "error" | "pending";

interface Connector {
  key: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  last_run_at: string | null;
  description: string;
}

interface FieldMap {
  id: string;
  source_field: string;
  target_field: string;
  transform: string | null;
  is_active: boolean;
}

interface SuggestedMapping {
  suggestion_id: string;
  source_field: string;
  target_field: string;
  confidence: number;
  confirmed: boolean;
}

interface Schedule {
  cron_expression: string;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface RunRecord {
  id: string;
  connector_key: string;
  connector_name: string;
  type: ConnectorType;
  status: "success" | "partial" | "failed" | "running";
  records_synced: number;
  errors: number;
  created_at: string;
}

interface NewConnectorForm {
  key: string;
  name: string;
  type: ConnectorType;
  description: string;
  config_json: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ConnectorType, string> = {
  manual:    "bg-slate-100 text-slate-700",
  api:       "bg-blue-50 text-blue-700",
  db:        "bg-violet-50 text-violet-700",
  scheduled: "bg-amber-50 text-amber-700",
};

const STATUS_DOT: Record<ConnectorStatus, string> = {
  active:   "bg-emerald-500",
  inactive: "bg-slate-400",
  error:    "bg-red-500",
  pending:  "bg-amber-400",
};

const RUN_STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  failed:  "bg-red-50 text-red-700",
  running: "bg-blue-50 text-blue-700",
};

const TABS = ["Overview", "Run History", "Connector Config"] as const;
type Tab = (typeof TABS)[number];

function TypeBadge({ type }: { type: ConnectorType }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${TYPE_COLORS[type]}`}>
      {type}
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const cls = RUN_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NativeIntegrationHub() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Overview
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [runningKey, setRunningKey] = useState<string | null>(null);

  // Database Connectors
  const [dbConnectors, setDbConnectors] = useState<any[]>([]);
  const [dbConfigOpen, setDbConfigOpen] = useState(false);
  const [activeDbKey, setActiveDbKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  // Run History
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Connector Config
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSimpleWizard, setShowSimpleWizard] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [fieldMaps, setFieldMaps] = useState<FieldMap[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedMapping[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [newForm, setNewForm] = useState<NewConnectorForm>({
    key: "",
    name: "",
    type: "api",
    description: "",
    config_json: "{}",
  });

  // ─── Data Loaders ──────────────────────────────────────────────────────────

  const loadConnectors = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await hrmsApi.get<{ success: boolean; data: Connector[] }>(
        "/api/integration-hub/"
      );
      setConnectors(res.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load connectors";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadDbConnectors = async () => {
    try {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>('/api/external-db');
      setDbConnectors(res.data ?? []);
    } catch { /* silent */ }
  };

  const testDbConnector = async (key: string) => {
    setTestingKey(key);
    try {
      await hrmsApi.post(`/api/external-db/${key}/test`, {});
      await loadDbConnectors();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingKey(null);
    }
  };

  const loadRuns = async () => {
    setRunsLoading(true);
    try {
      const res = await hrmsApi.get<{ success: boolean; data: RunRecord[] }>(
        "/api/integration-hub/runs"
      );
      setRuns(res.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load run history";
      setMessage(msg);
    } finally {
      setRunsLoading(false);
    }
  };

  const loadConnectorDetail = async (connector: Connector) => {
    setSelectedConnector(connector);
    setFieldMaps([]);
    setSuggestions([]);
    setSchedule(null);
    setDetailLoading(true);
    try {
      const [fmRes, sugRes, schedRes] = await Promise.all([
        hrmsApi.get<{ success: boolean; data: FieldMap[] }>(
          `/api/integration-hub/${connector.key}/field-maps`
        ),
        hrmsApi.get<{ success: boolean; data: SuggestedMapping[] }>(
          `/api/integration-hub/${connector.key}/suggestions`
        ),
        hrmsApi.get<{ success: boolean; data: Schedule }>(
          `/api/integration-hub/${connector.key}/schedule`
        ),
      ]);
      setFieldMaps(fmRes.data ?? []);
      setSuggestions(sugRes.data ?? []);
      setSchedule(schedRes.data ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load connector details";
      setMessage(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadConnectors();
    void loadDbConnectors();
  }, []);

  useEffect(() => {
    if (activeTab === "Run History") void loadRuns();
  }, [activeTab]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const triggerRun = async (key: string) => {
    setRunningKey(key);
    try {
      await hrmsApi.post(`/api/integration-hub/${key}/run`, {});
      setMessage(`Run triggered for "${key}".`);
      await loadConnectors();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Run trigger failed";
      setMessage(msg);
    } finally {
      setRunningKey(null);
    }
  };

  const addConnector = async () => {
    if (!newForm.key.trim() || !newForm.name.trim()) {
      setMessage("Key and Name are required.");
      return;
    }
    try {
      await hrmsApi.post("/api/integration-hub/", {
        key: newForm.key.trim(),
        name: newForm.name.trim(),
        type: newForm.type,
        description: newForm.description,
        config_json: newForm.config_json,
      });
      setShowAddModal(false);
      setNewForm({ key: "", name: "", type: "api", description: "", config_json: "{}" });
      setMessage("Connector added successfully.");
      await loadConnectors();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add connector";
      setMessage(msg);
    }
  };

  const confirmSuggestion = async (suggestionId: string) => {
    setConfirmingId(suggestionId);
    try {
      await hrmsApi.post("/api/integration-hub/field-maps/confirm", {
        suggestion_id: suggestionId,
      });
      setSuggestions((prev) =>
        prev.map((s) =>
          s.suggestion_id === suggestionId ? { ...s, confirmed: true } : s
        )
      );
      setMessage("Mapping confirmed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Confirm failed";
      setMessage(msg);
    } finally {
      setConfirmingId(null);
    }
  };

  const saveSchedule = async () => {
    if (!selectedConnector || !schedule) return;
    try {
      await hrmsApi.put(`/api/integration-hub/${selectedConnector.key}/schedule`, {
        cron_expression: schedule.cron_expression,
        is_enabled: schedule.is_enabled,
      });
      setScheduleEditing(false);
      setMessage("Schedule updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Schedule update failed";
      setMessage(msg);
    }
  };

  // ─── Derived Stats ─────────────────────────────────────────────────────────

  const activeCount = connectors.filter((c) => c.status === "active").length;
  const errorCount  = connectors.filter((c) => c.status === "error").length;
  const successRuns = runs.filter((r) => r.status === "success").length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">
              Integrations
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Integration Hub</h1>
            <p className="mt-2 max-w-4xl text-slate-600">
              Manage data connectors, field mappings, sync schedules, and run history across all
              integrated systems.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                void loadConnectors();
                if (activeTab === "Run History") void loadRuns();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {message}
            </div>
            <button
              onClick={() => setMessage("")}
              className="cursor-pointer text-blue-600 hover:text-blue-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Connectors"
            value={connectors.length}
            icon={<GitBranch className="h-5 w-5" />}
            tone="bg-slate-100 text-slate-700"
          />
          <StatCard
            title="Active"
            value={activeCount}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            title="Errors"
            value={errorCount}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="bg-red-50 text-red-700"
          />
          <StatCard
            title="Successful Runs"
            value={successRuns}
            icon={<Zap className="h-5 w-5" />}
            tone="bg-blue-50 text-blue-700"
          />
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 rounded-2xl border bg-white p-1.5 shadow-sm w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? "bg-slate-950 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ────────────────────────────────────────────────── */}
        {activeTab === "Overview" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : connectors.length === 0 ? (
              <div className="rounded-3xl border bg-white py-20 text-center shadow-sm">
                <GitBranch className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-semibold text-slate-400">No connectors found.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {connectors.map((c) => (
                  <div
                    key={c.key}
                    className="group relative overflow-hidden rounded-3xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Status dot */}
                    <span
                      className={`absolute right-5 top-5 h-3 w-3 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-300"}`}
                      title={c.status}
                    />
                    <div className="mb-3 flex items-start gap-3">
                      <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
                        <Database className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-black text-slate-950">{c.name}</h3>
                        <p className="font-mono text-xs text-slate-400">{c.key}</p>
                      </div>
                    </div>
                    <p className="mb-4 text-sm text-slate-500 line-clamp-2">{c.description || "No description."}</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={c.type} />
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {c.last_run_at ? c.last_run_at.slice(0, 16).replace("T", " ") : "Never"}
                        </span>
                      </div>
                      <button
                        onClick={() => void triggerRun(c.key)}
                        disabled={runningKey === c.key}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {runningKey === c.key ? (
                          <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        Run Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dbConnectors.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Database Connectors</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {dbConnectors.map((dc) => {
                    const cfg = dc.config_json ?? {};
                    return (
                      <DatabaseConnectorCard
                        key={dc.integration_key}
                        integrationKey={dc.integration_key}
                        name={dc.integration_name}
                        config={cfg}
                        activeStatus={dc.active_status}
                        testOk={dc.test_ok}
                        testError={dc.test_error}
                        testAt={dc.test_at}
                        onConfigure={() => { setActiveDbKey(dc.integration_key); setDbConfigOpen(true); }}
                        onTest={() => testDbConnector(dc.integration_key)}
                        isTesting={testingKey === dc.integration_key}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Run History ─────────────────────────────────────────────── */}
        {activeTab === "Run History" && (
          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-black text-slate-950">Run History</h2>
              <p className="text-sm text-slate-500">{runs.length} records</p>
            </div>
            {runsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : runs.length === 0 ? (
              <div className="py-20 text-center">
                <Clock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-semibold text-slate-400">No run history yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      {["Connector", "Type", "Status", "Records Synced", "Errors", "Ran At"].map(
                        (h) => (
                          <th key={h} className="p-4 font-semibold">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-slate-50/80 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-950">
                            {r.connector_name || r.connector_key}
                          </div>
                          <div className="font-mono text-xs text-slate-400">{r.connector_key}</div>
                        </td>
                        <td className="p-4">
                          <TypeBadge type={r.type} />
                        </td>
                        <td className="p-4">
                          <RunStatusBadge status={r.status} />
                        </td>
                        <td className="p-4 font-semibold text-slate-700">
                          {r.records_synced.toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={
                              r.errors > 0
                                ? "font-bold text-red-600"
                                : "text-slate-400"
                            }
                          >
                            {r.errors}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400">
                          {r.created_at?.slice(0, 16).replace("T", " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Connector Config ─────────────────────────────────────────── */}
        {activeTab === "Connector Config" && (
          <div className="space-y-5">
            {/* Add Connector */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSimpleWizard(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <Zap className="h-4 w-4" />
                Quick Connect
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Advanced
              </button>
            </div>

            <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
              {/* Connector List */}
              <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                <div className="border-b p-4">
                  <h3 className="font-black text-slate-950">Connectors</h3>
                  <p className="text-xs text-slate-500">Click to view detail</p>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : connectors.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    No connectors yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {connectors.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => void loadConnectorDetail(c)}
                        className={`w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                          selectedConnector?.key === c.key ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-950">{c.name}</p>
                            <p className="font-mono text-xs text-slate-400">{c.key}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span
                              className={`h-2 w-2 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-300"}`}
                            />
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>
                        <div className="mt-1">
                          <TypeBadge type={c.type} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              <div className="space-y-5">
                {!selectedConnector ? (
                  <div className="flex h-64 items-center justify-center rounded-3xl border bg-white shadow-sm">
                    <div className="text-center">
                      <Settings className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <p className="font-semibold text-slate-400">
                        Select a connector to view details
                      </p>
                    </div>
                  </div>
                ) : detailLoading ? (
                  <div className="flex h-64 items-center justify-center rounded-3xl border bg-white shadow-sm">
                    <Loader className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <>
                    {/* Connector Info */}
                    <div className="rounded-3xl border bg-white p-5 shadow-sm">
                      <h3 className="mb-1 font-black text-slate-950">
                        {selectedConnector.name}
                      </h3>
                      <p className="mb-3 text-sm text-slate-500">
                        {selectedConnector.description || "No description."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <TypeBadge type={selectedConnector.type} />
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                            selectedConnector.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : selectedConnector.status === "error"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {selectedConnector.status}
                        </span>
                      </div>
                    </div>

                    {/* Field Mapping */}
                    <div className="rounded-3xl border bg-white p-5 shadow-sm">
                      <h3 className="mb-4 font-black text-slate-950">Field Mappings</h3>

                      {/* Confirmed Mappings */}
                      {fieldMaps.length > 0 && (
                        <div className="mb-5">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Active Mappings
                          </p>
                          <div className="space-y-2">
                            {fieldMaps.map((fm) => (
                              <div
                                key={fm.id}
                                className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm"
                              >
                                <span className="font-mono font-semibold text-slate-700">
                                  {fm.source_field}
                                </span>
                                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                <span className="font-mono font-semibold text-slate-700">
                                  {fm.target_field}
                                </span>
                                {fm.transform && (
                                  <span className="ml-auto rounded-lg bg-white px-2 py-1 text-xs text-slate-500 border">
                                    {fm.transform}
                                  </span>
                                )}
                                <CheckCircle2 className="ml-auto h-4 w-4 flex-shrink-0 text-emerald-600" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggestions */}
                      {suggestions.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Suggested Mappings
                          </p>
                          <div className="space-y-2">
                            {suggestions.map((s) => (
                              <div
                                key={s.suggestion_id}
                                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${
                                  s.confirmed
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <span className="font-mono text-sm text-slate-700">
                                  {s.source_field}
                                </span>
                                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                <span className="font-mono text-sm text-slate-700">
                                  {s.target_field}
                                </span>
                                <span
                                  className={`ml-auto rounded-lg px-2 py-0.5 text-xs font-bold ${
                                    s.confidence >= 0.9
                                      ? "bg-emerald-100 text-emerald-700"
                                      : s.confidence >= 0.7
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {Math.round(s.confidence * 100)}%
                                </span>
                                {s.confirmed ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                ) : (
                                  <button
                                    onClick={() => void confirmSuggestion(s.suggestion_id)}
                                    disabled={confirmingId === s.suggestion_id}
                                    className="cursor-pointer rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 flex-shrink-0"
                                  >
                                    {confirmingId === s.suggestion_id ? (
                                      <Loader className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Confirm"
                                    )}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {fieldMaps.length === 0 && suggestions.length === 0 && (
                        <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-slate-400">
                          No field mappings or suggestions for this connector.
                        </div>
                      )}
                    </div>

                    {/* Schedule */}
                    <div className="rounded-3xl border bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-black text-slate-950">Sync Schedule</h3>
                        {!scheduleEditing ? (
                          <button
                            onClick={() => setScheduleEditing(true)}
                            className="cursor-pointer rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Edit
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setScheduleEditing(false)}
                              className="cursor-pointer rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => void saveSchedule()}
                              className="cursor-pointer rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                      {schedule ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                              Cron Expression
                            </label>
                            {scheduleEditing ? (
                              <input
                                value={schedule.cron_expression}
                                onChange={(e) =>
                                  setSchedule({ ...schedule, cron_expression: e.target.value })
                                }
                                className="w-full rounded-2xl border px-4 py-3 font-mono text-sm outline-none focus:border-blue-400 transition-colors"
                                placeholder="e.g. 0 * * * *"
                              />
                            ) : (
                              <p className="rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
                                {schedule.cron_expression || "–"}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                            <span className="text-sm font-semibold text-slate-700">Enabled</span>
                            <button
                              onClick={() =>
                                scheduleEditing &&
                                setSchedule({ ...schedule, is_enabled: !schedule.is_enabled })
                              }
                              className={`cursor-pointer text-slate-700 transition-colors ${
                                !scheduleEditing ? "pointer-events-none opacity-60" : ""
                              }`}
                            >
                              {schedule.is_enabled ? (
                                <ToggleRight className="h-6 w-6 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-slate-400" />
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-xs font-semibold text-slate-500">Last Run</p>
                              <p className="mt-1 font-mono text-slate-700">
                                {schedule.last_run_at
                                  ? schedule.last_run_at.slice(0, 16).replace("T", " ")
                                  : "Never"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-xs font-semibold text-slate-500">Next Run</p>
                              <p className="mt-1 font-mono text-slate-700">
                                {schedule.next_run_at
                                  ? schedule.next_run_at.slice(0, 16).replace("T", " ")
                                  : "–"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-slate-400">
                          No schedule configured for this connector.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Database Config Modal ───────────────────────────────────────────── */}
      {dbConfigOpen && activeDbKey && (() => {
        const dc = dbConnectors.find(d => d.integration_key === activeDbKey);
        if (!dc) return null;
        const cfg = dc.config_json ?? {};
        return (
          <DatabaseConfigModal
            open={dbConfigOpen}
            onClose={() => { setDbConfigOpen(false); void loadDbConnectors(); }}
            integrationKey={activeDbKey}
            name={dc.integration_name}
            initialConfig={cfg}
          />
        );
      })()}

      {/* ── Add Connector Modal ─────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-black text-slate-950">Add Connector</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newForm.key}
                    onChange={(e) => setNewForm({ ...newForm, key: e.target.value })}
                    placeholder="e.g. salesforce_sync"
                    className="w-full rounded-2xl border px-4 py-3 font-mono text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="e.g. Salesforce Sync"
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type</label>
                <select
                  value={newForm.type}
                  onChange={(e) =>
                    setNewForm({ ...newForm, type: e.target.value as ConnectorType })
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                >
                  <option value="manual">Manual</option>
                  <option value="api">API</option>
                  <option value="db">Database</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  placeholder="Brief description of this connector…"
                  rows={2}
                  className="w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Config JSON
                </label>
                <textarea
                  value={newForm.config_json}
                  onChange={(e) => setNewForm({ ...newForm, config_json: e.target.value })}
                  placeholder='{"host": "...", "port": 5432}'
                  rows={3}
                  className="w-full resize-none rounded-2xl border px-4 py-3 font-mono text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t p-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 cursor-pointer rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void addConnector()}
                className="flex-1 cursor-pointer rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Add Connector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Connector Wizard */}
      <SimpleConnectorWizard
        open={showSimpleWizard}
        onOpenChange={setShowSimpleWizard}
        onSuccess={() => {
          loadConnectors();
          loadDbConnectors();
        }}
      />
    </DashboardLayout>
  );
}
