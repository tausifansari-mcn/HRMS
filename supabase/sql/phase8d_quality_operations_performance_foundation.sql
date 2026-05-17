-- =============================================================
-- Phase 8D: Quality + Operations Performance Foundation
-- Safe additive SQL for quality dashboard, operations dashboard and trend analytics.
-- Defensive version: repairs existing partial tables with ADD COLUMN IF NOT EXISTS.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.quality_score_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_code text,
  employee_name text,
  audit_date date NOT NULL DEFAULT current_date,
  branch_name text,
  process_name text,
  team_name text,
  manager_name text,
  auditor_name text,
  client_name text,
  call_id text,
  transaction_id text,
  quality_score numeric NOT NULL DEFAULT 0,
  fatal_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  defect_category text,
  defect_sub_category text,
  coaching_required boolean NOT NULL DEFAULT false,
  coaching_status text NOT NULL DEFAULT 'Pending',
  remarks text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operations_productivity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_code text,
  employee_name text,
  performance_date date NOT NULL DEFAULT current_date,
  branch_name text,
  process_name text,
  team_name text,
  manager_name text,
  client_name text,
  login_minutes integer NOT NULL DEFAULT 0,
  productive_minutes integer NOT NULL DEFAULT 0,
  handled_volume integer NOT NULL DEFAULT 0,
  target_volume integer NOT NULL DEFAULT 0,
  aht_seconds numeric NOT NULL DEFAULT 0,
  accuracy_percent numeric NOT NULL DEFAULT 0,
  efficiency_percent numeric NOT NULL DEFAULT 0,
  sla_met_count integer NOT NULL DEFAULT 0,
  sla_total_count integer NOT NULL DEFAULT 0,
  shrinkage_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active',
  remarks text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.performance_target_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL,
  metric_name text NOT NULL,
  domain text NOT NULL,
  branch_name text,
  process_name text,
  target_value numeric NOT NULL DEFAULT 0,
  target_operator text NOT NULL DEFAULT '>=',
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repair existing/partial tables from earlier phases.
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS employee_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS audit_date date NOT NULL DEFAULT current_date;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS auditor_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS call_id text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS quality_score numeric NOT NULL DEFAULT 0;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS fatal_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS defect_category text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS defect_sub_category text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS coaching_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS coaching_status text NOT NULL DEFAULT 'Pending';
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.quality_score_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS employee_name text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS performance_date date NOT NULL DEFAULT current_date;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS login_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS productive_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS handled_volume integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS target_volume integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS aht_seconds numeric NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS accuracy_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS efficiency_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS sla_met_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS sla_total_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS shrinkage_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.operations_productivity_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS metric_code text;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS metric_name text;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS target_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS target_operator text NOT NULL DEFAULT '>=';
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS active_status boolean NOT NULL DEFAULT true;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.performance_target_master ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- If an old table has nulls in newly required target fields, normalize before indexes/seed.
UPDATE public.performance_target_master SET metric_code = COALESCE(metric_code, 'UNKNOWN_' || id::text) WHERE metric_code IS NULL;
UPDATE public.performance_target_master SET metric_name = COALESCE(metric_name, metric_code) WHERE metric_name IS NULL;
UPDATE public.performance_target_master SET domain = COALESCE(domain, 'QUALITY') WHERE domain IS NULL;
UPDATE public.performance_target_master SET target_value = COALESCE(target_value, 0) WHERE target_value IS NULL;
UPDATE public.performance_target_master SET target_operator = COALESCE(target_operator, '>=') WHERE target_operator IS NULL;
UPDATE public.performance_target_master SET active_status = COALESCE(active_status, true) WHERE active_status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_performance_target_master_scope
ON public.performance_target_master (
  metric_code,
  domain,
  (COALESCE(branch_name, '')),
  (COALESCE(process_name, ''))
);

CREATE INDEX IF NOT EXISTS idx_quality_score_log_date_scope
ON public.quality_score_log(audit_date, branch_name, process_name, team_name);

CREATE INDEX IF NOT EXISTS idx_quality_score_log_employee
ON public.quality_score_log(employee_code, audit_date);

CREATE INDEX IF NOT EXISTS idx_operations_productivity_log_date_scope
ON public.operations_productivity_log(performance_date, branch_name, process_name, team_name);

CREATE INDEX IF NOT EXISTS idx_operations_productivity_log_employee
ON public.operations_productivity_log(employee_code, performance_date);

CREATE OR REPLACE VIEW public.quality_dashboard_daily_summary AS
SELECT
  audit_date,
  COALESCE(branch_name,'Unmapped') AS branch_name,
  COALESCE(process_name,'Unmapped') AS process_name,
  COALESCE(team_name,'Unmapped') AS team_name,
  COUNT(*) AS audits,
  ROUND(AVG(quality_score),2) AS avg_quality_score,
  SUM(fatal_count) AS fatal_count,
  SUM(error_count) AS error_count,
  COUNT(*) FILTER (WHERE coaching_required = true) AS coaching_required_count,
  COUNT(*) FILTER (WHERE quality_score >= 95) AS excellent_count,
  COUNT(*) FILTER (WHERE quality_score < 85) AS low_score_count
