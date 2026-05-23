import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/lib/portalApi";
import { KpiScorecardGrid } from "@/components/portal/KpiScorecardGrid";
import { GlidePathChart } from "@/components/portal/GlidePathChart";
import { Loader2 } from "lucide-react";

const TABS = ["Performance", "Glide Paths", "Action Plans", "Governance", "Attrition", "Commentary"] as const;
type Tab = typeof TABS[number];

function currentPeriod() { return new Date().toISOString().slice(0, 7); }

export default function PortalProcessDashboard() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Performance");
  const period = currentPeriod();

  const kpis = useQuery({ queryKey: ["portal-kpis", id, period], queryFn: () => portalApi.getKpis(id!, period), enabled: tab === "Performance" });
  const glide = useQuery({ queryKey: ["portal-glide", id, period], queryFn: () => portalApi.getGlidePaths(id!, period), enabled: tab === "Glide Paths" });
  const actions = useQuery({ queryKey: ["portal-actions", id], queryFn: () => portalApi.getActionPlans(id!), enabled: tab === "Action Plans" });
  const governance = useQuery({ queryKey: ["portal-gov", id, period], queryFn: () => portalApi.getGovernance(id!, period), enabled: tab === "Governance" });
  const attrition = useQuery({ queryKey: ["portal-attrition", id, period], queryFn: () => portalApi.getAttrition(id!, period), enabled: tab === "Attrition" });
  const commentary = useQuery({ queryKey: ["portal-commentary", id, period], queryFn: () => portalApi.getCommentary(id!, period), enabled: tab === "Commentary" });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Tab bar */}
      <div className="border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
        <div className="max-w-6xl mx-auto px-8 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-4 text-sm whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        {tab === "Performance" && (
          kpis.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-blue-400" /> :
          <KpiScorecardGrid scorecards={kpis.data?.data ?? []} />
        )}
        {tab === "Glide Paths" && (
          glide.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-blue-400" /> :
          (glide.data?.data ?? []).length === 0
            ? <p className="text-slate-400">All metrics are on track — no glide paths to show.</p>
            : <div className="grid gap-6">{(glide.data?.data ?? []).map((p: any) => <GlidePathChart key={p.metric_id} path={p} />)}</div>
        )}
        {tab === "Action Plans" && <ActionPlansTab data={actions.data?.data ?? []} loading={actions.isLoading} />}
        {tab === "Governance" && <GovernanceTab data={governance.data?.data ?? []} loading={governance.isLoading} />}
        {tab === "Attrition" && <AttritionTab data={attrition.data?.data} loading={attrition.isLoading} />}
        {tab === "Commentary" && <CommentaryTab data={commentary.data?.data} loading={commentary.isLoading} processId={id!} period={period} />}
      </div>
    </div>
  );
}

