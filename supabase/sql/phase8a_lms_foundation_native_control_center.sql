-- =============================================================
-- Phase 8A: Native LMS Foundation Tables for HRMS Integration
-- Safe additive SQL. Creates/repairs LMS tables used by native LMS pages.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lms_classroom_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_code text UNIQUE NOT NULL,
  classroom_name text NOT NULL,
  description text,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_module_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES public.lms_classroom_master(id) ON DELETE SET NULL,
  module_code text,
  module_name text NOT NULL,
  day_no integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 1,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_content_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.lms_module_master(id) ON DELETE SET NULL,
  content_code text,
  content_title text NOT NULL,
  content_type text NOT NULL DEFAULT 'Video',
  content_url text,
  required_completion_percent numeric NOT NULL DEFAULT 100,
  display_order integer NOT NULL DEFAULT 1,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_module_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.lms_module_master(id) ON DELETE CASCADE,
  assignment_scope text NOT NULL DEFAULT 'all',
  scope_value text,
  assigned_by uuid,
  active_status boolean NOT NULL DEFAULT true,
  notification_status text NOT NULL DEFAULT 'Pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_certification_rule_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_name text NOT NULL,
  lob_name text,
  certification_mode text NOT NULL DEFAULT 'Internal',
  min_score numeric NOT NULL DEFAULT 80,
  internal_required boolean NOT NULL DEFAULT true,
  external_required boolean NOT NULL DEFAULT false,
  mock_required boolean NOT NULL DEFAULT false,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  content_id uuid REFERENCES public.lms_content_master(id) ON DELETE CASCADE,
  progress_percent numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  watch_seconds integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, content_id)
);

CREATE TABLE IF NOT EXISTS public.lms_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES public.lms_module_master(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_assessment_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.lms_module_master(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.lms_classroom_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_module_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_content_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_module_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_certification_rule_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_assessment_attempt ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lms_classroom_master','lms_module_master','lms_content_master','lms_module_assignment',
    'lms_certification_rule_master','lms_content_progress','lms_question_bank','lms_assessment_attempt'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='authenticated_all_' || t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated_all_' || t, t);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.page_master (module_code, page_code, page_name, page_description, route_path, open_mode, icon_name, display_order, active_status)
VALUES
('LMS','LMS_ADMIN','LMS Admin','Curriculum, content, assignments and certification rules','/lms/admin','internal','GraduationCap',40,true),
('LMS','LMS_MY_LEARNING','My Learning','Employee learning path inside HRMS','/lms/my-learning','internal','BookOpen',41,true),
('LMS','LMS_COORDINATOR','LMS Coordinator','Training coordinator batch and classroom operations','/lms/coordinator','internal','Users',42,true),
('LMS','LMS_MANAGEMENT_DASHBOARD','LMS Management Dashboard','Management view of training performance','/lms/management-dashboard','internal','BarChart3',43,true)
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
('admin','LMS_ADMIN',true,true,true,true,true,true),
('hr','LMS_ADMIN',true,true,true,false,true,true),
('manager','LMS_ADMIN',true,false,false,false,true,true),
('employee','LMS_MY_LEARNING',true,false,false,false,false,true),
('admin','LMS_MY_LEARNING',true,true,true,true,true,true),
('hr','LMS_COORDINATOR',true,true,true,false,true,true),
('manager','LMS_COORDINATOR',true,true,true,false,true,true),
('admin','LMS_COORDINATOR',true,true,true,true,true,true),
('admin','LMS_MANAGEMENT_DASHBOARD',true,true,true,true,true,true),
('hr','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true),
('manager','LMS_MANAGEMENT_DASHBOARD',true,false,false,false,true,true)
ON CONFLICT (role_key, page_code) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export,
  active_status = true,
  updated_at = now();

COMMIT;

SELECT 'PHASE 8A NATIVE LMS FOUNDATION INSTALLED' AS status;