FROM public.quality_score_log
GROUP BY audit_date, COALESCE(branch_name,'Unmapped'), COALESCE(process_name,'Unmapped'), COALESCE(team_name,'Unmapped');

CREATE OR REPLACE VIEW public.operations_dashboard_daily_summary AS
SELECT
  performance_date,
  COALESCE(branch_name,'Unmapped') AS branch_name,
  COALESCE(process_name,'Unmapped') AS process_name,
  COALESCE(team_name,'Unmapped') AS team_name,
  COUNT(DISTINCT COALESCE(employee_code, employee_id::text)) AS active_employees,
  SUM(login_minutes) AS login_minutes,
  SUM(productive_minutes) AS productive_minutes,
  SUM(handled_volume) AS handled_volume,
  SUM(target_volume) AS target_volume,
  ROUND(AVG(NULLIF(aht_seconds,0)),2) AS avg_aht_seconds,
  ROUND(AVG(accuracy_percent),2) AS avg_accuracy_percent,
  ROUND(AVG(efficiency_percent),2) AS avg_efficiency_percent,
  SUM(sla_met_count) AS sla_met_count,
  SUM(sla_total_count) AS sla_total_count,
  SUM(shrinkage_minutes) AS shrinkage_minutes
FROM public.operations_productivity_log
GROUP BY performance_date, COALESCE(branch_name,'Unmapped'), COALESCE(process_name,'Unmapped'), COALESCE(team_name,'Unmapped');

DELETE FROM public.performance_target_master
WHERE branch_name IS NULL
  AND process_name IS NULL
  AND (
    (domain = 'QUALITY' AND metric_code IN ('QUALITY_SCORE','FATAL_COUNT','COACHING_PENDING'))
    OR
    (domain = 'OPERATIONS' AND metric_code IN ('PRODUCTIVITY_ACHIEVEMENT','ACCURACY_PERCENT','EFFICIENCY_PERCENT','SLA_PERCENT','SHRINKAGE_PERCENT'))
  );

INSERT INTO public.performance_target_master (metric_code, metric_name, domain, target_value, target_operator)
VALUES
('QUALITY_SCORE','Quality Score','QUALITY',95,'>='),
('FATAL_COUNT','Fatal Count','QUALITY',0,'<='),
('COACHING_PENDING','Coaching Pending','QUALITY',0,'<='),
('PRODUCTIVITY_ACHIEVEMENT','Productivity Achievement','OPERATIONS',100,'>='),
('ACCURACY_PERCENT','Accuracy %','OPERATIONS',95,'>='),
('EFFICIENCY_PERCENT','Efficiency %','OPERATIONS',90,'>='),
('SLA_PERCENT','SLA %','OPERATIONS',95,'>='),
('SHRINKAGE_PERCENT','Shrinkage %','OPERATIONS',10,'<=');

ALTER TABLE public.quality_score_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_productivity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_target_master ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quality_score_log','operations_productivity_log','performance_target_master'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='authenticated_all_' || t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated_all_' || t, t);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.page_master (module_code, page_code, page_name, page_description, route_path, open_mode, icon_name, display_order, active_status)
VALUES
('QUALITY','QUALITY_DASHBOARD','Quality Dashboard','Quality score, fatal, defect, coaching and analyst/process quality trends','/quality/dashboard','internal','ShieldCheck',60,true),
('OPERATIONS','OPERATIONS_DASHBOARD','Operations Dashboard','Operations productivity, AHT, volume, SLA, accuracy, efficiency and shrinkage trends','/operations/dashboard','internal','Activity',61,true)
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
('admin','QUALITY_DASHBOARD',true,true,true,true,true,true),
('hr','QUALITY_DASHBOARD',true,false,false,false,true,true),
('manager','QUALITY_DASHBOARD',true,false,false,false,true,true),
('employee','QUALITY_DASHBOARD',false,false,false,false,false,true),
('admin','OPERATIONS_DASHBOARD',true,true,true,true,true,true),
('hr','OPERATIONS_DASHBOARD',true,false,false,false,true,true),
('manager','OPERATIONS_DASHBOARD',true,false,false,false,true,true),
('employee','OPERATIONS_DASHBOARD',false,false,false,false,false,true)
ON CONFLICT (role_key, page_code) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export,
  active_status = true,
  updated_at = now();

COMMIT;

SELECT 'PHASE 8D QUALITY OPERATIONS PERFORMANCE FOUNDATION INSTALLED' AS status;
