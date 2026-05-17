-- =============================================================
-- Phase 8E: Unified Workforce Performance Command Center
-- Safe additive SQL for unified role-wise cockpit.
-- Defensive version: repairs existing partial LMS/WFM/ATS tables before views.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.command_center_saved_filter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  filter_name text NOT NULL,
  filter_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.command_center_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_domain text NOT NULL,
  alert_level text NOT NULL DEFAULT 'Info',
  alert_title text NOT NULL,
  alert_message text,
  branch_name text,
  process_name text,
  team_name text,
  employee_id uuid,
  employee_code text,
  alert_date date NOT NULL DEFAULT current_date,
  action_status text NOT NULL DEFAULT 'Open',
  owner_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repair existing partial tables used by command center.
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS filter_name text;
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS filter_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS active_status boolean NOT NULL DEFAULT true;
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.command_center_saved_filter ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS alert_domain text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS alert_level text NOT NULL DEFAULT 'Info';
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS alert_title text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS alert_message text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS alert_date date NOT NULL DEFAULT current_date;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS action_status text NOT NULL DEFAULT 'Open';
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.command_center_alert_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- LMS content progress existed in older builds with completed_at but without completed/progress_percent.
ALTER TABLE public.lms_content_progress ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.lms_content_progress ADD COLUMN IF NOT EXISTS progress_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.lms_content_progress ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.lms_content_progress
SET completed = true
WHERE completed_at IS NOT NULL
   OR COALESCE(progress_percent, 0) >= 100;

CREATE INDEX IF NOT EXISTS idx_command_center_alert_log_scope
ON public.command_center_alert_log(alert_date, alert_domain, branch_name, process_name, team_name, action_status);

CREATE OR REPLACE VIEW public.command_center_today_summary AS
SELECT 'HRMS' AS domain, 'Active Employees' AS metric_name, COUNT(*)::numeric AS metric_value
FROM public.employees
WHERE COALESCE(status::text, '') IN ('active','onboarding')
UNION ALL
SELECT 'ATS', 'Candidates Today', COUNT(*)::numeric
FROM public.ats_candidate
WHERE created_at::date = current_date
UNION ALL
SELECT 'ATS', 'Selected Today', COUNT(*)::numeric
FROM public.ats_recruiter_submission
WHERE submitted_at::date = current_date AND final_decision = 'Selected'
UNION ALL
SELECT 'LMS', 'Active Content', COUNT(*)::numeric
FROM public.lms_content_master
WHERE COALESCE(active_status, true) = true
UNION ALL
SELECT 'LMS', 'Completed Learning Rows', COUNT(*)::numeric
FROM public.lms_content_progress
WHERE completed = true
   OR completed_at IS NOT NULL
   OR COALESCE(progress_percent, 0) >= 100
UNION ALL
SELECT 'WFM', 'Rostered Today', COUNT(*)::numeric
FROM public.wfm_roster_assignment
WHERE roster_date = current_date
UNION ALL
SELECT 'WFM', 'On Shift Now', COUNT(*)::numeric
FROM public.wfm_attendance_session
WHERE session_date = current_date AND current_status = 'On Shift'
UNION ALL
SELECT 'QUALITY', 'Audits Today', COUNT(*)::numeric
FROM public.quality_score_log
WHERE audit_date = current_date
UNION ALL
SELECT 'OPERATIONS', 'Volume Today', COALESCE(SUM(handled_volume),0)::numeric
FROM public.operations_productivity_log
WHERE performance_date = current_date;

INSERT INTO public.page_master (module_code, page_code, page_name, page_description, route_path, open_mode, icon_name, display_order, active_status)
VALUES
('PERFORMANCE','WORKFORCE_COMMAND_CENTER','Unified Workforce Command Center','CEO/Branch/Process/Team role-wise cockpit across HRMS, ATS, LMS, WFM, Quality and Operations','/performance/command-center','internal','LayoutDashboard',10,true)
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

INSERT INTO public.role_page_access (role_key, page_code, can_view, can_create, can_edit, can_delete, can_export, active_status)
VALUES
('admin','WORKFORCE_COMMAND_CENTER',true,true,true,true,true,true),
('hr','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('manager','WORKFORCE_COMMAND_CENTER',true,false,false,false,true,true),
('employee','WORKFORCE_COMMAND_CENTER',false,false,false,false,false,true)
ON CONFLICT (role_key, page_code) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export,
  active_status = true,
  updated_at = now();

ALTER TABLE public.command_center_saved_filter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_center_alert_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['command_center_saved_filter','command_center_alert_log'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='authenticated_all_' || t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated_all_' || t, t);
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'PHASE 8E UNIFIED WORKFORCE COMMAND CENTER INSTALLED' AS status;
