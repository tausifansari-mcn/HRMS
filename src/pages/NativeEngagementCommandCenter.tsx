import { useEffect, useMemo, useState } from "react";
import { Award, Heart, RefreshCcw, ShieldAlert, Sparkles, Trophy } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

type WatchRow = {
  employee_id: string;
  employee_name: string;
  employee_code?: string;
  branch_name?: string;
  process_name?: string;
  engagement_score: number;
  risk_label: string;
  snapshot_date: string;
};

type KudosFeed = {
  kudos_id: string;
  sender_name: string;
  receiver_name: string;
  kudos_title?: string;
  kudos_icon?: string;
  kudos_category?: string;
  custom_message?: string;
  points_awarded: number;
  reaction_count: number;
  sent_at: string;
};

type Data = {
  summary: Array<{ risk_label: string; count: number; avg_score: number }>;
  watchlist: WatchRow[];
  kudos_feed: KudosFeed[];
};

function Card({ title, value, note, icon }: { title: string; value: React.ReactNode; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">{icon}</div>
      </div>
    </div>
  );
}

function RiskPill({ label }: { label: string }) {
  const cls = label === "attrition_risk" ? "bg-red-50 text-red-700" : label === "watchlist" ? "bg-amber-50 text-amber-700" : label === "highly_engaged" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label.replace(/_/g, " ")}</span>;
}

export default function NativeEngagementCommandCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await hrmsApi.get<{ success: boolean; data: Data }>("/api/engagement-intelligence/command-center");
      setData(res.data);
    } catch (err: any) {
      setMessage(err?.message || "Unable to load engagement command center");
    } finally {
      setLoading(false);
    }
  };

  const scan = async () => {
    setLoading(true);
    try {
      await hrmsApi.post("/api/engagement-intelligence/scan", { limit: 500 });
      setMessage("Engagement health scan completed.");
      await load();
    } catch (err: any) {
      setMessage(err?.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const map = new Map((data?.summary ?? []).map((s) => [s.risk_label, s]));
    const total = (data?.summary ?? []).reduce((a, b) => a + Number(b.count ?? 0), 0);
    const avg = total ? (data?.summary ?? []).reduce((a, b) => a + Number(b.count ?? 0) * Number(b.avg_score ?? 0), 0) / total : 0;
    return { total, avg, highly: map.get("highly_engaged")?.count ?? 0, watch: map.get("watchlist")?.count ?? 0, risk: map.get("attrition_risk")?.count ?? 0 };
  }, [data]);

  return (
    <DashboardLayout>
      <main className="space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-600">People Experience</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Engagement Command Center</h1>
            <p className="mt-2 max-w-4xl text-slate-600">
              Track recognition, kudos momentum, engagement health, watchlist employees, and attrition-risk signals.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCcw className="h-4 w-4" /> Refresh</button>
            <button onClick={scan} disabled={loading} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Run health scan</button>
          </div>
        </div>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card title="Employees scanned" value={summary.total} note="Latest health snapshot" icon={<Sparkles className="h-5 w-5" />} />
          <Card title="Average score" value={`${Math.round(summary.avg)}%`} note="Engagement health" icon={<Trophy className="h-5 w-5" />} />
          <Card title="Highly engaged" value={summary.highly} note="Strong signals" icon={<Award className="h-5 w-5" />} />
          <Card title="Watchlist" value={summary.watch} note="Manager check-in" icon={<ShieldAlert className="h-5 w-5" />} />
          <Card title="Attrition risk" value={summary.risk} note="HR action required" icon={<Heart className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-black text-slate-950">Engagement watchlist</h2>
              <p className="text-sm text-slate-500">Lowest health score employees should be reviewed by manager/HR.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>{['Employee','Branch / Process','Score','Risk','Snapshot'].map((h) => <th key={h} className="p-4 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(data?.watchlist ?? []).map((r) => (
                    <tr key={r.employee_id} className="border-t hover:bg-slate-50/80">
                      <td className="p-4"><div className="font-black text-slate-950">{r.employee_name}</div><div className="font-mono text-xs text-slate-500">{r.employee_code ?? r.employee_id.slice(0, 8)}</div></td>
                      <td className="p-4 text-slate-600"><div>{r.branch_name ?? '—'}</div><div className="text-xs">{r.process_name ?? '—'}</div></td>
                      <td className="p-4"><div className="text-xl font-black">{Math.round(Number(r.engagement_score ?? 0))}%</div></td>
                      <td className="p-4"><RiskPill label={r.risk_label} /></td>
                      <td className="p-4 font-mono text-xs text-slate-500">{r.snapshot_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-950">Live Kudos Wall</h2>
            <p className="mb-4 text-sm text-slate-500">Latest appreciation moments across the organization.</p>
            <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
              {(data?.kudos_feed ?? []).map((k) => (
                <div key={k.kudos_id} className="rounded-2xl border bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{k.receiver_name}</p>
                      <p className="text-xs text-slate-500">from {k.sender_name} · {k.kudos_title ?? 'General appreciation'}</p>
                    </div>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">+{k.points_awarded}</span>
                  </div>
                  {k.custom_message && <p className="mt-3 text-sm text-slate-700">“{k.custom_message}”</p>}
                  <p className="mt-3 text-xs text-slate-400">{k.reaction_count} reactions · {k.sent_at?.slice(0, 10)}</p>
                </div>
              ))}
              {(data?.kudos_feed ?? []).length === 0 && <p className="text-sm text-slate-500">Kudos will appear here.</p>}
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
