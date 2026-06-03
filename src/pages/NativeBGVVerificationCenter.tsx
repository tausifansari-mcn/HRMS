import { useEffect, useState } from "react";
import { RefreshCcw, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type QueueRow = {
  candidate_id: string;
  candidate_code?: string;
  full_name: string;
  mobile?: string;
  email?: string;
  branch_name?: string;
  process_name?: string;
  issue_count: number;
  verified_count: number;
  last_check_at?: string;
};

type BgvStatus = {
  candidate_id: string;
  score: number;
  overall_status: string;
  employee_creation_ready: boolean;
  payroll_activation_ready: boolean;
  checks: any[];
  documents: any[];
};

type ApiResponse<T> = { success: boolean; data: T };

export default function NativeBGVVerificationCenter() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<BgvStatus | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await hrmsApi.get<ApiResponse<QueueRow[]>>("/api/ats/bgv/queue");
      setQueue(res.data || []);
    } catch (e: any) { setMessage(e.message || "Unable to load BGV queue"); }
    finally { setLoading(false); }
  };

  const loadCandidate = async (candidateId: string) => {
    setSelectedId(candidateId);
    const res = await hrmsApi.get<ApiResponse<BgvStatus>>(`/api/ats/bgv/candidates/${candidateId}`);
    setSelected(res.data);
  };

  const manualReview = async (status: "verified" | "mismatch" | "failed" | "manual_review", checkId?: string) => {
    if (!selectedId) return;
    await hrmsApi.post(`/api/ats/bgv/candidates/${selectedId}/manual-review`, { checkId, status, remarks: remarks || `Marked ${status}` });
    setMessage("Review updated.");
    await loadCandidate(selectedId);
    await loadQueue();
  };

  const waive = async (checkId?: string) => {
    if (!selectedId) return;
    if (!remarks.trim()) return setMessage("Reason is required for waiver.");
    await hrmsApi.post(`/api/ats/bgv/candidates/${selectedId}/waive`, { checkId, reason: remarks });
    setMessage("Exception/waiver approved.");
    await loadCandidate(selectedId);
    await loadQueue();
  };

  useEffect(() => { void loadQueue(); }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">ATS / BGV</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">BGV Verification Center</h1>
            <p className="mt-2 max-w-3xl text-slate-600">Track Aadhaar, PAN, bank, DigiLocker and document verification readiness before employee creation and payroll activation.</p>
          </div>
          <Button onClick={loadQueue} disabled={loading} className="gap-2"><RefreshCcw className="h-4 w-4" />Refresh</Button>
        </div>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader><CardTitle>Verification Queue</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {queue.length === 0 && <p className="text-sm text-slate-500">No candidates currently in BGV queue.</p>}
              {queue.map((row) => (
                <button key={row.candidate_id} onClick={() => loadCandidate(row.candidate_id)} className={`w-full rounded-2xl border p-4 text-left transition hover:bg-slate-50 ${selectedId === row.candidate_id ? "border-blue-400 bg-blue-50" : "bg-white"}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{row.full_name}</p><p className="text-xs text-slate-500">{row.candidate_code || row.candidate_id} · {row.branch_name || "No branch"} · {row.process_name || "No process"}</p></div>{Number(row.issue_count) > 0 ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <ShieldCheck className="h-5 w-5 text-emerald-500" />}</div>
                  <div className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Verified {row.verified_count || 0}</span><span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700">Issues {row.issue_count || 0}</span></div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Candidate Verification Scorecard</CardTitle></CardHeader>
            <CardContent>
              {!selected ? <p className="text-sm text-slate-500">Select a candidate from queue.</p> : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <Metric label="BGV score" value={`${selected.score}%`} />
                    <Metric label="Overall" value={selected.overall_status} />
                    <Metric label="Employee ready" value={selected.employee_creation_ready ? "Yes" : "No"} />
                    <Metric label="Payroll ready" value={selected.payroll_activation_ready ? "Yes" : "No"} />
                  </div>
                  <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reviewer remarks / waiver reason" rows={3} />
                  <div className="overflow-x-auto rounded-2xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50"><tr><th className="p-3 text-left">Check</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Match</th><th className="p-3 text-left">Summary</th><th className="p-3 text-left">Action</th></tr></thead>
                      <tbody>{selected.checks.map((c) => <tr key={c.id} className="border-t"><td className="p-3 capitalize">{c.check_type}</td><td className="p-3">{c.status}</td><td className="p-3">{c.match_score ?? "-"}</td><td className="p-3">{c.result_summary || "-"}</td><td className="p-3"><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => manualReview("verified", c.id)}><CheckCircle2 className="mr-1 h-3 w-3" />Clear</Button><Button size="sm" variant="outline" onClick={() => manualReview("manual_review", c.id)}>Review</Button><Button size="sm" variant="outline" onClick={() => waive(c.id)}>Waive</Button></div></td></tr>)}</tbody>
                    </table>
                  </div>
                  <div><h3 className="mb-2 font-black text-slate-900">Uploaded documents</h3><div className="grid gap-2 md:grid-cols-2">{selected.documents.map((d) => <div key={d.id} className="rounded-xl border bg-slate-50 p-3 text-sm"><b>{d.doc_type}</b><br />{d.doc_name}<br /><span className="text-xs text-slate-500">{d.document_status}</span></div>)}</div></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-black capitalize text-slate-950">{value}</p></div>;
}
