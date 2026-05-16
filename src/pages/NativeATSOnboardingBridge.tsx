import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type Row = {
  id: string;
  candidate_code: string;
  full_name: string;
  mobile: string;
  email: string;
  branch_name: string;
  role_applied: string;
  status: string;
  created_at: string;
};

export default function NativeATSOnboardingBridge() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await db
        .from("ats_candidate")
        .select("id,candidate_code,full_name,mobile,email,branch_name,role_applied,status,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      setMessage(err.message || "Unable to load candidates");
    } finally {
      setLoading(false);
    }
  };

  const convert = async (id: string) => {
    setConverting(id);
    setMessage("");
    try {
      const { data, error } = await db.rpc("native_ats_convert_selected_candidate_to_employee", {
        p_candidate_id: id,
        p_employee_code: null,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || "Conversion failed");
      setMessage(`${data.message} Employee Code: ${data.employeeCode || "-"}`);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Unable to convert candidate");
    } finally {
      setConverting("");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Native ATS</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">ATS Candidate Journey + HRMS Onboarding Bridge</h1>
            <p className="mt-2 text-slate-600">Convert selected ATS candidates into HRMS onboarding employee records. Candidate journey remains linked through lifecycle logs.</p>
          </div>
          <button onClick={load} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Refresh</button>
        </div>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>}

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-bold text-slate-950">Candidates</h2>
            <p className="text-sm text-slate-500">Only candidates with recruiter decision Selected can be moved to onboarding. Other candidates remain tracked here.</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Branch / Role</th>
                    <th className="p-4">Current Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const canConvert = r.status === "Selected" || r.status === "Selected - Pending Onboarding";
                    const converted = r.status === "Selected - Onboarding";
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{r.full_name || "-"}</div>
                          <div className="text-xs text-slate-500">{r.candidate_code || "-"}</div>
                        </td>
                        <td className="p-4 text-slate-600">
                          <div>{r.mobile || "-"}</div>
                          <div className="text-xs">{r.email || "-"}</div>
                        </td>
                        <td className="p-4 text-slate-600">
                          <div>{r.branch_name || "-"}</div>
                          <div className="text-xs">{r.role_applied || "-"}</div>
                        </td>
                        <td className="p-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{r.status || "Waiting"}</span>
                        </td>
                        <td className="p-4">
                          <button
                            disabled={!canConvert || converted || converting === r.id}
                            onClick={() => convert(r.id)}
                            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                          >
                            {converting === r.id ? "Converting..." : converted ? "Onboarding Created" : "Move to HRMS Onboarding"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
