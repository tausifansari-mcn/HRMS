import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Activity, AlertTriangle, BarChart2, CheckCircle2, ChevronDown,
  Clock, Heart, Loader, RefreshCcw, Shield, Star, TrendingUp, Users, Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLabel = "critical_people_risk" | "attrition_risk" | "watchlist" | "stable" | "highly_engaged";

type HealthSnapshot = {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  branch_name?: string;
  process_name?: string;
  department_name?: string;
  engagement_score: number;
  data_confidence_score?: number;
  risk_label: RiskLabel;
  pulse_score?: number;
  attendance_score?: number;
  performance_score?: number;
  support_friction_score?: number;
  career_growth_score?: number;
  top_risk_drivers_json?: string;
  snapshot_date: string;
};

type Summary = { risk_label: RiskLabel; count: number; avg_score: number };

type PEAction = {
  id: string;
  employee_id: string;
  employee_name?: string;
  action_type: string;
  priority: string;
  status: string;
  owner_user_id?: string;
  due_date?: string;
  notes?: string;
  created_at: string;
};

type FilterOptions = {
  branches: { id: string; name: string }[];
  processes: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  risk_labels: string[];
};

// ─── Risk helpers ─────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLabel, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical_people_risk: { label: "Critical", color: "text-red-700", bg: "bg-red-100", border: "border-red-300", icon: <AlertTriangle size={14} /> },
  attrition_risk:       { label: "Attrition Risk", color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-300", icon: <TrendingUp size={14} /> },
  watchlist:            { label: "Watchlist", color: "text-yellow-700", bg: "bg-yellow-100", border: "border-yellow-300", icon: <Clock size={14} /> },
  stable:               { label: "Stable", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-300", icon: <Activity size={14} /> },
  highly_engaged:       { label: "Highly Engaged", color: "text-green-700", bg: "bg-green-100", border: "border-green-300", icon: <Star size={14} /> },
};

function RiskBadge({ label }: { label: RiskLabel }) {
  const cfg = RISK_CONFIG[label] ?? RISK_CONFIG.stable;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function ScoreBar({ value, max = 100, colorClass = "bg-blue-500" }: { value: number; max?: number; colorClass?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`${colorClass} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 75) return "bg-green-500";
  if (score >= 55) return "bg-blue-500";
  if (score >= 35) return "bg-yellow-500";
  return "bg-red-500";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NativePeopleExperienceCommandCenter() {
  const [loading, setLoading]           = useState(true);
  const [scanning, setScanning]         = useState(false);
  const [error, setError]               = useState("");
  const [summary, setSummary]           = useState<Summary[]>([]);
  const [watchlist, setWatchlist]       = useState<HealthSnapshot[]>([]);
  const [actions, setActions]           = useState<PEAction[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selected, setSelected]         = useState<HealthSnapshot | null>(null);
  const [tab, setTab]                   = useState<"watchlist" | "actions">("watchlist");

  // Filters
  const [filterBranch, setFilterBranch]   = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterDept, setFilterDept]       = useState("");
  const [filterRisk, setFilterRisk]       = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const res = await hrmsApi.get<{ success: boolean; data: FilterOptions }>("/api/engagement-intelligence/filter-options");
      if (res.data?.success) setFilterOptions(res.data.data);
    } catch { /* non-fatal */ }
    finally { setOptionsLoading(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterBranch)  params.set("branch_id",     filterBranch);
      if (filterProcess) params.set("process_id",    filterProcess);
      if (filterDept)    params.set("department_id", filterDept);
      if (filterRisk)    params.set("risk_label",    filterRisk);

      const [ccRes, actRes] = await Promise.all([
        hrmsApi.get<{ success: boolean; data: { summary: Summary[]; watchlist: HealthSnapshot[] } }>(
          `/api/engagement-intelligence/command-center?${params}`
        ),
        hrmsApi.get<{ success: boolean; data: PEAction[] }>("/api/engagement-intelligence/actions"),
      ]);

      if (ccRes.data?.success) {
        setSummary(ccRes.data.data.summary ?? []);
        setWatchlist(ccRes.data.data.watchlist ?? []);
      }
      if (actRes.data?.success) setActions(actRes.data.data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filterBranch, filterProcess, filterDept, filterRisk]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { load(); }, [load]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      await hrmsApi.post("/api/engagement-intelligence/scan", { limit: 500 });
      await load();
    } catch (e: any) {
      setError(e.message ?? "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [load]);

  const summaryTotals = useMemo(() => {
    const totals = summary.reduce<Record<string, number>>((acc, row) => {
      acc[row.risk_label] = Number(row.count) || 0;
      return acc;
    }, {});
    return {
      atRisk: (totals.critical_people_risk ?? 0) + (totals.attrition_risk ?? 0),
      watchlist: totals.watchlist ?? 0,
      stable: totals.stable ?? 0,
      highlyEngaged: totals.highly_engaged ?? 0,
      openActions: actions.reduce((count, action) => count + (action.status === "open" ? 1 : 0), 0),
    };
  }, [summary, actions]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Heart size={24} className="text-pink-500" />
              People Experience Command Center
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Engagement health, risk watchlist, and action management</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {scanning ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
              {scanning ? "Scanning…" : "Run Health Scan"}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Scoped Filters</span>
            {optionsLoading && <Loader size={12} className="animate-spin text-gray-400" />}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select label="Branch" value={filterBranch} onChange={setFilterBranch}
              options={filterOptions?.branches ?? []} loading={optionsLoading} />
            <Select label="Process" value={filterProcess} onChange={setFilterProcess}
              options={filterOptions?.processes ?? []} loading={optionsLoading} />
            <Select label="Department" value={filterDept} onChange={setFilterDept}
              options={filterOptions?.departments ?? []} loading={optionsLoading} />
            <SelectRaw label="Risk Level" value={filterRisk} onChange={setFilterRisk}
              options={filterOptions?.risk_labels ?? []} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard icon={<AlertTriangle size={20} className="text-red-500" />} label="At Risk" value={summaryTotals.atRisk} color="text-red-600" />
          <SummaryCard icon={<Clock size={20} className="text-yellow-500" />} label="Watchlist" value={summaryTotals.watchlist} color="text-yellow-600" />
          <SummaryCard icon={<Activity size={20} className="text-blue-500" />} label="Stable" value={summaryTotals.stable} color="text-blue-600" />
          <SummaryCard icon={<Star size={20} className="text-green-500" />} label="Highly Engaged" value={summaryTotals.highlyEngaged} color="text-green-600" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {(["watchlist", "actions"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t === "watchlist" ? "Employee Watchlist" : `Actions (${summaryTotals.openActions})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : tab === "watchlist" ? (
          <WatchlistTable data={watchlist} onSelect={setSelected} selected={selected} />
        ) : (
          <ActionsTable data={actions} onRefresh={load} />
        )}

        {/* Detail drawer */}
        {selected && (
          <DetailDrawer snapshot={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, loading }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; name: string }[]; loading: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={loading}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

function SelectRaw({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All</option>
        {options.map(o => (
          <option key={o} value={o}>{o.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
        ))}
      </select>
    </div>
  );
}

function WatchlistTable({ data, onSelect, selected }: {
  data: HealthSnapshot[];
  onSelect: (s: HealthSnapshot) => void;
  selected: HealthSnapshot | null;
}) {
  if (data.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <Users size={40} className="mx-auto mb-3 opacity-30" />
      <p>No data. Run a health scan to populate.</p>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Branch / Process</th>
              <th className="px-4 py-3 text-center">Risk</th>
              <th className="px-4 py-3 text-center">Score</th>
              <th className="px-4 py-3 text-center">Pulse</th>
              <th className="px-4 py-3 text-center">Attend.</th>
              <th className="px-4 py-3 text-center">Perf.</th>
              <th className="px-4 py-3 text-center">Support</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map(row => (
              <tr
                key={row.employee_id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer hover:bg-indigo-50 transition-colors ${selected?.employee_id === row.employee_id ? "bg-indigo-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{row.employee_name}</div>
                  <div className="text-xs text-gray-400">{row.employee_code}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {row.branch_name}<br />{row.process_name}
                </td>
                <td className="px-4 py-3 text-center">
                  <RiskBadge label={row.risk_label} />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="font-bold text-gray-800">{Math.round(row.engagement_score)}</div>
                  <ScoreBar value={row.engagement_score} colorClass={scoreColor(row.engagement_score)} />
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{row.pulse_score != null ? Math.round(row.pulse_score) : "—"}</td>
                <td className="px-4 py-3 text-center text-gray-600">{row.attendance_score != null ? Math.round(row.attendance_score) : "—"}</td>
                <td className="px-4 py-3 text-center text-gray-600">{row.performance_score != null ? Math.round(row.performance_score) : "—"}</td>
                <td className="px-4 py-3 text-center">
                  {row.support_friction_score != null && row.support_friction_score < 60 ? (
                    <span className="text-xs text-red-600 font-medium">Friction</span>
                  ) : (
                    <span className="text-xs text-gray-400">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionsTable({ data, onRefresh }: { data: PEAction[]; onRefresh: () => void }) {
  if (data.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
      <p>No actions yet.</p>
    </div>
  );

  const PRIORITY_COLOR: Record<string, string> = {
    critical: "text-red-600",
    high:     "text-orange-600",
    medium:   "text-yellow-600",
    low:      "text-gray-500",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3 text-left">Employee</th>
            <th className="px-4 py-3 text-center">Priority</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-left">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(a => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-800">{a.action_type.replace(/_/g, " ")}</div>
                {a.notes && <div className="text-xs text-gray-400 truncate max-w-xs">{a.notes}</div>}
              </td>
              <td className="px-4 py-3 text-gray-600">{a.employee_name ?? a.employee_id.slice(0, 8)}</td>
              <td className={`px-4 py-3 text-center font-medium text-xs ${PRIORITY_COLOR[a.priority] ?? "text-gray-500"}`}>
                {a.priority.toUpperCase()}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  a.status === "completed" ? "bg-green-100 text-green-700" :
                  a.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                  a.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                  "bg-yellow-100 text-yellow-700"
                }`}>{a.status}</span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {a.due_date ? new Date(a.due_date + "T00:00:00").toLocaleDateString("en-IN") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ snapshot, onClose }: { snapshot: HealthSnapshot; onClose: () => void }) {
  const drivers = useMemo(() => {
    try {
      const parsed = JSON.parse(snapshot.top_risk_drivers_json ?? "[]");
      return Array.isArray(parsed) ? parsed as string[] : [];
    } catch {
      return [];
    }
  }, [snapshot.top_risk_drivers_json]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{snapshot.employee_name}</h2>
            <p className="text-sm text-gray-500">{snapshot.employee_code} · {snapshot.branch_name} · {snapshot.process_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
        </div>

        <div className="flex items-center gap-3">
          <RiskBadge label={snapshot.risk_label} />
          <span className="text-2xl font-bold text-gray-800">{Math.round(snapshot.engagement_score)}<span className="text-sm text-gray-400">/100</span></span>
          {snapshot.data_confidence_score != null && (
            <span className="text-xs text-gray-400">Confidence: {snapshot.data_confidence_score}%</span>
          )}
        </div>

        <div className="space-y-3">
          {[
            { label: "Pulse", value: snapshot.pulse_score, color: "bg-pink-400" },
            { label: "Attendance", value: snapshot.attendance_score, color: "bg-blue-400" },
            { label: "Performance", value: snapshot.performance_score, color: "bg-purple-400" },
            { label: "Support", value: snapshot.support_friction_score, color: "bg-orange-400" },
            { label: "Career Growth", value: snapshot.career_growth_score, color: "bg-teal-400" },
          ].map(({ label, value, color }) => value != null ? (
            <div key={label}>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{label}</span>
                <span className="font-medium">{Math.round(value)}</span>
              </div>
              <ScoreBar value={value} colorClass={color} />
            </div>
          ) : null)}
        </div>

        {drivers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-orange-500" /> Risk Drivers
            </h3>
            <ul className="space-y-1">
              {drivers.map(d => (
                <li key={d} className="text-sm text-orange-700 bg-orange-50 rounded px-2 py-1">
                  {d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2 text-xs text-gray-400">Last scan: {snapshot.snapshot_date}</div>
      </div>
    </div>
  );
}
