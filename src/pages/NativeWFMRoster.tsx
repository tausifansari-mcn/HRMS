import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export default function NativeWFMRoster() {
  const [form, setForm] = useState({ shift_code: "", shift_name: "", start_time: "09:00", end_time: "18:00", branch_name: "", process_name: "", team_name: "" });
  const [message, setMessage] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const { data: shifts = [], refetch } = useQuery({
    queryKey: ["native-wfm-shifts", showInactive],
    queryFn: async () => {
      let query = db.from("wfm_shift_master").select("*").order("created_at", { ascending: false });
      if (!showInactive) query = query.eq("active_status", true).is("deleted_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeShifts = useMemo(() => shifts.filter((s: any) => s.active_status !== false && !s.deleted_at), [shifts]);
  const inactiveShifts = useMemo(() => shifts.filter((s: any) => s.active_status === false || s.deleted_at), [shifts]);

  const save = async () => {
    setMessage("");
    if (!form.shift_code.trim() || !form.shift_name.trim()) {
      setMessage("Shift code and name are required.");
      return;
    }
    const { error } = await db.from("wfm_shift_master").insert({ ...form, active_status: true });
    if (error) setMessage(error.message);
    else {
      setMessage("Shift saved.");
      setForm({ shift_code: "", shift_name: "", start_time: "09:00", end_time: "18:00", branch_name: "", process_name: "", team_name: "" });
      refetch();
    }
  };

  const deactivate = async (shift: any) => {
    const reason = window.prompt(`Deactivate shift ${shift.shift_code}? Enter reason:`, "No longer required");
    if (reason === null) return;
    const { error } = await db.from("wfm_shift_master").update({ active_status: false, deleted_at: new Date().toISOString(), deletion_reason: reason || "Deactivated from Shift Master" }).eq("id", shift.id);
    if (error) setMessage(error.message);
    else { setMessage("Shift deactivated. Existing historical roster remains safe."); refetch(); }
  };

  const restore = async (shift: any) => {
    const { error } = await db.from("wfm_shift_master").update({ active_status: true, deleted_at: null, deletion_reason: null }).eq("id", shift.id);
    if (error) setMessage(error.message);
    else { setMessage("Shift restored."); refetch(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">Native WFM</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Roster Planning & Shift Master</h1>
            <p className="mt-2 max-w-4xl text-slate-600">Create branch/process/team mapped shifts. Delete action is soft-deactivate to protect historical attendance.</p>
          </div>
          <label className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive shifts
          </label>
        </div>

        {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>}

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Create Shift</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <input value={form.shift_code} onChange={(e) => setForm({ ...form, shift_code: e.target.value })} placeholder="Shift code" className="rounded-xl border px-4 py-3" />
            <input value={form.shift_name} onChange={(e) => setForm({ ...form, shift_name: e.target.value })} placeholder="Shift name" className="rounded-xl border px-4 py-3" />
            <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="rounded-xl border px-4 py-3" />
            <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="rounded-xl border px-4 py-3" />
            <input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} placeholder="Branch" className="rounded-xl border px-4 py-3" />
            <input value={form.process_name} onChange={(e) => setForm({ ...form, process_name: e.target.value })} placeholder="Process" className="rounded-xl border px-4 py-3" />
            <input value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} placeholder="Team" className="rounded-xl border px-4 py-3" />
            <button onClick={save} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Save Shift</button>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Active Shift Master</h2>
          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Shift</th><th className="p-3">Timing</th><th className="p-3">Branch</th><th className="p-3">Process</th><th className="p-3">Team</th><th className="p-3">Action</th></tr></thead>
              <tbody>{activeShifts.map((s: any) => <tr key={s.id} className="border-t"><td className="p-3"><b>{s.shift_code}</b><p className="text-xs text-slate-500">{s.shift_name}</p></td><td className="p-3">{s.start_time} - {s.end_time}</td><td className="p-3">{s.branch_name || "All"}</td><td className="p-3">{s.process_name || "All"}</td><td className="p-3">{s.team_name || "All"}</td><td className="p-3"><button onClick={() => deactivate(s)} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">Deactivate</button></td></tr>)}</tbody>
            </table>
          </div>
        </div>

        {showInactive && <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Inactive / Deactivated Shifts</h2>
          <div className="mt-4 space-y-2">{inactiveShifts.map((s: any) => <div key={s.id} className="rounded-2xl border p-3"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><b>{s.shift_code} — {s.shift_name}</b><p className="text-xs text-slate-500">Reason: {s.deletion_reason || "-"}</p></div><button onClick={() => restore(s)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Restore</button></div></div>)}</div>
        </div>}
      </div>
    </DashboardLayout>
  );
}