function ActionPlansTab({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-blue-400" />;
  const byMetric = data.reduce((acc, item) => {
    const key = item.metric_code;
    if (!acc[key]) acc[key] = { name: item.metric_name, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: any[] }>);

  const STATUS_COLOR: Record<string, string> = { planned: "text-slate-400", in_progress: "text-blue-400", done: "text-green-400", delayed: "text-red-400" };
  const LEVEL_LABEL: Record<string, string> = { analyst: "Analyst", tl: "TL", process_manager: "PM", branch_head: "BH" };

  return (
    <div className="space-y-6">
      {Object.entries(byMetric).map(([code, { name, items }]: any) => (
        <div key={code} className="bg-slate-900 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
            <p className="text-sm font-semibold text-white">{name} <span className="text-slate-500 font-normal">({code})</span></p>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 text-xs">
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Status</th>
            </tr></thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-300">{item.action_text}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded mr-1">{LEVEL_LABEL[item.owner_level as keyof typeof LEVEL_LABEL]}</span>
                    <span className="text-slate-400">{item.owner_name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{item.due_date}</td>
                  <td className={`px-4 py-3 capitalize font-medium ${STATUS_COLOR[item.status]}`}>{item.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {data.length === 0 && <p className="text-slate-400">No action plans found.</p>}
    </div>
  );
}

function GovernanceTab({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-blue-400" />;
  const LEVELS = ["analyst", "tl", "process_manager", "branch_head"] as const;
  const LEVEL_LABEL: Record<string, string> = { analyst: "Analyst", tl: "Team Leader", process_manager: "Process Manager", branch_head: "Branch Head" };
  const byLevel = LEVELS.reduce((acc, l) => { acc[l] = data.filter((a: any) => a.level === l); return acc; }, {} as Record<string, any[]>);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {LEVELS.map(level => {
        const activities = byLevel[level];
        const overall = activities.length ? Math.round(activities.reduce((s: number, a: any) => s + a.completion_pct, 0) / activities.length) : 0;
        return (
          <div key={level} className="bg-slate-900 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <p className="text-sm font-semibold text-white">{LEVEL_LABEL[level]}</p>
              <span className={`text-xs font-semibold ${overall >= 100 ? "text-green-400" : overall >= 70 ? "text-amber-400" : "text-red-400"}`}>{overall}%</span>
            </div>
            <div className="divide-y divide-slate-800">
              {activities.map((a: any) => (
                <div key={a.activity_id} className="px-4 py-3">
                  <p className="text-xs text-slate-300 mb-1">{a.activity_name}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{a.completed_count}/{a.required_count}</span>
                    <span className={a.rag === "green" ? "text-green-400" : a.rag === "amber" ? "text-amber-400" : "text-red-400"}>{a.completion_pct}%</span>
                  </div>
                  <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${a.rag === "green" ? "bg-green-500" : a.rag === "amber" ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(a.completion_pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttritionTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-blue-400" />;
  if (!data) return <p className="text-slate-400">No attrition data available for this period.</p>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Attrition", value: `${data.attrition_pct}%`, sub: `${data.voluntary_count} voluntary / ${data.involuntary_count} involuntary` },
          { label: "Headcount", value: data.headcount, sub: `of ${data.sanctioned_strength} sanctioned` },
          { label: "Open Positions", value: data.open_positions },
          { label: "Avg Tenure", value: `${data.avg_tenure_months}m` },
        ].map(card => (
          <div key={card.label} className="bg-slate-900 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            {card.sub && <p className="text-xs text-slate-500 mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>
      {data.top_exit_reasons && data.top_exit_reasons.length > 0 && (
        <div className="bg-slate-900 rounded-lg p-4">
          <p className="text-sm font-semibold text-white mb-3">Top Exit Reasons</p>
          {data.top_exit_reasons.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <span className="text-xs text-slate-400 w-32 truncate">{r.reason}</span>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(r.count / data.top_exit_reasons[0].count) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-6 text-right">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentaryTab({ data, loading, processId, period }: { data: any; loading: boolean; processId: string; period: string }) {
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-blue-400" />;
  if (!data) return <p className="text-slate-400">No management commentary published for this period.</p>;

  async function handleAcknowledge() {
    setBusy(true);
    try { 
      await portalApi.acknowledgeCommentary(data.id); 
      window.location.reload(); 
    }
    catch (e: any) { 
      alert(e.message); 
    }
    finally { 
      setBusy(false); 
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { 
      await portalApi.replyCommentary(data.id, replyText); 
      setReplyText(""); 
      window.location.reload(); 
    }
    catch (e: any) { 
      alert(e.message); 
    }
    finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-slate-900 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-semibold text-white">{data.author_name}</p>
            <p className="text-xs text-slate-500">{data.author_designation} · {new Date(data.published_at).toLocaleDateString()}</p>
          </div>
          {data.acknowledged_at
            ? <span className="text-xs bg-green-900 text-green-300 px-3 py-1 rounded-full">Acknowledged</span>
            : <span className="text-xs bg-amber-900 text-amber-300 px-3 py-1 rounded-full">Awaiting Acknowledgement</span>
          }
        </div>
        <div className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{data.body}</div>
        {!data.acknowledged_at && (
          <button onClick={handleAcknowledge} disabled={busy}
            className="mt-4 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg disabled:opacity-50">
            {busy ? "Processing..." : "Acknowledge & Accept"}
          </button>
        )}
      </div>

      {data.replies && data.replies.length > 0 && (
        <div className="space-y-3">
          {data.replies.map((r: any) => (
            <div key={r.id} className="bg-slate-800 rounded-lg p-4 ml-8">
              <p className="text-xs text-slate-500 mb-2">Your team · {new Date(r.created_at).toLocaleDateString()}</p>
              <p className="text-sm text-slate-300">{r.reply_text}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleReply} className="space-y-3">
        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} maxLength={1000}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 resize-none"
          rows={3} placeholder="Add a comment (visible to operations team)…" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{replyText.length}/1000</span>
          <button type="submit" disabled={busy || !replyText.trim()}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
            {busy ? "Sending…" : "Send Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
