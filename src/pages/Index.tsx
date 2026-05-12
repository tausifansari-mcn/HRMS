import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PendingApprovalsWidget } from "@/components/dashboard/PendingApprovalsWidget";
import { TeamLeaveCalendar } from "@/components/dashboard/TeamLeaveCalendar";
import { NonEmployeeDashboard } from "@/components/dashboard/NonEmployeeDashboard";
import { UpdateNotification } from "@/components/dashboard/UpdateNotification";
import { WhosOut } from "@/components/dashboard/WhosOut";
import { UpcomingCelebrations } from "@/components/dashboard/UpcomingCelebrations";
import { UpcomingHolidays } from "@/components/dashboard/UpcomingHolidays";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type MetricTone = "cyan" | "emerald" | "indigo" | "amber" | "slate";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone: MetricTone;
  onClick?: () => void;
}

const toneStyles: Record<
  MetricTone,
  {
    card: string;
    icon: string;
    glow: string;
    bar: string;
  }
> = {
  cyan: {
    card: "from-cyan-50 via-white to-sky-50 border-cyan-100",
    icon: "bg-cyan-100 text-cyan-700",
    glow: "bg-cyan-300/30",
    bar: "bg-cyan-500",
  },
  emerald: {
    card: "from-emerald-50 via-white to-teal-50 border-emerald-100",
    icon: "bg-emerald-100 text-emerald-700",
    glow: "bg-emerald-300/30",
    bar: "bg-emerald-500",
  },
  indigo: {
    card: "from-indigo-50 via-white to-violet-50 border-indigo-100",
    icon: "bg-indigo-100 text-indigo-700",
    glow: "bg-indigo-300/30",
    bar: "bg-indigo-500",
  },
  amber: {
    card: "from-amber-50 via-white to-orange-50 border-amber-100",
    icon: "bg-amber-100 text-amber-700",
    glow: "bg-amber-300/30",
    bar: "bg-amber-500",
  },
  slate: {
    card: "from-slate-50 via-white to-slate-100 border-slate-200",
    icon: "bg-slate-100 text-slate-700",
    glow: "bg-slate-300/30",
    bar: "bg-slate-700",
  },
};

const MetricCard = ({ title, value, subtitle, icon, tone, onClick }: MetricCardProps) => {
  const styles = toneStyles[tone];

  const card = (
    <div
      className={`group relative h-full overflow-hidden rounded-3xl border bg-gradient-to-br ${styles.card} p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${styles.glow}`} />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </h3>
        </div>

        <div className={`rounded-2xl p-3 shadow-sm ${styles.icon}`}>
          {icon}
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-sm leading-6 text-slate-500">{subtitle}</p>

        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div className={`h-2 w-4/5 rounded-full ${styles.bar}`} />
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="h-full w-full text-left">
        {card}
      </button>
    );
  }

  return card;
};

