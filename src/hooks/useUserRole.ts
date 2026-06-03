import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hrmsApi } from "@/lib/hrmsApi";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/roles";
import { DEMO_CREDENTIALS } from "@/lib/demoCreds";

export type WorkforcePageAccess = {
  page_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
};

export type WorkforceScope = {
  id: string;
  role_key: string;
  scope_type: string;
  branch_id: string | null;
  process_id: string | null;
  lob_id: string | null;
  department_id: string | null;
  manager_employee_id: string | null;
};

export type UserRoleData = {
  roles: AppRole[];
  roleKeys: string[];
  primaryRole: AppRole | null;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  scopes: WorkforceScope[];
  pages: WorkforcePageAccess[];
};

const getPrimaryRole = (roles: AppRole[]): AppRole | null => {
  // Priority order for primary role determination
  if (roles.includes("admin")) return "admin";
  if (roles.includes("hr")) return "hr";
  if (roles.includes("ceo")) return "ceo";
  if (roles.includes("branch_head")) return "branch_head";
  if (roles.includes("process_manager")) return "process_manager";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("wfm")) return "wfm";
  if (roles.includes("finance")) return "finance";
  if (roles.includes("payroll")) return "payroll";
  if (roles.includes("qa")) return "qa";
  if (roles.includes("recruiter")) return "recruiter";
  if (roles.includes("trainer")) return "trainer";
  if (roles.includes("tl")) return "tl";
  if (roles.includes("employee")) return "employee";
  return null;
};

const unique = <T,>(values: T[]) => Array.from(new Set(values.filter(Boolean)));

export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role-workforce-os", user?.id],
    queryFn: async (): Promise<UserRoleData | null> => {
      if (!user?.id) return null;

      // Local demo mode bypass — per-role
      const demoCred = DEMO_CREDENTIALS.find(c => c.userId === user.id);
      if (demoCred) {
        return {
          roles: [demoCred.role as AppRole],
          roleKeys: [demoCred.role, "employee"],
          primaryRole: demoCred.role as AppRole,
          employeeId: demoCred.employeeId,
          employeeCode: demoCred.employeeCode,
          employeeName: demoCred.fullName,
          scopes: [],
          pages: demoCred.pages.map(code => ({
            page_code: code,
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
            can_export: true,
          })),
        };
      }

      // MySQL backend path — if hrms_access_token present, use /api/access/me
      if (localStorage.getItem('hrms_access_token')) {
        const res = await hrmsApi.get<{ success: boolean; data: any }>('/api/access/me');
        const d = (res as any).data;
        if (d) {
          const roles = (d.roles ?? []) as AppRole[];
          const scopeRoleKeys: string[] = (d.scopes ?? []).map((s: any) => s.role_key as string).filter(Boolean);
          const roleKeys = Array.from(new Set([...roles.map(String), ...scopeRoleKeys, 'employee']));
          return {
            roles,
            roleKeys,
            primaryRole: getPrimaryRole(roles),
            employeeId: d.employeeId ?? d.employee?.id ?? null,
            employeeCode: d.employeeCode ?? d.employee?.employee_code ?? null,
            employeeName: d.employeeName ?? (d.employee ? `${d.employee.first_name ?? ''} ${d.employee.last_name ?? ''}`.trim() : null),
            scopes: d.scopes ?? [],
            pages: d.pages ?? d.pagePerms ?? [],
          };
        }
      }

      // No MySQL token — unauthenticated; do not fall back to Supabase
      return {
        roles: [],
        roleKeys: [],
        primaryRole: null,
        employeeId: null,
        employeeCode: null,
        employeeName: null,
        scopes: [],
        pages: [],
      };
    },
    enabled: !!user?.id,
    retry: 2,
    staleTime: 30_000,
  });
};

export const useIsAdminOrHR = () => {
  const { data, isLoading, error } = useUserRole();
  const roles = data?.roles ?? [];

  return {
    isAdminOrHR: roles.includes("admin") || roles.includes("hr"),
    isLoading,
    error,
    role: data?.primaryRole ?? null,
    roles,
    roleKeys: data?.roleKeys ?? [],
  };
};

export const useWorkforceAccess = () => {
  const roleQuery = useUserRole();

  const access = useMemo(() => {
    const pageSet = new Set((roleQuery.data?.pages ?? []).filter((p) => p.can_view).map((p) => p.page_code));
    const roleKeys = roleQuery.data?.roleKeys ?? [];
    return {
      canViewPage: (pageCode: string) => pageSet.has(pageCode),
      visiblePageCodes: Array.from(pageSet),
      roleKeys,
      scopes: roleQuery.data?.scopes ?? [],
      employeeId: roleQuery.data?.employeeId ?? null,
      employeeCode: roleQuery.data?.employeeCode ?? null,
      employeeName: roleQuery.data?.employeeName ?? null,
      hasAnyRole: (...roles: string[]) => roles.some(r => roleKeys.includes(r)),
    };
  }, [roleQuery.data]);

  return {
    ...roleQuery,
    ...access,
  };
};

/** Check if user has any of the specified roles */
export const useHasRole = (...roles: string[]) => {
  const { roleKeys } = useWorkforceAccess();
  return roles.some(r => roleKeys.includes(r));
};
