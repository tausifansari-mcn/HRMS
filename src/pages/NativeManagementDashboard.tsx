import { useEffect, useState } from "react";
import {
  AlertTriangle, BarChart3, BookOpen, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Loader, Minus,
  Plus, RefreshCcw, Users, X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardStats = {
  headcount: number;
  attrition_rate: number;
  avg_kpi_score: number;
  open_tickets: number;
  pending_leaves: number;
  attendance_rate: number;
};

type TeamKpi = {
  employee_id: string;
  employee_name: string;
  period: string;
  overall_score: number;
  rank_position: number;
  trend: "up" | "down" | "stable";
};

type CoachingSession = {
  id: string;
  employee_id: string;
  employee_name: string;
  coach_user_id: string;
  session_date: string;
  session_type: string;
  notes: string;
  action_items: string;
  status: string;
};

type PerformanceAlert = {
  id: string;
  employee_id: string;
  employee_name: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  acknowledged: boolean;
};

type CoachingForm = {
  employee_id: string;
  session_date: string;
  session_type: string;
  notes: string;
  action_items: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
  tone,
  suffix = "",
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  suffix?: string;
}) {
  return (
    <div className="glass-card stat-card rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
            {suffix}
          </p>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "bg-emerald-50 text-emerald-700"
      : score >= 60
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {score.toFixed(1)}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return <ChevronUp className="h-4 w-4 text-emerald-500 inline" />;
  if (trend === "down")
    return <ChevronDown className="h-4 w-4 text-red-500 inline" />;
  return <Minus className="h-4 w-4 text-slate-400 inline" />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
        map[severity] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {severity}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-rose-50 text-rose-700",
    rescheduled: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        map[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type ActiveTab = "overview" | "kpi" | "coaching" | "alerts";
const SEVERITY_TABS = ["All", "Critical", "High", "Medium", "Low"] as const;
const SESSION_TYPES = [
  "one_on_one",
  "performance_review",
  "goal_setting",
  "feedback",
  "disciplinary",
  "career_development",
];

export default function NativeManagementDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Data state
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [teamKpi, setTeamKpi] = useState<TeamKpi[]>([]);
  const [coachingSessions, setCoachingSessions] = useState<CoachingSession[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);

  // UI state
  const [kpiPeriod, setKpiPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [submittingCoaching, setSubmittingCoaching] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const [coachingForm, setCoachingForm] = useState<CoachingForm>({
    employee_id: "",
    session_date: "",
    session_type: "one_on_one",
    notes: "",
    action_items: "",
  });

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadDashboard = async () => {
    try {
      const res = await hrmsApi.get<{ success: boolean; data: DashboardStats }>(
        "/api/management/dashboard"
      );
      setDashStats(res.data ?? null);
    } catch {
      // silently handled by top-level loading state
    }
  };

  const loadKpi = async () => {
    try {
      const res = await hrmsApi.get<{ success: boolean; data: TeamKpi[] }>(
        `/api/management/team-kpi?period=${kpiPeriod}`
      );
      setTeamKpi(res.data ?? []);
    } catch {
      //
    }
  };

  const loadCoaching = async () => {
    try {
      const res = await hrmsApi.get<{
        success: boolean;
        data: CoachingSession[];
      }>("/api/management/coaching");
      setCoachingSessions(res.data ?? []);
    } catch {
      //
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await hrmsApi.get<{
        success: boolean;
        data: PerformanceAlert[];
      }>("/api/management/alerts");
      setAlerts(res.data ?? []);
    } catch {
      //
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setMessage("");
    try {
      await Promise.all([loadDashboard(), loadKpi(), loadCoaching(), loadAlerts()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to load data";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiPeriod]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const submitCoaching = async () => {
    if (!coachingForm.employee_id.trim()) {
      setMessage("Employee ID is required.");
      return;
    }
    if (!coachingForm.session_date) {
      setMessage("Session date is required.");
      return;
    }
    setSubmittingCoaching(true);
    try {
      await hrmsApi.post("/api/management/coaching", coachingForm);
      setShowCoachingModal(false);
      setCoachingForm({
        employee_id: "",
        session_date: "",
        session_type: "one_on_one",
        notes: "",
        action_items: "",
      });
      setMessage("Coaching session scheduled.");
      await loadCoaching();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to schedule session.";
      setMessage(msg);
    } finally {
      setSubmittingCoaching(false);
    }
  };

  const acknowledgeAlert = async (id: string) => {
    setAcknowledgingId(id);
    try {
      await hrmsApi.post(`/api/management/alerts/${id}/acknowledge`, {});
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Acknowledge failed.";
      setMessage(msg);
    } finally {
      setAcknowledgingId(null);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter === "All") return true;
    return a.severity.toLowerCase() === severityFilter.toLowerCase();
  });

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const TABS: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "kpi", label: "KPI" },
    { id: "coaching", label: "Coaching", badge: coachingSessions.length },
    { id: "alerts", label: "Alerts", badge: unacknowledgedCount || undefined },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">
              Management
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Command Centre
            </h1>
            <p className="mt-2 max-w-4xl text-slate-600">
              Real-time overview of team KPIs, performance alerts, and coaching
              pipeline.
            </p>
          </div>
          <button
            onClick={() => loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Message banner */}
        {message && (
          <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {message}
          </div>
        )}

        {/* Section tabs */}
        <div className="flex items-center gap-1 rounded-2xl border bg-slate-50 p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Overview Tab ───────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <StatCard
                    title="Headcount"
                    value={dashStats?.headcount ?? 0}
                    icon={<Users className="h-5 w-5" />}
                    tone="bg-blue-50 text-blue-700"
                  />
                  <StatCard
                    title="Attrition Rate"
                    value={dashStats?.attrition_rate ?? 0}
                    suffix="%"
                    icon={<ChevronDown className="h-5 w-5" />}
                    tone="bg-rose-50 text-rose-700"
                  />
                  <StatCard
                    title="Avg KPI Score"
                    value={dashStats?.avg_kpi_score ?? 0}
                    icon={<BarChart3 className="h-5 w-5" />}
                    tone="bg-emerald-50 text-emerald-700"
                  />
                  <StatCard
                    title="Open Tickets"
                    value={dashStats?.open_tickets ?? 0}
                    icon={<AlertTriangle className="h-5 w-5" />}
                    tone="bg-amber-50 text-amber-700"
                  />
                  <StatCard
                    title="Pending Leaves"
                    value={dashStats?.pending_leaves ?? 0}
                    icon={<Clock className="h-5 w-5" />}
                    tone="bg-violet-50 text-violet-700"
                  />
                  <StatCard
                    title="Attendance %"
                    value={dashStats?.attendance_rate ?? 0}
                    suffix="%"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    tone="bg-cyan-50 text-cyan-700"
                  />
                </div>

                {/* Quick-view alert summary */}
                {unacknowledgedCount > 0 && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <p className="font-bold text-red-800">
                          {unacknowledgedCount} unacknowledged performance alert
                          {unacknowledgedCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("alerts")}
                        className="cursor-pointer text-sm font-semibold text-red-700 underline hover:text-red-900"
                      >
                        View Alerts
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── KPI Tab ────────────────────────────────────────────────────── */}
            {activeTab === "kpi" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-950">
                    Team KPI Leaderboard
                  </h2>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-slate-600">
                      Period
                    </label>
                    <input
                      type="month"
                      value={kpiPeriod}
                      onChange={(e) => setKpiPeriod(e.target.value)}
                      className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                  {teamKpi.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <BarChart3 className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p className="font-semibold">No KPI data for this period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>
                            {["Rank", "Employee", "Period", "Score", "Trend"].map(
                              (h) => (
                                <th key={h} className="p-4 font-semibold">
                                  {h}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {teamKpi.map((row) => (
                            <tr
                              key={row.employee_id}
                              className="border-t hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="p-4">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                                  {row.rank_position}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-slate-950">
                                  {row.employee_name}
                                </div>
                                <div className="text-xs font-mono text-slate-400">
                                  {row.employee_id}
                                </div>
                              </td>
                              <td className="p-4 font-mono text-slate-500">
                                {row.period}
                              </td>
                              <td className="p-4">
                                <ScoreBadge score={row.overall_score} />
                              </td>
                              <td className="p-4">
                                <TrendIcon trend={row.trend} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Coaching Tab ───────────────────────────────────────────────── */}
            {activeTab === "coaching" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-950">
                    Coaching Sessions
                  </h2>
                  <button
                    onClick={() => setShowCoachingModal(true)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Schedule Coaching
                  </button>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                  {coachingSessions.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p className="font-semibold">No coaching sessions yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <tr>
                            {[
                              "Employee",
                              "Date",
                              "Type",
                              "Notes",
                              "Action Items",
                              "Status",
                            ].map((h) => (
                              <th key={h} className="p-4 font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {coachingSessions.map((s) => (
                            <tr
                              key={s.id}
                              className="border-t hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="p-4">
                                <div className="font-bold text-slate-950">
                                  {s.employee_name}
                                </div>
                                <div className="text-xs font-mono text-slate-400">
                                  {s.employee_id}
                                </div>
                              </td>
                              <td className="p-4 font-mono text-slate-500 text-xs">
                                {s.session_date?.slice(0, 10)}
                              </td>
                              <td className="p-4 text-slate-600 capitalize">
                                {s.session_type?.replace(/_/g, " ")}
                              </td>
                              <td className="p-4 max-w-[180px] truncate text-slate-600">
                                {s.notes || "–"}
                              </td>
                              <td className="p-4 max-w-[180px] truncate text-slate-500">
                                {s.action_items || "–"}
                              </td>
                              <td className="p-4">
                                <SessionStatusBadge status={s.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Alerts Tab ─────────────────────────────────────────────────── */}
            {activeTab === "alerts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-950">
                    Performance Alerts
                  </h2>
                  <p className="text-sm text-slate-500">
                    {unacknowledgedCount} pending
                  </p>
                </div>

                {/* Severity filter tabs */}
                <div className="flex flex-wrap gap-2">
                  {SEVERITY_TABS.map((sv) => (
                    <button
                      key={sv}
                      onClick={() => setSeverityFilter(sv)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        severityFilter === sv
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {sv}
                    </button>
                  ))}
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                  {filteredAlerts.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <CheckCircle2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p className="font-semibold">No alerts in this category.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-4 p-5 transition-colors ${
                            alert.acknowledged
                              ? "opacity-50 bg-slate-50"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-bold text-slate-950">
                                {alert.employee_name}
                              </span>
                              <SeverityBadge severity={alert.severity} />
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 capitalize">
                                {alert.alert_type?.replace(/_/g, " ")}
                              </span>
                              {alert.acknowledged && (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Acknowledged
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 truncate">
                              {alert.message}
                            </p>
                          </div>
                          {!alert.acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              disabled={acknowledgingId === alert.id}
                              className="flex-shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                              {acknowledgingId === alert.id ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Acknowledge"
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Schedule Coaching Modal ──────────────────────────────────────────── */}
      {showCoachingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-black text-slate-950">
                Schedule Coaching Session
              </h2>
              <button
                onClick={() => setShowCoachingModal(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Employee ID / UUID
                </label>
                <input
                  value={coachingForm.employee_id}
                  onChange={(e) =>
                    setCoachingForm({ ...coachingForm, employee_id: e.target.value })
                  }
                  placeholder="Enter employee UUID"
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={coachingForm.session_date}
                    onChange={(e) =>
                      setCoachingForm({
                        ...coachingForm,
                        session_date: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Session Type
                  </label>
                  <select
                    value={coachingForm.session_type}
                    onChange={(e) =>
                      setCoachingForm({
                        ...coachingForm,
                        session_type: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400"
                  >
                    {SESSION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  value={coachingForm.notes}
                  onChange={(e) =>
                    setCoachingForm({ ...coachingForm, notes: e.target.value })
                  }
                  placeholder="Session agenda or context…"
                  rows={3}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Action Items
                </label>
                <textarea
                  value={coachingForm.action_items}
                  onChange={(e) =>
                    setCoachingForm({
                      ...coachingForm,
                      action_items: e.target.value,
                    })
                  }
                  placeholder="Follow-up tasks or commitments…"
                  rows={2}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t p-6">
              <button
                onClick={() => setShowCoachingModal(false)}
                className="flex-1 cursor-pointer rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitCoaching}
                disabled={submittingCoaching}
                className="flex-1 cursor-pointer rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {submittingCoaching ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    Scheduling…
                  </span>
                ) : (
                  "Schedule Session"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
