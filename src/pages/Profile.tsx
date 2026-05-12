import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Files,
  Loader2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Save,
  Shield,
  Star,
  User,
  Wallet,
  X,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmployeeDocuments } from "@/components/documents/EmployeeDocuments";
import { LeaveBalanceCard } from "@/components/profile/LeaveBalanceCard";
import { LeaveRequestForm } from "@/components/profile/LeaveRequestForm";
import { LeaveRequestHistory } from "@/components/profile/LeaveRequestHistory";
import { PayslipViewer } from "@/components/profile/PayslipViewer";
import { TaxDocumentsViewer } from "@/components/profile/TaxDocumentsViewer";
import { MyAttendanceHistory } from "@/components/profile/MyAttendanceHistory";
import { MyAssets } from "@/components/profile/MyAssets";
import { MyPerformanceReviews } from "@/components/profile/MyPerformanceReviews";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmployeeProfile {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  designation: string;
  hire_date: string;
  date_of_birth: string | null;
  gender: string | null;
  status: string;
  department: { name: string } | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
}

interface ProfileForm {
  phone: string;
  address: string;
  city: string;
  country: string;
  date_of_birth: string;
  gender: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
}

interface SummaryCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  helper?: string;
}

interface DetailFieldProps {
  label: string;
  value?: string | null;
  icon?: ReactNode;
}

const allowedTabs = [
  "profile",
  "leaves",
  "attendance",
  "assets",
  "reviews",
  "payslips",
  "documents",
] as const;

const workingDayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const tabItems = [
  {
    value: "profile",
    label: "Profile",
    icon: <User className="h-4 w-4" />,
  },
  {
    value: "leaves",
    label: "Leaves",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    value: "attendance",
    label: "Attendance",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "assets",
    label: "Assets",
    icon: <Package className="h-4 w-4" />,
  },
  {
    value: "reviews",
    label: "Reviews",
    icon: <Star className="h-4 w-4" />,
  },
  {
    value: "payslips",
    label: "Payslips",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    value: "documents",
    label: "Documents",
    icon: <Files className="h-4 w-4" />,
  },
];

const SummaryCard = ({ label, value, icon, helper }: SummaryCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>

          <p className="mt-2 truncate text-sm font-semibold text-slate-950">
            {value || "-"}
          </p>

          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>

        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700 ring-1 ring-slate-200">
          {icon}
        </div>
      </div>
    </div>
  );
};

