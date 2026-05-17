-- =============================================================
-- Phase 8F: Hard Role-Scope Enforcement Foundation
-- Safe additive SQL for role-wise page access and branch/process/team scope.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Universal assignment scope repair / extension.
CREATE TABLE IF NOT EXISTS public.user_assignment_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  role_key text NOT NULL DEFAULT 'employee',
  scope_type text NOT NULL DEFAULT 'employee',
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS role_key text NOT NULL DEFAULT 'employee';
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'employee';
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS process_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS lob_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS manager_employee_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS scope_value text;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS active_status boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_assignment_scope ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_assignment_scope_user_active
ON public.user_assignment_scope(user_id, active_status);

CREATE INDEX IF NOT EXISTS idx_user_assignment_scope_role_scope
ON public.user_assignment_scope(role_key, scope_type, lower(COALESCE(scope_value,'')));

-- Role catalog so business roles can exist without changing the app_role enum.
CREATE TABLE IF NOT EXISTS public.workforce_role_catalog (
  role_key text PRIMARY KEY,
  role_name text NOT NULL,
  role_description text,
  default_scope_type text NOT NULL DEFAULT 'employee',
  active_status boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.workforce_role_catalog (role_key, role_name, role_description, default_scope_type, display_order)
VALUES
('admin','Admin','Full system administrator','all',1),
('hr','HR','HR team with employee and recruitment visibility','all',2),
('manager','Manager','Generic manager role','team',3),
('employee','Employee','Self-service employee role','employee',4),
('ceo','CEO','All-organization executive command view','all',5),
('branch_head','Branch Head','Branch-level HRMS/ATS/LMS/WFM/Quality/Operations view','branch',10),
('process_manager','Process Manager','Process-level performance and operations view','process',20),
('team_leader','Team Leader','Team-level employee performance and WFM view','team',30),
('recruiter','Recruiter','ATS recruiter workspace access','employee',40),
('training_coordinator','Training Coordinator','LMS coordinator portal access','branch',50),
('trainer','Trainer','LMS and trainee progress access','process',60),
('quality_head','Quality Head','Quality command access','all',70),
('operations_head','Operations Head','Operations performance access','all',80),
('wfm_admin','WFM Admin','Roster and live tracker access','all',90)
ON CONFLICT (role_key) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  role_description = EXCLUDED.role_description,
  default_scope_type = EXCLUDED.default_scope_type,
  active_status = true,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Ensure key page records exist.
INSERT INTO public.page_master (module_code, page_code, page_name, page_description, route_path, open_mode, icon_name, display_order, active_status)
VALUES
('ATS','ATS_DASHBOARD','ATS Dashboard','Recruitment command center','/ats/dashboard','internal','UserPlus',20,true),
('ATS','ATS_RECRUITER_QUEUE','My Candidate Queue','Recruiter assigned candidate queue','/ats/recruiter/my-candidates','internal','ClipboardList',21,true),
('LMS','LMS_MY_LEARNING','My Learning','Employee learning path and assigned modules','/lms/my-learning','internal','BookOpen',30,true),
('LMS','LMS_COORDINATOR','LMS Coordinator','Training batch and trainee coordination','/lms/coordinator','internal','Users',31,true),
('LMS','LMS_ADMIN','LMS Admin','Curriculum, content, assignment and certification control','/lms/admin','internal','GraduationCap',32,true),
('LMS','LMS_MANAGEMENT_DASHBOARD','LMS Management Dashboard','Management training performance dashboard','/lms/management-dashboard','internal','BarChart3',33,true),
('WFM','WFM_ROSTER','WFM Roster','Shift and roster planning','/wfm/roster','internal','CalendarDays',40,true),
('WFM','WFM_LIVE_TRACKER','WFM Live Tracker','Live login, logout and break tracker','/wfm/live-tracker','internal','Clock',41,true),
('QUALITY','QUALITY_DASHBOARD','Quality Dashboard','Quality score, defect and coaching dashboard','/quality/dashboard','internal','ShieldCheck',50,true),
('OPERATIONS','OPERATIONS_DASHBOARD','Operations Dashboard','Productivity, SLA, AHT and shrinkage dashboard','/operations/dashboard','internal','Activity',60,true),
('PERFORMANCE','WORKFORCE_COMMAND_CENTER','Unified Workforce Command Center','Unified HRMS, ATS, LMS, WFM, Quality and Operations cockpit','/performance/command-center','internal','LayoutDashboard',10,true),
('SECURITY','ACCESS_CONTROL','Access Control','Role, page and scope access management','/settings/access-control','internal','Settings',90,true)
ON CONFLICT (page_code) DO UPDATE SET
  module_code = EXCLUDED.module_code,
  page_name = EXCLUDED.page_name,
  page_description = EXCLUDED.page_description,
  route_path = EXCLUDED.route_path,
  open_mode = EXCLUDED.open_mode,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  active_status = true,
  updated_at = now();

-- Reset/seed role-page matrix for native Workforce OS pages only.
DELETE FROM public.role_page_access
WHERE page_code IN (
  'ATS_DASHBOARD','ATS_RECRUITER_QUEUE','LMS_MY_LEARNING','LMS_COORDINATOR','LMS_ADMIN','LMS_MANAGEMENT_DASHBOARD',
  'WFM_ROSTER','WFM_LIVE_TRACKER','QUALITY_DASHBOARD','OPERATIONS_DASHBOARD','WORKFORCE_COMMAND_CENTER','ACCESS_CONTROL'
);

INSERT INTO public.role_page_access (role_key, page_code, can_view, can_create, can_edit, can_delete, can_export, active_status)
VALUES
-- Admin / CEO
('admin','ATS_DASHBOARD',true,true,true,true,true,true),('admin','ATS_RECRUITER_QUEUE',true,true,true,true,true,true),('admin','LMS_MY_LEARNING',true,true,true,true,true,true),('admin','LMS_COORDINATOR',true,true,true,true,true,true),('admin','LMS_ADMIN',true,true,true,true,true,true),('admin','LMS_MANAGEMENT_DASHBOARD',true,true,true,true,true,true),('admin','WFM_ROSTER',true,true,true,true,true,true),('admin','WFM_LIVE_TRACKER',true,true,true,true,true,true),('admin','QUALITY_DASHBOARD',true,true,true,true,true,true),('admin','OPERATIONS_DASHBOARD',true,true,true,true,true,true),('admin','WORKFORCE_COMMAND_CENTER',true,true,true,true,true,true),('admin','ACCESS_CONTROL',true,true,true,true,true,true),
('ceo','ATS_DASHBOARD',true,false,false,false,true,true),('ceo','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),('ceo','WFM_LIVE_TRACKER',true,false,false,false,true,true),('ceo','QUALITY_DASHBOARD',true,false,false,false,true,true),('ceo','OPERATIONS_DASHBOARD',true,false,false,false,true,true),('ceo','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
-- HR
('hr','ATS_DASHBOARD',true,true,true,false,true,true),('hr','ATS_RECRUITER_QUEUE',true,false,false,false,false,true),('hr','LMS_MY_LEARNING',true,false,false,false,false,true),('hr','LMS_COORDINATOR',true,true,true,false,true,true),('hr','LMS_ADMIN',true,true,true,false,true,true),('hr','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),('hr','WFM_ROSTER',true,true,true,false,true,true),('hr','WFM_LIVE_TRACKER',true,true,true,false,true,true),('hr','QUALITY_DASHBOARD',true,false,false,false,true,true),('hr','OPERATIONS_DASHBOARD',true,false,false,false,true,true),('hr','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
-- Branch/process/team managers
('branch_head','ATS_DASHBOARD',true,false,false,false,true,true),('branch_head','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),('branch_head','WFM_LIVE_TRACKER',true,false,false,false,true,true),('branch_head','QUALITY_DASHBOARD',true,false,false,false,true,true),('branch_head','OPERATIONS_DASHBOARD',true,false,false,false,true,true),('branch_head','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('process_manager','ATS_DASHBOARD',true,false,false,false,true,true),('process_manager','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),('process_manager','WFM_LIVE_TRACKER',true,false,false,false,true,true),('process_manager','QUALITY_DASHBOARD',true,false,false,false,true,true),('process_manager','OPERATIONS_DASHBOARD',true,false,false,false,true,true),('process_manager','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('team_leader','WFM_LIVE_TRACKER',true,false,false,false,true,true),('team_leader','QUALITY_DASHBOARD',true,false,false,false,true,true),('team_leader','OPERATIONS_DASHBOARD',true,false,false,false,true,true),('team_leader','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('manager','LMS_MY_LEARNING',true,false,false,false,false,true),('manager','WFM_LIVE_TRACKER',true,false,false,false,true,true),('manager','QUALITY_DASHBOARD',true,false,false,false,true,true),('manager','OPERATIONS_DASHBOARD',true,false,false,false,true,true),('manager','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
-- Functional roles
('recruiter','ATS_RECRUITER_QUEUE',true,true,true,false,false,true),('recruiter','LMS_MY_LEARNING',true,false,false,false,false,true),
('training_coordinator','LMS_COORDINATOR',true,true,true,false,true,true),('training_coordinator','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),('training_coordinator','LMS_MY_LEARNING',true,false,false,false,false,true),
('trainer','LMS_COORDINATOR',true,true,true,false,true,true),('trainer','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),('trainer','LMS_MY_LEARNING',true,false,false,false,false,true),
('quality_head','QUALITY_DASHBOARD',true,true,true,false,true,true),('quality_head','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('operations_head','OPERATIONS_DASHBOARD',true,true,true,false,true,true),('operations_head','WFM_LIVE_TRACKER',true,false,false,false,true,true),('operations_head','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('wfm_admin','WFM_ROSTER',true,true,true,false,true,true),('wfm_admin','WFM_LIVE_TRACKER',true,true,true,false,true,true),('wfm_admin','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
-- Employees
('employee','LMS_MY_LEARNING',true,false,false,false,false,true)
ON CONFLICT (role_key, page_code) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export,
  active_status = true,
  updated_at = now();

-- Helper function: route/page access check by user.
CREATE OR REPLACE FUNCTION public.native_user_can_view_page(p_user_id uuid, p_page_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH roles AS (
    SELECT role::text AS role_key FROM public.user_roles WHERE user_id = p_user_id
    UNION
    SELECT role_key FROM public.user_assignment_scope WHERE user_id = p_user_id AND active_status = true
    UNION
    SELECT 'employee'::text
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.role_page_access rpa
    JOIN roles r ON r.role_key = rpa.role_key
    WHERE rpa.page_code = p_page_code
      AND rpa.can_view = true
      AND rpa.active_status = true
  );
$$;

CREATE OR REPLACE FUNCTION public.native_get_user_scope(p_user_id uuid)
RETURNS TABLE (
  role_key text,
  scope_type text,
  scope_value text,
  branch_name text,
  process_name text,
  team_name text,
  employee_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    uas.role_key,
    uas.scope_type,
    uas.scope_value,
    uas.branch_name,
    uas.process_name,
    uas.team_name,
    uas.employee_id
  FROM public.user_assignment_scope uas
  WHERE uas.user_id = p_user_id
    AND uas.active_status = true;
$$;

ALTER TABLE public.user_assignment_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_role_catalog ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_assignment_scope','workforce_role_catalog'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='authenticated_all_' || t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated_all_' || t, t);
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'PHASE 8F ROLE SCOPE ENFORCEMENT INSTALLED' AS status;
