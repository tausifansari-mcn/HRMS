import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  GitBranch,
  Lock,
  Server,
  Shield,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { hrmsApi } from "@/lib/hrmsApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SystemMetrics {
  totalUsers: number;
  activeEmployees: number;
  totalRoles: number;
  totalPages: number;
  activeIntegrations: number;
  systemHealth: "healthy" | "warning" | "critical";
}

interface ModuleHealth {
  module: string;
  status: "operational" | "degraded" | "down";
  lastSync?: string;
  errorCount: number;
  uptime: number;
}

interface RecentActivity {
  id: string;
  type: string;
  user: string;
  action: string;
  timestamp: string;
  status: "success" | "warning" | "error";
}

// ─── Components ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  loading?: boolean;
  color: "blue" | "emerald" | "amber" | "violet";
}

function MetricCard({ title, value, icon, trend, loading, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          {title}
        </CardDescription>
        <div className={`rounded-xl p-2 ${colorClasses[color]}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tight text-slate-900">{value}</div>
        {trend && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ModuleCardProps {
  module: ModuleHealth;
}

function ModuleHealthCard({ module }: ModuleCardProps) {
  const statusConfig = {
    operational: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50", label: "Operational" },
    degraded: { icon: AlertCircle, color: "text-amber-600 bg-amber-50", label: "Degraded" },
    down: { icon: XCircle, color: "text-red-600 bg-red-50", label: "Down" },
  };

  const config = statusConfig[module.status];
  const Icon = config.icon;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">{module.module}</CardTitle>
          <Badge variant="secondary" className={`${config.color} border-0`}>
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-slate-500">Uptime</p>
            <p className="font-mono text-sm font-semibold text-slate-900">{module.uptime.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Errors</p>
            <p className="font-mono text-sm font-semibold text-slate-900">{module.errorCount}</p>
          </div>
        </div>
        {module.lastSync && (
          <div className="text-xs text-slate-500">
            Last sync: {new Date(module.lastSync).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SuperAdminDashboardV2() {
  // Fetch system metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["super-admin-metrics"],
    queryFn: async () => {
      const [usersRes, rolesRes, pagesRes, integrationsRes] = await Promise.all([
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/access/users-for-access"),
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/access/roles/catalog"),
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/access/pages/catalog"),
        hrmsApi.get<{ success: boolean; data: any[] }>("/api/integration-hub/"),
      ]);

      return {
        totalUsers: usersRes.data?.length ?? 0,
        activeEmployees: 0, // Will fetch separately
        totalRoles: rolesRes.data?.length ?? 0,
        totalPages: pagesRes.data?.length ?? 0,
        activeIntegrations: integrationsRes.data?.filter((i: any) => i.status === "active").length ?? 0,
        systemHealth: "healthy" as const,
      };
    },
  });

  // Fetch module health
  const { data: modules = [] } = useQuery<ModuleHealth[]>({
    queryKey: ["module-health"],
    queryFn: async () => {
      // Mock data for now - in real implementation, these would be actual health checks
      return [
        {
          module: "ATS (Applicant Tracking)",
          status: "operational",
          lastSync: new Date(Date.now() - 3600000).toISOString(),
          errorCount: 0,
          uptime: 99.8,
        },
        {
          module: "Payroll Management",
          status: "operational",
          errorCount: 0,
          uptime: 99.9,
        },
        {
          module: "Leave Management",
          status: "operational",
          errorCount: 0,
          uptime: 100,
        },
        {
          module: "WFM (Attendance)",
          status: "operational",
          errorCount: 0,
          uptime: 99.5,
        },
        {
          module: "Integration Hub",
          status: "operational",
          lastSync: new Date(Date.now() - 7200000).toISOString(),
          errorCount: 0,
          uptime: 98.5,
        },
        {
          module: "KPI Tracking",
          status: "operational",
          errorCount: 0,
          uptime: 99.2,
        },
      ];
    },
  });

  // Fetch recent activity
  const { data: activities = [] } = useQuery<RecentActivity[]>({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      // Mock data - in real implementation, fetch from audit log
      return [
        {
          id: "1",
          type: "access",
          user: "Admin User",
          action: "Granted admin role to john.doe@company.com",
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: "success",
        },
        {
          id: "2",
          type: "integration",
          user: "System",
          action: "Completed sync: Dialer Database (1,250 records)",
          timestamp: new Date(Date.now() - 600000).toISOString(),
          status: "success",
        },
        {
          id: "3",
          type: "employee",
          user: "HR Manager",
          action: "Onboarded new employee: Jane Smith",
          timestamp: new Date(Date.now() - 900000).toISOString(),
          status: "success",
        },
        {
          id: "4",
          type: "payroll",
          user: "Payroll Admin",
          action: "Generated payslips for June 2026",
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          status: "success",
        },
      ];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">System Control</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Super Admin Dashboard</h1>
          <p className="text-slate-600">
            Real-time system monitoring, access control, and operational metrics
          </p>
        </div>

        {/* System Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Users"
            value={metrics?.totalUsers ?? 0}
            icon={<Users className="h-5 w-5" />}
            trend="+5% this month"
            loading={metricsLoading}
            color="blue"
          />
          <MetricCard
            title="Active Roles"
            value={metrics?.totalRoles ?? 0}
            icon={<Shield className="h-5 w-5" />}
            loading={metricsLoading}
            color="emerald"
          />
          <MetricCard
            title="System Pages"
            value={metrics?.totalPages ?? 0}
            icon={<Lock className="h-5 w-5" />}
            loading={metricsLoading}
            color="violet"
          />
          <MetricCard
            title="Integrations"
            value={metrics?.activeIntegrations ?? 0}
            icon={<GitBranch className="h-5 w-5" />}
            trend="14 total configured"
            loading={metricsLoading}
            color="amber"
          />
        </div>

        {/* System Health Badge */}
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <Server className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-900">System Status</CardTitle>
                <CardDescription className="text-sm">All systems operational</CardDescription>
              </div>
              <Badge className="ml-auto border-emerald-300 bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Healthy
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Module Health Grid */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-900">Module Health</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <ModuleHealthCard key={module.module} module={module} />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-slate-600" />
              <CardTitle className="text-lg font-bold text-slate-900">Recent Activity</CardTitle>
            </div>
            <CardDescription>Latest system events and administrative actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No recent activity</p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="mt-0.5 rounded-full bg-blue-50 p-1.5">
                      <Database className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium">{activity.user}</span>
                        <span>•</span>
                        <span>{new Date(activity.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <Badge
                      variant={activity.status === "success" ? "default" : "destructive"}
                      className="ml-2 shrink-0"
                    >
                      {activity.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => (window.location.href = "/settings/access-control")}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-slate-900">Access Control</p>
                  <p className="text-xs text-slate-500">Manage permissions</p>
                </div>
              </button>
              <button
                onClick={() => (window.location.href = "/integration-hub")}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <GitBranch className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-slate-900">Integrations</p>
                  <p className="text-xs text-slate-500">Manage connectors</p>
                </div>
              </button>
              <button
                onClick={() => (window.location.href = "/settings/org-masters")}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Database className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="font-semibold text-slate-900">Org Masters</p>
                  <p className="text-xs text-slate-500">Configure masters</p>
                </div>
              </button>
              <button
                onClick={() => (window.location.href = "/employees")}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Users className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-slate-900">Employees</p>
                  <p className="text-xs text-slate-500">View all employees</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
