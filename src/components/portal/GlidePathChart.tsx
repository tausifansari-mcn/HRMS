export function GlidePathChart({ path }: { path: any }) {
  const points = path.points as Array<{ month: string; actual: number | null; committed: number | null; target: number }>;
  if (!points || points.length === 0) return null;

  const allVals = points.flatMap(p => [p.actual, p.committed, p.target].filter(v => v != null) as number[]);
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const W = 480, H = 160, PAD = 40;
  const iW = W - PAD * 2, iH = H - PAD * 2;

  const x = (i: number) => PAD + (i / (points.length - 1)) * iW;
  const y = (v: number) => PAD + iH - ((v - minV) / range) * iH;

  const linePts = (getter: (p: typeof points[0]) => number | null) =>
    points.reduce<string[]>((acc, p, i) => {
      const v = getter(p);
      if (v != null) acc.push(`${x(i)},${y(v)}`);
      return acc;
    }, []).join(" ");

  const todayIdx = (() => {
    const today = new Date().toISOString().slice(0, 7);
    const i = points.findIndex(p => p.month >= today);
    return i === -1 ? points.length - 1 : i;
  })();

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{path.metric_name}</p>
          <p className="text-xs text-slate-500">{path.unit}</p>
        </div>
        {path.behind_commitment && (
          <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded">Tracking Behind Commitment</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        {/* Today marker */}
        <line x1={x(todayIdx)} y1={PAD} x2={x(todayIdx)} y2={H - PAD} stroke="#475569" strokeDasharray="4,4" strokeWidth="1" />
        {/* Target line */}
        <polyline points={linePts(p => p.target)} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4,4" />
        {/* Committed line */}
        <polyline points={linePts(p => p.committed)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="8,4" />
        {/* Actual line */}
        <polyline points={linePts(p => p.actual)} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {/* X-axis labels */}
        {points.map((p, i) => (
          <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b">
            {p.month.slice(5)}
          </text>
        ))}
      </svg>
      <div className="flex gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block" /> Actual</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-amber-500 inline-block border-dashed" /> Committed</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-500 inline-block" /> Target</span>
      </div>
    </div>
  );
}
