import { useEffect, useMemo, useState } from "react";
import { hrmsApi } from "@/lib/hrmsApi";

type ApiResponse<T> = { success: boolean; data: T };
type InboxItem = { id: string; title: string; description?: string | null; priority: string; module_key: string; task_type: string; due_at?: string | null; status: string; action_url?: string | null };
type EventItem = { id: string; title: string; message?: string | null; severity: string; module_key: string; event_type: string; created_at: string; action_url?: string | null };
type HealthCheck = { code: string; label: string; count: number; severity: string };

type TabKey = "inbox" | "events" | "health" | "risks";

const priorityClass: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

function Badge({ value }: { value: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityClass[value] ?? priorityClass.info}`}>{value}</span>;
}

export default function NativeControlTower() {
  const [tab, setTab] = useState<TabKey>("inbox");
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [health, setHealth] = useState<{ checks: HealthCheck[]; total_issues: number }>({ checks: [], total_issues: 0 });
  const [risks, setRisks] = useState<any>({ open_risks: [], counts: {}, generated_risks: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openInboxCount = useMemo(() => inbox.filter((i) => i.status !== "completed").length, [inbox]);
  const criticalEventCount = useMemo(() => events.filter((e) => e.severity === "critical" || e.severity === "high").length, [events]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [inboxRes, eventRes, healthRes, riskRes] = await Promise.all([
        hrmsApi.get<ApiResponse<InboxItem[]>>("/api/control-tower/inbox"),
        hrmsApi.get<ApiResponse<EventItem[]>>("/api/control-tower/events?limit=50"),
        hrmsApi.get<ApiResponse<{ checks: HealthCheck[]; total_issues: number }>>("/api/control-tower/master-data-health"),
        hrmsApi.get<ApiResponse<any>>("/api/control-tower/risks"),
      ]);
      setInbox(inboxRes.data ?? []);
      setEvents(eventRes.data ?? []);
      setHealth(healthRes.data ?? { checks: [], total_issues: 0 });
      setRisks(riskRes.data ?? { open_risks: [], counts: {}, generated_risks: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const t = window.setInterval(loadAll, 60_000);
    return () => window.clearInterval(t);
  }, []);

  async function completeItem(id: string) {
    await hrmsApi.patch(`/api/control-tower/inbox/${id}/complete`, {});
    await loadAll();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-200">MAS Callnet PeopleOS</p>
            <h1 className="mt-2 text-3xl font-bold">Control Tower</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200">One action layer for pending work, operational events, master-data health, employee risk, roster alerts, and leadership escalations.</p>
          </div>
          <button onClick={loadAll} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-slate-100" disabled={loading}>{loading ? "Refreshing..." : "Refresh now"}</button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Open Inbox</p><p className="mt-2 text-3xl font-bold">{openInboxCount}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">High Events</p><p className="mt-2 text-3xl font-bold">{criticalEventCount}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Master Issues</p><p className="mt-2 text-3xl font-bold">{health.total_issues}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-500">Open Risks</p><p className="mt-2 text-3xl font-bold">{(risks.open_risks ?? []).length + (risks.generated_risks ?? []).length}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["inbox", "events", "health", "risks"] as TabKey[]).map((key) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}>{key.replace("-", " ").toUpperCase()}</button>
        ))}
      </div>

      {tab === "inbox" && (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Unified Work Inbox</h2>
          <div className="space-y-3">
            {inbox.length === 0 && <p className="text-sm text-slate-500">No pending inbox items.</p>}
            {inbox.map((item) => (
              <div key={item.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><Badge value={item.priority} /><span className="text-xs font-semibold text-slate-500">{item.module_key} · {item.task_type}</span></div>
                    <h3 className="mt-2 font-bold">{item.title}</h3>
                    {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                    {item.due_at && <p className="mt-2 text-xs text-slate-500">Due: {new Date(item.due_at).toLocaleString()}</p>}
                  </div>
                  <div className="flex gap-2">
                    {item.action_url && <a href={item.action_url} className="rounded-xl border px-3 py-2 text-sm font-semibold">Open</a>}
                    <button onClick={() => completeItem(item.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Complete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Real-time Event Feed</h2>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center gap-2"><Badge value={event.severity} /><span className="text-xs font-semibold text-slate-500">{event.module_key} · {event.event_type}</span></div>
                <h3 className="mt-2 font-bold">{event.title}</h3>
                {event.message && <p className="mt-1 text-sm text-slate-600">{event.message}</p>}
                <p className="mt-2 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "health" && (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Master Data Health</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {health.checks.map((check) => (
              <div key={check.code} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{check.label}</h3><Badge value={check.severity} /></div>
                <p className="mt-2 text-3xl font-bold">{check.count}</p>
                <p className="text-xs text-slate-500">{check.code}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "risks" && (
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Management Risk Engine</h2>
          <div className="space-y-3">
            {[...(risks.generated_risks ?? []), ...(risks.open_risks ?? [])].map((risk: any, idx: number) => (
              <div key={risk.id ?? idx} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center gap-2"><Badge value={risk.severity ?? "medium"} /><span className="text-xs font-semibold text-slate-500">{risk.module_key ?? risk.risk_type}</span></div>
                <h3 className="mt-2 font-bold">{risk.title}</h3>
                {risk.description && <p className="mt-1 text-sm text-slate-600">{risk.description}</p>}
                {risk.action_required && <p className="mt-2 text-sm font-semibold text-slate-700">Action: {risk.action_required}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
