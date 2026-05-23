const RAG_BORDER = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500" };
const RAG_VALUE = { green: "text-green-400", amber: "text-amber-400", red: "text-red-400" };

function Sparkline({ points }: { points: Array<{ value: number }> }) {
  if (!points || points.length < 2) return <div className="h-8 w-20 bg-slate-800 rounded opacity-20" />;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 80, h = 32;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
    </svg>
  );
}

export function KpiScorecardGrid({ scorecards }: { scorecards: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {scorecards.map(m => (
        <div key={m.metric_id} className={`bg-slate-800 rounded-lg p-4 border-l-4 ${RAG_BORDER[m.rag as keyof typeof RAG_BORDER]}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">{m.metric_code}</p>
              <p className="text-sm text-slate-300 mt-0.5">{m.metric_name}</p>
            </div>
            <div className={`text-xs font-semibold px-2 py-0.5 rounded ${
              m.rag === "green" ? "bg-green-900 text-green-300" :
              m.rag === "amber" ? "bg-amber-900 text-amber-300" :
              "bg-red-900 text-red-300"}`}>
              {m.achievement_pct.toFixed(1)}%
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className={`text-2xl font-bold ${RAG_VALUE[m.rag as keyof typeof RAG_VALUE]}`}>
                {m.actual != null ? m.actual : "—"}{m.unit === "percent" ? "%" : m.unit === "seconds" ? "s" : ""}
              </p>
              <p className="text-xs text-slate-500">Target: {m.target}{m.unit === "percent" ? "%" : ""}</p>
            </div>
            <Sparkline points={m.sparkline} />
          </div>
        </div>
      ))}
    </div>
  );
}
