import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Baby,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileBarChart2,
  Loader,
  Lock,
  Plus,
  RefreshCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type BonusRecord = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  financial_year: string;
  monthly_salary: number;
  annual_salary: number;
  eligible: number;
  min_bonus: number;
  max_bonus: number;
  calculated_bonus: number;
  status: "calculated" | "approved" | "paid";
};

type PoshComplaint = {
  id: string;
  complaint_ref: string;
  complainant_anon_id: string;
  respondent_anon_id: string | null;
  branch_id: string | null;
  branch_name?: string;
  date_of_complaint: string;
  nature_of_complaint: string | null;
  icc_members: string[] | null;
  status: "received" | "under_inquiry" | "settled" | "closed" | "referred_to_police";
  outcome: "substantiated" | "not_substantiated" | "malicious_complaint" | "conciliation" | null;
  closure_date: string | null;
  annual_report_year: number | null;
};

type PoshAnnualReport = {
  year: number;
  complaints_received: number;
  complaints_settled: number;
  complaints_pending: number;
  complaints_malicious: number;
};

type MaternityRecord = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  leave_start_date: string;
  leave_end_date: string | null;
  paid_weeks: number;
  complications: number;
  status: "applied" | "approved" | "active" | "completed" | "rejected";
};

type Tab = "bonus" | "posh" | "maternity" | "summary";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FY_OPTIONS = ["2024-2025", "2025-2026", "2026-2027"];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${color}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

const BONUS_STATUS_COLOR: Record<string, string> = {
  calculated: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  paid: "bg-blue-50 text-blue-700",
};

const POSH_STATUS_COLOR: Record<string, string> = {
  received: "bg-blue-50 text-blue-700",
  under_inquiry: "bg-amber-50 text-amber-700",
  settled: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
  referred_to_police: "bg-red-50 text-red-700",
};

const POSH_OUTCOME_COLOR: Record<string, string> = {
  substantiated: "bg-red-50 text-red-700",
  not_substantiated: "bg-slate-100 text-slate-600",
  malicious_complaint: "bg-orange-50 text-orange-700",
  conciliation: "bg-emerald-50 text-emerald-700",
};

const MATERNITY_STATUS_COLOR: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  active: "bg-violet-50 text-violet-700",
  completed: "bg-slate-100 text-slate-600",
  rejected: "bg-red-50 text-red-700",
};

