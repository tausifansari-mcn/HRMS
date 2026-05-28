import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

interface Shift {
  id: string;
  shift_code: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  branch_name: string | null;
  process_name: string | null;
  active_status: number;
  created_at: string;
}

export default function NativeWFMRoster() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    shiftCode: "",
    shiftName: "",
    startTime: "09:00",
    endTime: "18:00",
    branchName: "",
    processName: "",
  });
  const [message, setMessage] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["wfm-shifts", showInactive],
    queryFn: async () => {
      const status = showInactive ? "all" : "active";
      const res = await hrmsApi.get<{ success: boolean; data: Shift[] }>(
        `/api/wfm/shifts?activeStatus=${status}`
      );
      return res.data ?? [];
    },
  });

  const activeShifts = useMemo(() => shifts.filter((s) => s.active_status !== 0), [shifts]);
  const inactiveShifts = useMemo(() => shifts.filter((s) => s.active_status === 0), [shifts]);

  const save = async () => {
    setMessage("");
    if (!form.shiftCode.trim() || !form.shiftName.trim()) {
      setMessage("Shift code and name are required.");
      return;
    }
    try {
      await hrmsApi.post("/api/wfm/shifts", {
        shiftCode: form.shiftCode.trim(),
        shiftName: form.shiftName.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        branchName: form.branchName.trim() || null,
        processName: form.processName.trim() || null,
      });
      setMessage("Shift saved.");
      setForm({ shiftCode: "", shiftName: "", startTime: "09:00", endTime: "18:00", branchName: "", processName: "" });
      qc.invalidateQueries({ queryKey: ["wfm-shifts"] });
    } catch (err: any) {
      setMessage(err.message || "Failed to save shift.");
    }
  };

  const deactivate = async (shift: Shift) => {
    const reason = window.prompt(`Deactivate shift ${shift.shift_code}? Enter reason:`, "No longer required");
    if (reason === null) return;
    try {
      await hrmsApi.put(`/api/wfm/shifts/${shift.id}`, { activeStatus: false });
      setMessage("Shift deactivated. Existing historical roster remains safe.");
      qc.invalidateQueries({ queryKey: ["wfm-shifts"] });
    } catch (err: any) {
      setMessage(err.message || "Failed to deactivate shift.");
    }
  };

  const restore = async (shift: Shift) => {
    try {
      await hrmsApi.put(`/api/wfm/shifts/${shift.id}`, { activeStatus: true });
      setMessage("Shift restored.");
      qc.invalidateQueries({ queryKey: ["wfm-shifts"] });
    } catch (err: any) {
      setMessage(err.message || "Failed to restore shift.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">Native WFM</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Roster Planning & Shift Master</h1>
            <p className="mt-2 max-w-4xl text-slate-600">Create branch/process mapped shifts. Deactivate is soft-delete to protect historical attendance.</p>
          </div>
          <label className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive shifts
          </label>
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
            {message}
          </div>
        )}

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Create Shift</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <input
              value={form.shiftCode}
              onChange={(e) => setForm({ ...form, shiftCode: e.target.value })}
              placeholder="Shift code"
              className="rounded-xl border px-4 py-3"
            />
            <input
              value={form.shiftName}
              onChange={(e) => setForm({ ...form, shiftName: e.target.value })}
              placeholder="Shift name"
              className="rounded-xl border px-4 py-3"
            />
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="rounded-xl border px-4 py-3"
            />
            <input
              value={form.branchName}
              onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              placeholder="Branch (optional)"
              className="rounded-xl border px-4 py-3"
            />
            <input
              value={form.processName}
              onChange={(e) => setForm({ ...form, processName: e.target.value })}
              placeholder="Process (optional)"
              className="rounded-xl border px-4 py-3"
            />
          </div>
          <button
            onClick={save}
            className="mt-3 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white cursor-pointer hover:bg-slate-800 transition-colors"
          >
            Save Shift
          </button>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Active Shift Master</h2>
          {activeShifts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No active shifts yet.</p>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Shift</th>
                    <th className="p-3">Timing</th>
                    <th className="p-3">Branch</th>
                    <th className="p-3">Process</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeShifts.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-3">
                        <b>{s.shift_code}</b>
                        <p className="text-xs text-slate-500">{s.shift_name}</p>
                      </td>
                      <td className="p-3">{s.start_time} – {s.end_time}</td>
                      <td className="p-3">{s.branch_name || "All"}</td>
                      <td className="p-3">{s.process_name || "All"}</td>
                      <td className="p-3">
                        <button
                          onClick={() => deactivate(s)}
                          className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showInactive && inactiveShifts.length > 0 && (
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-950">Inactive / Deactivated Shifts</h2>
            <div className="mt-4 space-y-2">
              {inactiveShifts.map((s) => (
                <div key={s.id} className="rounded-2xl border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <b>{s.shift_code} — {s.shift_name}</b>
                      <p className="text-xs text-slate-500">{s.start_time} – {s.end_time}</p>
                    </div>
                    <button
                      onClick={() => restore(s)}
                      className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
