import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function NativeLMSMyLearning() {
  const { data: contents = [], isLoading, error } = useQuery({
    queryKey: ["native-lms-my-learning"],
    queryFn: async () => {
      const res = await hrmsApi.get<{ success: boolean; data: any[] }>("/api/lms/progress/me");
      if (!res.success) throw new Error("Failed to fetch learning content");
      return res.data ?? [];
    },
  });

  if (error) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-800">Error loading content: {(error as Error).message}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">My Learning</h1>
          <p className="mt-1 text-slate-600">Native learner LMS inside HRMS. Every employee can access assigned learning here.</p>
        </div>
        {isLoading ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-500">Loading learning content…</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {contents.length === 0 ? (
              <div className="rounded-2xl border bg-white p-6 text-slate-500">No learning content is published yet.</div>
            ) : contents.map((c: any) => (
              <div key={c.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">{c.course_id || "Course"}</p>
                <h2 className="mt-2 font-semibold text-slate-950">{c.content_title || c.course_name || "Learning item"}</h2>
                <p className="mt-1 text-sm text-slate-500">{c.content_type || "course"} • {c.status || "not_started"} • {Number(c.completion_pct ?? 0).toFixed(0)}%</p>
                {c.content_url ? <a className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={c.content_url} target="_blank" rel="noreferrer">Open Content</a> : <span className="mt-4 inline-block rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-500">Content URL pending</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