function StatCard({ title, value, icon, tone }: { title: string; value: number | string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="glass-card stat-card rounded-3xl p-5">
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

// ─── Tab Components ───────────────────────────────────────────────────────────

// ── Bonus Tab ──

function BonusTab() {
  const [fy, setFy] = useState(FY_OPTIONS[1]);
  const [records, setRecords] = useState<BonusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await hrmsApi.get<{ success: boolean; data: BonusRecord[] }>(
        `/api/compliance/bonus?financial_year=${encodeURIComponent(fy)}`
      );
      setRecords(res.data ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to load bonus records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [fy]);

  const calculate = async () => {
    setCalculating(true);
    setMessage("");
    try {
      const res = await hrmsApi.post<{ success: boolean; message: string }>(
        "/api/compliance/bonus/calculate",
        { financial_year: fy }
      );
      setMessage(res.message ?? "Bonus calculated successfully");
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Calculation failed");
    } finally {
      setCalculating(false);
    }
  };

  const approve = async (id: string) => {
    setApprovingId(id);
    try {
      await hrmsApi.patch(`/api/compliance/bonus/${id}/approve`, {});
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="h-11 appearance-none rounded-2xl border bg-white pl-4 pr-10 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-400 cursor-pointer"
          >
            {FY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
        <button
          onClick={calculate}
          disabled={calculating}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          {calculating ? <Loader className="h-4 w-4 animate-spin" /> : <FileBarChart2 className="h-4 w-4" />}
          Calculate Bonus
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h3 className="font-black text-slate-950">Bonus Calculations — FY {fy}</h3>
          <p className="text-sm text-slate-500">{records.length} records</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileBarChart2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="font-semibold">No bonus records. Click "Calculate Bonus" to generate.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Employee", "Monthly Salary", "Eligible", "Min Bonus", "Max Bonus", "Calculated Bonus", "Status", "Action"].map((h) => (
                    <th key={h} className="p-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-950">{r.employee_name ?? r.employee_id}</div>
                      <div className="text-xs font-mono text-slate-400">{r.employee_code}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-700">{fmt(r.monthly_salary)}</td>
                    <td className="p-4">
                      {r.eligible ? (
                        <Badge label="Eligible" color="bg-emerald-50 text-emerald-700" />
                      ) : (
                        <Badge label="Not Eligible" color="bg-red-50 text-red-700" />
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-600">{fmt(r.min_bonus)}</td>
                    <td className="p-4 font-mono text-slate-600">{fmt(r.max_bonus)}</td>
                    <td className="p-4 font-mono font-bold text-slate-950">{fmt(r.calculated_bonus)}</td>
                    <td className="p-4">
                      <Badge label={r.status} color={BONUS_STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"} />
                    </td>
                    <td className="p-4">
                      {r.status === "calculated" && (
                        <button
                          onClick={() => approve(r.id)}
                          disabled={approvingId === r.id}
                          className="cursor-pointer rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {approvingId === r.id ? "..." : "Approve"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── POSH Tab ──

function PoshTab({ isPrivileged }: { isPrivileged: boolean }) {
  const [complaints, setComplaints] = useState<PoshComplaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [report, setReport] = useState<PoshAnnualReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [form, setForm] = useState({
    complainant_anon_id: "",
    respondent_anon_id: "",
    branch_id: "",
    date_of_complaint: "",
    nature_of_complaint: "",
    icc_members: "",
  });

  const [updateForm, setUpdateForm] = useState<{
    id: string;
    status: string;
    outcome: string;
    closure_date: string;
  }>({ id: "", status: "", outcome: "", closure_date: "" });
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await hrmsApi.get<{ success: boolean; data: PoshComplaint[] }>("/api/compliance/posh/complaints");
      setComplaints(res.data ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to load complaints");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isPrivileged) void load(); }, [isPrivileged]);

  const submitComplaint = async () => {
    if (!form.complainant_anon_id.trim()) return setMessage("Complainant anonymised ID is required");
    if (!form.date_of_complaint) return setMessage("Date of complaint is required");
    try {
      await hrmsApi.post("/api/compliance/posh/complaints", {
        complainant_anon_id: form.complainant_anon_id.trim(),
        respondent_anon_id: form.respondent_anon_id.trim() || undefined,
        branch_id: form.branch_id.trim() || undefined,
        date_of_complaint: form.date_of_complaint,
        nature_of_complaint: form.nature_of_complaint.trim() || undefined,
        icc_members: form.icc_members.trim()
          ? form.icc_members.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      setShowModal(false);
      setForm({ complainant_anon_id: "", respondent_anon_id: "", branch_id: "", date_of_complaint: "", nature_of_complaint: "", icc_members: "" });
      setMessage("Complaint logged successfully");
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to log complaint");
    }
  };

  const submitUpdate = async () => {
    if (!updateForm.id) return;
    setUpdatingId(updateForm.id);
    try {
      await hrmsApi.patch(`/api/compliance/posh/complaints/${updateForm.id}`, {
        status: updateForm.status || undefined,
        outcome: updateForm.outcome || undefined,
        closure_date: updateForm.closure_date || undefined,
      });
      setShowUpdateModal(false);
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const res = await hrmsApi.get<{ success: boolean; data: PoshAnnualReport }>(
        `/api/compliance/posh/annual-report/${reportYear}`
      );
      setReport(res.data);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setReportLoading(false);
    }
  };

  if (!isPrivileged) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-red-50 py-16 text-center">
        <Lock className="mb-4 h-10 w-10 text-red-300" />
        <p className="font-black text-red-700">Access Denied</p>
        <p className="mt-1 text-sm text-red-500">POSH complaint data is restricted to Admin and HR roles only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Log Complaint
        </button>
        {/* Annual Report */}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="number"
            value={reportYear}
            onChange={(e) => setReportYear(parseInt(e.target.value, 10))}
            className="h-11 w-28 rounded-2xl border px-3 text-sm outline-none focus:border-blue-400"
            min={2000}
            max={2100}
          />
          <button
            onClick={loadReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {reportLoading ? <Loader className="h-4 w-4 animate-spin" /> : <FileBarChart2 className="h-4 w-4" />}
            Annual Report
          </button>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {/* Annual Report Card */}
      {report && (
        <div className="rounded-3xl border bg-violet-50 p-5">
          <p className="mb-3 font-black text-violet-900">POSH Annual Report — {report.year}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Received", value: report.complaints_received, tone: "text-slate-950" },
              { label: "Settled / Closed", value: report.complaints_settled, tone: "text-emerald-700" },
              { label: "Pending", value: report.complaints_pending, tone: "text-amber-700" },
              { label: "Malicious", value: report.complaints_malicious, tone: "text-red-700" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                <p className={`mt-1 text-2xl font-black ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h3 className="font-black text-slate-950">Complaint Register</h3>
          <p className="text-sm text-slate-500">{complaints.length} complaints</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="font-semibold">No complaints on record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Ref", "Date", "Branch", "Status", "Outcome", "Closure Date", "Actions"].map((h) => (
                    <th key={h} className="p-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-950">{c.complaint_ref}</td>
                    <td className="p-4 font-mono text-slate-600">{c.date_of_complaint?.slice(0, 10)}</td>
                    <td className="p-4 text-slate-500">{c.branch_name ?? c.branch_id ?? "–"}</td>
                    <td className="p-4">
                      <Badge label={c.status} color={POSH_STATUS_COLOR[c.status] ?? "bg-slate-100 text-slate-600"} />
                    </td>
                    <td className="p-4">
                      {c.outcome ? (
                        <Badge label={c.outcome} color={POSH_OUTCOME_COLOR[c.outcome] ?? "bg-slate-100 text-slate-600"} />
                      ) : "–"}
                    </td>
                    <td className="p-4 font-mono text-slate-500">{c.closure_date ?? "–"}</td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setUpdateForm({ id: c.id, status: c.status, outcome: c.outcome ?? "", closure_date: c.closure_date ?? "" });
                          setShowUpdateModal(true);
                        }}
                        disabled={updatingId === c.id}
                        className="cursor-pointer rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Complaint Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-black text-slate-950">Log POSH Complaint</h2>
              <button onClick={() => setShowModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Complainant Anonymised ID <span className="text-red-500">*</span></label>
                <input
                  value={form.complainant_anon_id}
                  onChange={(e) => setForm({ ...form, complainant_anon_id: e.target.value })}
                  placeholder="e.g. ANON-001"
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Respondent Anonymised ID</label>
                <input
                  value={form.respondent_anon_id}
                  onChange={(e) => setForm({ ...form, respondent_anon_id: e.target.value })}
                  placeholder="e.g. ANON-002 (optional)"
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Branch ID</label>
                  <input
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    placeholder="Branch UUID (optional)"
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Complaint <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.date_of_complaint}
                    onChange={(e) => setForm({ ...form, date_of_complaint: e.target.value })}
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nature of Complaint</label>
                <textarea
                  value={form.nature_of_complaint}
                  onChange={(e) => setForm({ ...form, nature_of_complaint: e.target.value })}
                  placeholder="Brief description (anonymised)"
                  rows={3}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">ICC Members (comma-separated User IDs)</label>
                <input
                  value={form.icc_members}
                  onChange={(e) => setForm({ ...form, icc_members: e.target.value })}
                  placeholder="uuid1, uuid2, uuid3"
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t p-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 cursor-pointer rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitComplaint}
                className="flex-1 cursor-pointer rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Log Complaint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-black text-slate-950">Update Complaint Status</h2>
              <button onClick={() => setShowUpdateModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 cursor-pointer"
                >
                  {["received", "under_inquiry", "settled", "closed", "referred_to_police"].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Outcome</label>
                <select
                  value={updateForm.outcome}
                  onChange={(e) => setUpdateForm({ ...updateForm, outcome: e.target.value })}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 cursor-pointer"
                >
                  <option value="">— None —</option>
                  {["substantiated", "not_substantiated", "malicious_complaint", "conciliation"].map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Closure Date</label>
                <input
                  type="date"
                  value={updateForm.closure_date}
                  onChange={(e) => setUpdateForm({ ...updateForm, closure_date: e.target.value })}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t p-6">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 cursor-pointer rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitUpdate}
                className="flex-1 cursor-pointer rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Maternity Tab ──

function MaternityTab() {
  const [records, setRecords] = useState<MaternityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    employee_id: "",
    expected_delivery_date: "",
    leave_start_date: "",
    paid_weeks: "26",
    complications: false,
  });

  const [updateForm, setUpdateForm] = useState<{
    id: string;
    status: string;
    actual_delivery_date: string;
    leave_end_date: string;
  }>({ id: "", status: "", actual_delivery_date: "", leave_end_date: "" });
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await hrmsApi.get<{ success: boolean; data: MaternityRecord[] }>("/api/compliance/maternity");
      setRecords(res.data ?? []);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to load maternity records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    if (!form.employee_id.trim()) return setMessage("Employee ID is required");
    if (!form.leave_start_date) return setMessage("Leave start date is required");
    try {
      const paid_weeks = parseInt(form.paid_weeks, 10);
      const finalPaidWeeks = form.complications ? paid_weeks + 4 : paid_weeks;
      await hrmsApi.post("/api/compliance/maternity", {
        employee_id: form.employee_id.trim(),
        expected_delivery_date: form.expected_delivery_date || undefined,
        leave_start_date: form.leave_start_date,
        paid_weeks: finalPaidWeeks,
        complications: form.complications,
      });
      setShowModal(false);
      setForm({ employee_id: "", expected_delivery_date: "", leave_start_date: "", paid_weeks: "26", complications: false });
      setMessage("Maternity record added");
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const submitUpdate = async () => {
    if (!updateForm.id) return;
    setUpdatingId(updateForm.id);
    try {
      await hrmsApi.patch(`/api/compliance/maternity/${updateForm.id}`, {
        status: updateForm.status || undefined,
        actual_delivery_date: updateForm.actual_delivery_date || undefined,
        leave_end_date: updateForm.leave_end_date || undefined,
      });
      setShowUpdateModal(false);
      await load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Record
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h3 className="font-black text-slate-950">Maternity Benefit Records</h3>
          <p className="text-sm text-slate-500">{records.length} records</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Baby className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="font-semibold">No maternity records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Employee", "Exp. Delivery", "Leave Start", "Leave End", "Paid Weeks", "Complications", "Status", "Action"].map((h) => (
                    <th key={h} className="p-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-950">{r.employee_name ?? r.employee_id}</div>
                      <div className="text-xs font-mono text-slate-400">{r.employee_code}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-600">{r.expected_delivery_date?.slice(0, 10) ?? "–"}</td>
                    <td className="p-4 font-mono text-slate-600">{r.leave_start_date?.slice(0, 10)}</td>
                    <td className="p-4 font-mono text-slate-600">{r.leave_end_date?.slice(0, 10) ?? "–"}</td>
                    <td className="p-4 font-bold text-slate-950">{r.paid_weeks}w</td>
                    <td className="p-4">
                      {r.complications ? (
                        <Badge label="+4 weeks" color="bg-amber-50 text-amber-700" />
                      ) : "–"}
                    </td>
                    <td className="p-4">
                      <Badge label={r.status} color={MATERNITY_STATUS_COLOR[r.status] ?? "bg-slate-100 text-slate-600"} />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setUpdateForm({ id: r.id, status: r.status, actual_delivery_date: r.actual_delivery_date ?? "", leave_end_date: r.leave_end_date ?? "" });
                          setShowUpdateModal(true);
                        }}
                        disabled={updatingId === r.id}
                        className="cursor-pointer rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-black text-slate-950">Add Maternity Record</h2>
              <button onClick={() => setShowModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Employee ID <span className="text-red-500">*</span></label>
                <input
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  placeholder="Employee UUID"
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expected Delivery</label>
                  <input
                    type="date"
                    value={form.expected_delivery_date}
                    onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Leave Start <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.leave_start_date}
                    onChange={(e) => setForm({ ...form, leave_start_date: e.target.value })}
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Paid Weeks (default 26)</label>
                <input
                  type="number"
                  value={form.paid_weeks}
                  onChange={(e) => setForm({ ...form, paid_weeks: e.target.value })}
                  min={1}
                  max={52}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.complications}
                  onChange={(e) => setForm({ ...form, complications: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-950"
                />
                <span className="text-sm font-semibold text-slate-700">Complications (adds 4 additional weeks)</span>
              </label>
            </div>
            <div className="flex gap-3 border-t p-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 cursor-pointer rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="flex-1 cursor-pointer rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-lg font-black text-slate-950">Update Maternity Record</h2>
              <button onClick={() => setShowUpdateModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 cursor-pointer"
                >
                  {["applied", "approved", "active", "completed", "rejected"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Actual Delivery Date</label>
                <input
                  type="date"
                  value={updateForm.actual_delivery_date}
                  onChange={(e) => setUpdateForm({ ...updateForm, actual_delivery_date: e.target.value })}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Leave End Date</label>
                <input
                  type="date"
                  value={updateForm.leave_end_date}
                  onChange={(e) => setUpdateForm({ ...updateForm, leave_end_date: e.target.value })}
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 border-t p-6">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 cursor-pointer rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitUpdate}
                className="flex-1 cursor-pointer rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary Tab ──

type SummaryStats = {
  employees_with_uan: number;
  posh_complaints_this_year: number;
  active_maternity_leaves: number;
  bonus_eligible_employees: number;
};

function SummaryTab() {
  const [stats, setStats] = useState<SummaryStats>({
    employees_with_uan: 0,
    posh_complaints_this_year: 0,
    active_maternity_leaves: 0,
    bonus_eligible_employees: 0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const currentFY = (() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  })();

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [bonusRes, maternityRes, poshRes] = await Promise.all([
        hrmsApi.get<{ success: boolean; data: BonusRecord[] }>(
          `/api/compliance/bonus?financial_year=${encodeURIComponent(currentFY)}`
        ),
        hrmsApi.get<{ success: boolean; data: MaternityRecord[] }>("/api/compliance/maternity"),
        hrmsApi.get<{ success: boolean; data: PoshAnnualReport }>(
          `/api/compliance/posh/annual-report/${new Date().getFullYear()}`
        ).catch(() => ({ data: { complaints_received: 0 } as PoshAnnualReport })),
      ]);

      const eligible = (bonusRes.data ?? []).filter((b) => b.eligible).length;
      const activeMat = (maternityRes.data ?? []).filter((m) => m.status === "active").length;

      setStats({
        employees_with_uan: 0, // Placeholder — UAN data not yet in scope
        posh_complaints_this_year: (poshRes as { data: PoshAnnualReport }).data?.complaints_received ?? 0,
        active_maternity_leaves: activeMat,
        bonus_eligible_employees: eligible,
      });
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const CHECKLIST: { label: string; hint?: string }[] = [
    { label: "EPFO Registration", hint: "Employer registered with Employee Provident Fund Organisation" },
    { label: "ESIC Registration", hint: "Employer registered with Employee State Insurance Corporation" },
    { label: "POSH ICC Constituted", hint: "Internal Complaints Committee formed under POSH Act 2013" },
    { label: "Annual POSH Report Filed", hint: "Annual report submitted to District Officer" },
    { label: `Bonus Calculated — FY ${currentFY}`, hint: "Bonus Act 1965 — calculated for all eligible employees" },
  ];

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Employees with UAN"
              value={stats.employees_with_uan}
              icon={<BadgeCheck className="h-5 w-5" />}
              tone="bg-blue-50 text-blue-700"
            />
            <StatCard
              title="POSH Complaints (YTD)"
              value={stats.posh_complaints_this_year}
              icon={<ShieldAlert className="h-5 w-5" />}
              tone="bg-violet-50 text-violet-700"
            />
            <StatCard
              title="Active Maternity Leaves"
              value={stats.active_maternity_leaves}
              icon={<Baby className="h-5 w-5" />}
              tone="bg-pink-50 text-pink-700"
            />
            <StatCard
              title={`Bonus Eligible — ${currentFY}`}
              value={stats.bonus_eligible_employees}
              icon={<FileBarChart2 className="h-5 w-5" />}
              tone="bg-emerald-50 text-emerald-700"
            />
          </div>

          {/* Checklist */}
          <div className="rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h3 className="font-black text-slate-950">Compliance Checklist</h3>
              <p className="text-sm text-slate-500">Self-declaration — mark items as completed</p>
            </div>
            <div className="divide-y">
              {CHECKLIST.map((item) => (
                <ChecklistItem key={item.label} label={item.label} hint={item.hint} />
              ))}
            </div>
            <div className="rounded-b-3xl bg-amber-50 border-t p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700 font-semibold">
                  This is a self-declaration checklist. Consult a qualified compliance officer before making any legal filings.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChecklistItem({ label, hint }: { label: string; hint?: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex cursor-pointer items-start gap-4 p-4 hover:bg-slate-50 transition-colors">
      <div className="mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-slate-950"
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${checked ? "text-emerald-700 line-through" : "text-slate-800"}`}>{label}</span>
          {checked && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </div>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </label>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "bonus", label: "Bonus", icon: <FileBarChart2 className="h-4 w-4" /> },
  { key: "posh", label: "POSH", icon: <ShieldAlert className="h-4 w-4" /> },
  { key: "maternity", label: "Maternity", icon: <Baby className="h-4 w-4" /> },
  { key: "summary", label: "Compliance Summary", icon: <ClipboardList className="h-4 w-4" /> },
];

export default function NativeLabourCompliance() {
  const [activeTab, setActiveTab] = useState<Tab>("bonus");

  // In a real app this would come from auth context; using a simple heuristic
  // The POSH tab itself enforces access denied for non-privileged users,
  // but this flag allows the backend to be called only when needed.
  const isPrivileged = true; // relies on backend role enforcement via requireRole

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">Compliance</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Labour Law Compliance</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Bonus Act 1965, POSH Act 2013, and Maternity Benefit Act 1961 — calculations, registers, and compliance summary.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 rounded-3xl border bg-white p-2 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                activeTab === t.key
                  ? "bg-slate-950 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "bonus" && <BonusTab />}
        {activeTab === "posh" && <PoshTab isPrivileged={isPrivileged} />}
        {activeTab === "maternity" && <MaternityTab />}
        {activeTab === "summary" && <SummaryTab />}
      </div>
    </DashboardLayout>
  );
}
