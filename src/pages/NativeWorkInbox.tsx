import { useEffect, useState } from "react";
import {
  AlertTriangle, Bell, BellOff, CheckCheck, CheckCircle2,
  Clock, ExternalLink, Loader, RefreshCcw,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";

type InboxPriority = "low" | "normal" | "high" | "urgent";

type InboxItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  priority: InboxPriority;
  is_read: 0 | 1;
  is_actioned: 0 | 1;
  created_at: string;
};

type InboxResponse = {
  success: boolean;
  data: InboxItem[];
  total: number;
};

type CountResponse = {
  success: boolean;
  count: number;
};

const TYPE_LABELS: Record<string, string> = {
  leave_approval:    "Leave Approval",
  exit_clearance:    "Exit Clearance",
  workflow_request:  "Workflow Request",
  pip_checkpoint:    "PIP Checkpoint",
  asset_return:      "Asset Return",
};

const PRIORITY_COLORS: Record<InboxPriority, string> = {
  urgent: "bg-red-100 text-red-700",
  high:   "bg-orange-100 text-orange-700",
  normal: "bg-blue-50 text-blue-700",
  low:    "bg-slate-100 text-slate-500",
};

const TYPE_PILL_COLORS: Record<string, string> = {
  leave_approval:   "bg-emerald-50 text-emerald-700",
  exit_clearance:   "bg-rose-50 text-rose-700",
  workflow_request: "bg-violet-50 text-violet-700",
  pip_checkpoint:   "bg-amber-50 text-amber-700",
  asset_return:     "bg-cyan-50 text-cyan-700",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TAB_FILTERS: { label: string; type: string }[] = [
  { label: "All",               type: "" },
  { label: "Leave Approvals",   type: "leave_approval" },
  { label: "Workflow Requests", type: "workflow_request" },
  { label: "Asset Returns",     type: "asset_return" },
  { label: "PIP",               type: "pip_checkpoint" },
  { label: "Other",             type: "other" },
];

const PRIORITY_FILTER_OPTIONS = ["all", "urgent", "high", "normal"] as const;

export default function NativeWorkInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [actioning, setActioning] = useState<string | null>(null);

  const buildQuery = (tab: string, priority: string): string => {
    const parts: string[] = [];
    if (tab && tab !== "other") parts.push(`type=${tab}`);
    if (priority !== "all")     parts.push(`priority=${priority}`);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  };

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [listRes, countRes] = await Promise.all([
        hrmsApi.get<InboxResponse>(`/api/inbox${buildQuery(activeTab, priorityFilter)}`),
        hrmsApi.get<CountResponse>("/api/inbox/count"),
      ]);
      let data = listRes.data ?? [];
      // "Other" tab: items not in known types
      if (activeTab === "other") {
        const known = new Set(Object.keys(TYPE_LABELS));
        data = data.filter((i) => !known.has(i.type));
      }
      setItems(data);
      setUnreadCount(countRes.count ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load inbox";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [activeTab, priorityFilter]);

  const markRead = async (id: string) => {
    setActioning(id);
    try {
      await hrmsApi.patch(`/api/inbox/${id}/read`, {});
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_read: 1 } : i));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to mark as read");
    } finally {
      setActioning(null);
    }
  };

  const markActioned = async (id: string, actionUrl?: string) => {
    setActioning(id);
    try {
      await hrmsApi.patch(`/api/inbox/${id}/actioned`, {});
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_actioned: 1, is_read: 1 } : i));
      setUnreadCount((c) => Math.max(0, c - 1));
      if (actionUrl) window.open(actionUrl, "_blank", "noopener noreferrer");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to action item");
    } finally {
      setActioning(null);
    }
  };

  const markAllRead = async () => {
    try {
      await hrmsApi.patch("/api/inbox/mark-all-read", {});
      setItems((prev) => prev.map((i) => ({ ...i, is_read: 1 as const })));
      setUnreadCount(0);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to mark all as read");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">HR Operations</p>
            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-950">Work Inbox</h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-black text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="mt-2 text-slate-600">Pending approvals, actions, and notifications.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {message}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
          {/* Type tabs */}
          <div className="flex flex-wrap gap-2">
            {TAB_FILTERS.map((tab) => (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === tab.type
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Priority:</span>
            {PRIORITY_FILTER_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  priorityFilter === p
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border bg-white py-20 text-slate-400 shadow-sm">
              <BellOff className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-semibold">No inbox items.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`rounded-3xl border bg-white p-5 shadow-sm transition-all ${
                  item.is_read ? "opacity-70" : "border-blue-200 bg-blue-50/30"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {!item.is_read && (
                        <Bell className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          TYPE_PILL_COLORS[item.type] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {TYPE_LABELS[item.type] ?? item.type.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          PRIORITY_COLORS[item.priority]
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                    </div>
                    <p className="font-bold text-slate-950">{item.title}</p>
                    {item.description && (
                      <p className="text-sm text-slate-600">{item.description}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {!item.is_read && (
                      <button
                        onClick={() => void markRead(item.id)}
                        disabled={actioning === item.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Read
                      </button>
                    )}
                    {!item.is_actioned && (
                      <button
                        onClick={() => void markActioned(item.id, item.action_url)}
                        disabled={actioning === item.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {item.action_url ? (
                          <ExternalLink className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {item.action_url ? "Open & Action" : "Action"}
                      </button>
                    )}
                    {item.is_actioned && (
                      <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                        Actioned
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