const Index = () => {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: employeeStatus, isLoading: isEmployeeStatusLoading } =
    useEmployeeStatus();
  const { isAdminOrHR, isLoading: isRoleLoading } = useIsAdminOrHR();
  const { user } = useAuth();
  const navigate = useNavigate();

  const hasPendingApprovals = (stats?.pendingApprovals ?? 0) > 0;

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";

    return "Good evening";
  };

  const getUserFirstName = () => {
    const fullName = user?.user_metadata?.full_name || user?.email || "User";
    return fullName.split(" ")[0];
  };

  const quickActions = isAdminOrHR
    ? [
        {
          title: "Add Employee",
          description: "Create onboarding entry",
          path: "/onboarding",
          icon: <UserPlus className="h-4 w-4" />,
        },
        {
          title: "Manage Assets",
          description: "Assign and track assets",
          path: "/assets",
          icon: <Package className="h-4 w-4" />,
        },
        {
          title: "View Payroll",
          description: "Payroll overview",
          path: "/payroll",
          icon: <FileText className="h-4 w-4" />,
        },
      ]
    : [
        {
          title: "Request Leave",
          description: "Apply for time off",
          path: "/leaves",
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          title: "My KPIs",
          description: "Performance view",
          path: "/performance",
          icon: <Target className="h-4 w-4" />,
        },
        {
          title: "View Attendance",
          description: "Daily attendance status",
          path: "/attendance",
          icon: <ClipboardList className="h-4 w-4" />,
        },
      ];

  if (isEmployeeStatusLoading || isRoleLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6 shadow-sm">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="mt-4 h-5 w-96 rounded-xl" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 rounded-3xl" />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-3xl lg:col-span-2" />
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!employeeStatus?.isEmployee && !isAdminOrHR) {
    return (
      <DashboardLayout>
        <NonEmployeeDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <UpdateNotification />

        {/* Modern Hero Header */}
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-6 text-white shadow-xl">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-cyan-50 shadow-lg backdrop-blur">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                HRMS Workspace
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                {getGreeting()}, {getUserFirstName()}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Your employee command center for attendance, leaves, approvals,
                assets, payroll, celebrations and team updates.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/attendance"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:-translate-y-0.5"
                >
                  <Clock3 className="h-4 w-4 text-cyan-700" />
                  View Attendance
                </Link>

                <Link
                  to="/leaves"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  <CalendarDays className="h-4 w-4 text-cyan-200" />
                  Manage Leaves
                </Link>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Today&apos;s Status</p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {stats?.onLeaveToday ? "On Leave" : "Working"}
                  </h2>
                </div>

                <div className="rounded-2xl bg-emerald-300/15 p-3 text-emerald-200 ring-1 ring-emerald-200/20">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">Leaves</p>
                  <p className="mt-2 text-xl font-semibold">
                    {stats?.availableLeaves || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">Assets</p>
                  <p className="mt-2 text-xl font-semibold">
                    {stats?.assetsAssigned || 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">Approvals</p>
                  <p className="mt-2 text-xl font-semibold">
                    {stats?.pendingApprovals || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Quick Actions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Frequently used actions based on your access.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-2xl border-slate-200 bg-white shadow-sm"
              >
                <Zap className="h-4 w-4 text-cyan-700" />
                More Actions
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="z-50 w-56 bg-popover">
              {quickActions.map((action) => (
                <DropdownMenuItem key={action.title} asChild>
                  <Link
                    to={action.path}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    {action.icon}
                    {action.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.path}
              className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-100 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                  {action.icon}
                </div>

                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-700" />
              </div>

              <h3 className="mt-4 font-semibold text-slate-950">
                {action.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {action.description}
              </p>
            </Link>
          ))}
        </section>

        {/* KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-3xl" />
              ))}
            </>
          ) : (
            <>
              <MetricCard
                title="Leave Balance"
                value={`${stats?.availableLeaves || 0} / ${stats?.totalLeaves || 0}`}
                subtitle="Available leave balance for the current cycle."
                icon={<CalendarDays className="h-6 w-6" />}
                tone="cyan"
              />

              <MetricCard
                title="Status Today"
                value={stats?.onLeaveToday ? "On Leave" : "Working"}
                subtitle={
                  stats?.onLeaveToday
                    ? "You are marked on leave today."
                    : "You are currently marked active for today."
                }
                icon={<CheckCircle2 className="h-6 w-6" />}
                tone={stats?.onLeaveToday ? "amber" : "emerald"}
              />

              <MetricCard
                title="My Assets"
                value={String(stats?.assetsAssigned || 0)}
                subtitle="Assets currently assigned to your profile."
                icon={<Package className="h-6 w-6" />}
                tone="indigo"
              />

              <MetricCard
                title="Pending Approvals"
                value={String(stats?.pendingApprovals || 0)}
                subtitle={
                  hasPendingApprovals
                    ? "Click to review approval queue."
                    : "No pending approval action right now."
                }
                icon={<ClipboardCheck className="h-6 w-6" />}
                tone={hasPendingApprovals ? "amber" : "slate"}
                onClick={
                  hasPendingApprovals ? () => navigate("/leave-approvals") : undefined
                }
              />
            </>
          )}
        </section>

        {/* Insight Strip */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">
                  Employee Workspace
                </h3>
                <p className="text-sm text-slate-500">
                  Centralized HR actions and self-service.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">Team Visibility</h3>
                <p className="text-sm text-slate-500">
                  Track who&apos;s out, holidays and team calendar.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-950">HR Operations</h3>
                <p className="text-sm text-slate-500">
                  Payroll, assets, approvals and reports in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Who's Out */}
        <section className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between px-1">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Team Availability
              </h2>
              <p className="text-sm text-slate-500">
                Who&apos;s out and upcoming team visibility.
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
              <BadgeCheck className="h-3.5 w-3.5" />
              Live
            </div>
          </div>

          <WhosOut />
        </section>

        {/* Main Content Grid */}
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between px-1">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Recent Activity
                  </h2>
                  <p className="text-sm text-slate-500">
                    Latest HRMS actions and employee updates.
                  </p>
                </div>

                <Link
                  to="/reports"
                  className="hidden items-center gap-1 text-sm font-medium text-cyan-700 hover:text-indigo-700 sm:inline-flex"
                >
                  View Reports
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <RecentActivity />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
              <UpcomingHolidays />
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
              <UpcomingCelebrations />
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
              <PendingApprovalsWidget />
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
              <TeamLeaveCalendar />
            </div>
          </aside>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Index;