const DetailField = ({ label, value, icon }: DetailFieldProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        {icon}
        {label}
      </div>

      <p className="text-sm font-semibold text-slate-950">{value || "-"}</p>
    </div>
  );
};

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = (searchParams.get("tab") || "").toLowerCase();

  const initialTab = allowedTabs.includes(
    tabParam as (typeof allowedTabs)[number]
  )
    ? tabParam
    : "profile";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState<ProfileForm>({
    phone: "",
    address: "",
    city: "",
    country: "",
    date_of_birth: "",
    gender: "",
    working_hours_start: "09:00",
    working_hours_end: "18:00",
    working_days: [1, 2, 3, 4, 5],
  });

  const formatTimeForInput = (time: string | null) => {
    if (!time) return "";
    return time.slice(0, 5);
  };

  const resetFormFromEmployee = (employee: EmployeeProfile) => {
    setFormData({
      phone: employee.phone || "",
      address: employee.address || "",
      city: employee.city || "",
      country: employee.country || "",
      date_of_birth: employee.date_of_birth || "",
      gender: employee.gender || "",
      working_hours_start:
        formatTimeForInput(employee.working_hours_start) || "09:00",
      working_hours_end:
        formatTimeForInput(employee.working_hours_end) || "18:00",
      working_days: employee.working_days || [1, 2, 3, 4, 5],
    });
  };

  useEffect(() => {
    if (
      allowedTabs.includes(tabParam as (typeof allowedTabs)[number]) &&
      tabParam !== activeTab
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", value);
    setSearchParams(nextParams);
  };

  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("employees")
        .select(
          `
          id,
          employee_code,
          first_name,
          last_name,
          email,
          phone,
          address,
          city,
          country,
          designation,
          hire_date,
          date_of_birth,
          gender,
          status,
          working_hours_start,
          working_hours_end,
          working_days,
          departments:departments!employees_department_id_fkey (name)
        `
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          ...data,
          department: data.departments,
        } as EmployeeProfile;
      }

      return null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (employee) {
      resetFormFromEmployee(employee);
    }
  }, [employee]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      if (!employee?.id) throw new Error("No employee profile found");

      const { error } = await supabase
        .from("employees")
        .update({
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          city: data.city.trim() || null,
          country: data.country.trim() || null,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          working_hours_start: data.working_hours_start
            ? `${data.working_hours_start}:00`
            : null,
          working_hours_end: data.working_hours_end
            ? `${data.working_hours_end}:00`
            : null,
          working_days: data.working_days,
        })
        .eq("id", employee.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });

      setIsEditing(false);

      toast({
        title: "Profile updated",
        description: "Your information has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancelEdit = () => {
    if (employee) {
      resetFormFromEmployee(employee);
    }

    setIsEditing(false);
  };

  const getUserInitials = () => {
    if (employee) {
      const first = employee.first_name?.[0] || "";
      const last = employee.last_name?.[0] || "";
      return `${first}${last}`.toUpperCase() || "U";
    }

    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";

    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTimeDisplay = (time: string | null) => {
    if (!time) return "-";

    const cleanTime = time.slice(0, 5);
    const [hourRaw, minute] = cleanTime.split(":");
    const hour = Number(hourRaw);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
  };

  const employeeName = employee
    ? `${employee.first_name} ${employee.last_name}`
    : "User";

  const selectedWorkingDays = useMemo(() => {
    return workingDayOptions
      .filter((day) => formData.working_days.includes(day.value))
      .map((day) => day.label)
      .join(", ");
  }, [formData.working_days]);

  const ageLimitDate = new Date(
    new Date().getFullYear() - 18,
    new Date().getMonth(),
    new Date().getDate()
  )
    .toISOString()
    .split("T")[0];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-5">
          <Skeleton className="h-40 rounded-2xl" />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-28 rounded-2xl" />
            ))}
          </div>

          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!employee) {
    return (
      <DashboardLayout>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <Shield className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              No Employee Profile
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Your account is not linked to an employee profile yet. Please
              contact HR to connect your profile.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative p-5 sm:p-6">
            <div className="absolute inset-y-0 left-0 w-1 bg-slate-950" />

            <div className="grid gap-5 pl-2 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20 border border-slate-200 shadow-lg">
                  <AvatarImage
                    src={user?.user_metadata?.avatar_url || ""}
                    alt={employeeName}
                  />
                  <AvatarFallback className="bg-slate-950 text-xl font-semibold text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    My Profile
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {employeeName}
                    </h1>

                    <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      {employee.status}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {employee.designation} ·{" "}
                    {employee.department?.name || "No Department"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium">
                      <Mail className="h-3.5 w-3.5" />
                      {employee.email}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {employee.employee_code}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined {formatDate(employee.hire_date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Working Schedule
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {formatTimeDisplay(employee.working_hours_start)} -{" "}
                  {formatTimeDisplay(employee.working_hours_end)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedWorkingDays || "No days configured"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Department"
            value={employee.department?.name || "No Department"}
            helper="Assigned department"
            icon={<Building2 className="h-5 w-5" />}
          />

          <SummaryCard
            label="Designation"
            value={employee.designation}
            helper="Current role"
            icon={<Briefcase className="h-5 w-5" />}
          />

          <SummaryCard
            label="Employee Code"
            value={employee.employee_code}
            helper="HRMS identifier"
            icon={<Shield className="h-5 w-5" />}
          />

          <SummaryCard
            label="Joining Date"
            value={formatDate(employee.hire_date)}
            helper="Employment start date"
            icon={<Calendar className="h-5 w-5" />}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-950">
                  Profile Workspace
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Manage personal details, schedule, leave, attendance, assets,
                  reviews, payslips and documents.
                </p>
              </div>

              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 sm:grid-cols-4 xl:w-[760px] xl:grid-cols-7">
                {tabItems.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-1.5 rounded-xl px-2 py-2 text-xs"
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="profile" className="mt-0 space-y-5">
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-950">
                          Personal Information
                        </CardTitle>

                        <CardDescription className="text-xs">
                          Update your contact details and personal information.
                        </CardDescription>
                      </div>

                      {!isEditing ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl text-xs"
                          onClick={() => setIsEditing(true)}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl text-xs"
                            onClick={handleCancelEdit}
                            disabled={updateProfileMutation.isPending}
                          >
                            <X className="mr-2 h-3.5 w-3.5" />
                            Cancel
                          </Button>

                          <Button
                            size="sm"
                            className="h-9 rounded-xl bg-slate-950 text-xs text-white hover:bg-slate-800"
                            onClick={handleSave}
                            disabled={updateProfileMutation.isPending}
                          >
                            {updateProfileMutation.isPending ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-3.5 w-3.5" />
                            )}
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailField
                        label="First Name"
                        value={employee.first_name}
                        icon={<User className="h-3.5 w-3.5" />}
                      />

                      <DetailField
                        label="Last Name"
                        value={employee.last_name}
                        icon={<User className="h-3.5 w-3.5" />}
                      />
                    </div>

                    <DetailField
                      label="Email"
                      value={employee.email}
                      icon={<Mail className="h-3.5 w-3.5" />}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              phone: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          placeholder="Enter phone number"
                          className="h-11 rounded-xl pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />

                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              address: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          placeholder="Enter your address"
                          className="h-11 rounded-xl pl-10"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              city: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          placeholder="Enter city"
                          className="h-11 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              country: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          placeholder="Enter country"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              date_of_birth: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          max={ageLimitDate}
                          className="h-11 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              gender: value,
                            }))
                          }
                          disabled={!isEditing}
                        >
                          <SelectTrigger
                            id="gender"
                            className="h-11 rounded-xl"
                          >
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">
                              Prefer not to say
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DetailField
                      label="Department"
                      value={employee.department?.name || "No Department"}
                      icon={<Building2 className="h-3.5 w-3.5" />}
                    />

                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                      Contact HR to change department, designation, employee code
                      or official email assignment.
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-950">
                      Working Schedule
                    </CardTitle>

                    <CardDescription className="text-xs">
                      Set your working hours and days for attendance reminders.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start-time">Work Start Time</Label>
                        <Input
                          id="start-time"
                          type="time"
                          value={formData.working_hours_start}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              working_hours_start: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          className="h-11 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end-time">Work End Time</Label>
                        <Input
                          id="end-time"
                          type="time"
                          value={formData.working_hours_end}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              working_hours_end: event.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            Working Days
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Select days applicable for attendance tracking.
                          </p>
                        </div>

                        <Badge className="bg-white text-slate-700 hover:bg-white">
                          {formData.working_days.length} days
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        {workingDayOptions.map((day) => {
                          const checked = formData.working_days.includes(
                            day.value
                          );

                          return (
                            <label
                              key={day.value}
                              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                                checked
                                  ? "border-slate-950 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white text-slate-500"
                              } ${!isEditing ? "cursor-not-allowed opacity-80" : ""}`}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={!isEditing}
                                className="sr-only"
                                onCheckedChange={(value) => {
                                  if (!isEditing) return;

                                  const isChecked = value === true;

                                  setFormData((prev) => ({
                                    ...prev,
                                    working_days: isChecked
                                      ? [...prev.working_days, day.value].sort(
                                          (a, b) => a - b
                                        )
                                      : prev.working_days.filter(
                                          (item) => item !== day.value
                                        ),
                                  }));
                                }}
                              />

                              {day.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-white p-2 text-sky-700 ring-1 ring-sky-100">
                          <Clock className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            Current Schedule Summary
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {formData.working_hours_start || "--:--"} to{" "}
                            {formData.working_hours_end || "--:--"} ·{" "}
                            {selectedWorkingDays || "No working days selected"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="leaves" className="mt-0 space-y-5">
              <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-5">
                  <LeaveBalanceCard employeeId={employee.id} />
                  <LeaveRequestHistory employeeId={employee.id} />
                </div>

                <LeaveRequestForm employeeId={employee.id} />
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="mt-0">
              <MyAttendanceHistory employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="assets" className="mt-0">
              <MyAssets employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="reviews" className="mt-0">
              <MyPerformanceReviews employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="payslips" className="mt-0 space-y-5">
              <PayslipViewer
                employeeId={employee.id}
                employeeName={employeeName}
                employeeCode={employee.employee_code}
              />

              <TaxDocumentsViewer employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <EmployeeDocuments employeeId={employee.id} />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Profile;