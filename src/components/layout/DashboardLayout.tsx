import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bell,
  Building2,
  Calendar,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Home,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Search,
  Settings,
  Target,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdminOrHR, useWorkforceAccess } from "@/hooks/useUserRole";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { cn } from "@/lib/utils";
import { APP_VERSION, isAutoUpdatingEnvironment } from "@/lib/version";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  adminOnly?: boolean;
  employeeOnly?: boolean;
  pageCode?: string;
  description?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface DashboardLayoutProps {
  children: ReactNode;
}

const companyLogo = "/mcn-logo.png?v=999";

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: <Home className="h-4 w-4" />, description: "Workspace overview" },
      { label: "My Modules", href: "/modules", icon: <Package className="h-4 w-4" />, description: "Role-wise ATS, LMS, WFM and performance modules" },
      { label: "Reports", href: "/reports", icon: <BarChart3 className="h-4 w-4" />, adminOnly: true, description: "Reports and insights" },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Employees", href: "/employees", icon: <Users className="h-4 w-4" />, adminOnly: true, description: "Employee directory" },
      { label: "Team Directory", href: "/employees", icon: <Users className="h-4 w-4" />, employeeOnly: true, description: "Team directory" },
      { label: "Departments", href: "/departments", icon: <Building2 className="h-4 w-4" />, adminOnly: true, description: "Department structure" },
      { label: "Onboarding", href: "/onboarding", icon: <UserPlus className="h-4 w-4" />, adminOnly: true, description: "New employee onboarding" },
    ],
  },
  {
    title: "Time",
    items: [
      { label: "Attendance", href: "/attendance", icon: <Clock className="h-4 w-4" />, description: "Attendance records" },
      { label: "Attendance Regularization", href: "/attendance-regularization", icon: <ClipboardList className="h-4 w-4" />, description: "Attendance correction workflow" },
      { label: "Calendar", href: "/calendar", icon: <Calendar className="h-4 w-4" />, description: "Company calendar" },
      { label: "Leaves", href: "/leaves", icon: <CalendarDays className="h-4 w-4" />, description: "Leave requests" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Performance", href: "/performance", icon: <Target className="h-4 w-4" />, description: "Goals and performance" },
      { label: "Reviews", href: "/reviews-management", icon: <ClipboardList className="h-4 w-4" />, adminOnly: true, description: "Performance reviews" },
      { label: "Bulk Upload Hub", href: "/bulk-upload", icon: <Package className="h-4 w-4" />, adminOnly: true, description: "Bulk upload templates and staging" },
      { label: "Assets", href: "/assets", icon: <Package className="h-4 w-4" />, adminOnly: true, description: "Asset management" },
      { label: "Payroll", href: "/payroll", icon: <CreditCard className="h-4 w-4" />, adminOnly: true, description: "Payroll workspace" },
    ],
  },
  {
    title: "Workforce OS",
    items: [
      { label: "ATS Dashboard", href: "/ats/dashboard", icon: <UserPlus className="h-4 w-4" />, pageCode: "ATS_DASHBOARD", description: "Recruitment command center" },
      { label: "My Candidate Queue", href: "/ats/recruiter/my-candidates", icon: <ClipboardList className="h-4 w-4" />, pageCode: "ATS_RECRUITER_QUEUE", description: "Assigned recruitment queue" },
      { label: "My Learning", href: "/lms/my-learning", icon: <BookOpen className="h-4 w-4" />, pageCode: "LMS_MY_LEARNING", description: "Learning path and assigned modules" },
      { label: "LMS Coordinator", href: "/lms/coordinator", icon: <Users className="h-4 w-4" />, pageCode: "LMS_COORDINATOR", description: "Training batch and trainee coordination" },
      { label: "LMS Admin", href: "/lms/admin", icon: <BookOpen className="h-4 w-4" />, pageCode: "LMS_ADMIN", description: "Curriculum, content and rules" },
      { label: "LMS Management", href: "/lms/management-dashboard", icon: <BarChart3 className="h-4 w-4" />, pageCode: "LMS_MANAGEMENT_DASHBOARD", description: "Training management dashboard" },
      { label: "Roster Planning", href: "/wfm/roster", icon: <Clock className="h-4 w-4" />, pageCode: "WFM_ROSTER", description: "WFM roster and shift planning" },
      { label: "WFM Live Tracker", href: "/wfm/live-tracker", icon: <Clock className="h-4 w-4" />, pageCode: "WFM_LIVE_TRACKER", description: "Live shift and break tracker" },
      { label: "Quality Dashboard", href: "/quality/dashboard", icon: <ShieldCheck className="h-4 w-4" />, pageCode: "QUALITY_DASHBOARD", description: "Quality, defects and coaching" },
      { label: "Operations Dashboard", href: "/operations/dashboard", icon: <Activity className="h-4 w-4" />, pageCode: "OPERATIONS_DASHBOARD", description: "Process productivity and SLA" },
      { label: "Performance Command Center", href: "/performance/command-center", icon: <BarChart3 className="h-4 w-4" />, pageCode: "WORKFORCE_COMMAND_CENTER", description: "Unified workforce intelligence" },
      { label: "Access Control", href: "/settings/access-control", icon: <Settings className="h-4 w-4" />, pageCode: "ACCESS_CONTROL", adminOnly: true, description: "Role and page access management" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" />, adminOnly: true, description: "System settings" },
      { label: "Notifications", href: "/notification-preferences", icon: <Bell className="h-4 w-4" />, description: "Notification preferences" },
    ],
  },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoError, setLogoError] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const { user, signOut, isSigningOut } = useAuth();
  const { isAdminOrHR } = useIsAdminOrHR();
  const { canViewPage, visiblePageCodes } = useWorkforceAccess();
  const { data: versionData } = useVersionCheck();

  const displayVersion = isAutoUpdatingEnvironment()
    ? versionData?.currentVersion ?? APP_VERSION
    : versionData?.hasUpdate
      ? APP_VERSION
      : versionData?.currentVersion ?? APP_VERSION;

  const filteredNavGroups = useMemo(() => {
    const visibleSet = new Set(visiblePageCodes);
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.pageCode) {
            return visibleSet.has(item.pageCode) || canViewPage(item.pageCode);
          }
          if (item.adminOnly && !isAdminOrHR) return false;
          if (item.employeeOnly && isAdminOrHR) return false;
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdminOrHR, canViewPage, visiblePageCodes]);

  const searchableItems = useMemo(() => {
    return filteredNavGroups.flatMap((group) =>
      group.items.map((item) => ({ ...item, groupTitle: group.title }))
    );
  }, [filteredNavGroups]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return searchableItems.filter((item) =>
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.groupTitle.toLowerCase().includes(query)
    );
  }, [searchQuery, searchableItems]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults[0]) {
      navigate(searchResults[0].href);
      setSearchQuery("");
      setSidebarOpen(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "MC";

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          {logoError ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">MCN</div>
          ) : (
            <img src={companyLogo} alt="MAS Callnet" className="h-9 w-9 rounded-xl object-contain" onError={() => setLogoError(true)} />
          )}
          <div>
            <p className="text-sm font-bold leading-tight text-sidebar-foreground">MAS Callnet</p>
            <p className="text-xs text-sidebar-foreground/60">HRMS</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filteredNavGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <span className={cn("transition-transform group-hover:scale-110", isActive && "text-sidebar-accent-foreground")}>{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-xs">{item.badge}</Badge>}
                    {isActive && <ChevronRight className="h-4 w-4" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <Badge variant="outline" className="mb-2 w-full justify-center border-sidebar-border text-sidebar-foreground/70">v{displayVersion}</Badge>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border bg-sidebar lg:block"><SidebarContent /></aside>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-72 border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:hidden", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="absolute right-3 top-3"><Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></Button></div>
        <SidebarContent />
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>
            <form onSubmit={handleSearchSubmit} className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search modules, people, reports..." className="pl-10" />
              {searchQuery.trim() && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border bg-popover p-2 shadow-lg">
                  {searchResults.slice(0, 6).map((item) => (
                    <button key={item.href} type="button" onClick={() => { navigate(item.href); setSearchQuery(""); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-accent">
                      {item.icon}
                      <div><p className="font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.description}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </form>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full"><Avatar className="h-10 w-10"><AvatarImage src="" /><AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback></Avatar></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel><div className="flex flex-col space-y-1"><p className="text-sm font-medium">My Account</p><p className="text-xs text-muted-foreground">{user?.email}</p></div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}><LogOut className="mr-2 h-4 w-4" />{isSigningOut ? "Signing out..." : "Sign out"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8"><PWAInstallBanner />{children}</main>
      </div>
    </div>
  );
}
