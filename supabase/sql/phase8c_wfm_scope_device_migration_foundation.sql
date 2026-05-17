-- =============================================================
-- Phase 8C: WFM Scope, Facial Device Sync and External DB Migration Foundation
-- Safe additive SQL. Does not delete existing WFM data.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Soft delete / metadata on shift master
ALTER TABLE public.wfm_shift_master ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.wfm_shift_master ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.wfm_shift_master ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.wfm_shift_master ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.wfm_shift_master ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.wfm_shift_master ADD COLUMN IF NOT EXISTS deletion_reason text;

-- Scope metadata on roster and attendance
ALTER TABLE public.wfm_roster_assignment ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.wfm_roster_assignment ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.wfm_roster_assignment ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.wfm_roster_assignment ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.wfm_roster_assignment ADD COLUMN IF NOT EXISTS team_leader_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.wfm_roster_assignment ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'NATIVE_WFM';

ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS punch_source text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS external_punch_id text;
ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS facial_device_id uuid;
ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS biometric_user_code text;
ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS process_name text;
ALTER TABLE public.wfm_attendance_session ADD COLUMN IF NOT EXISTS team_name text;

ALTER TABLE public.wfm_break_log ADD COLUMN IF NOT EXISTS punch_source text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE public.wfm_break_log ADD COLUMN IF NOT EXISTS external_punch_id text;

-- Role/scope assignment table: Branch Head, Process Manager, Team Leader etc.
CREATE TABLE IF NOT EXISTS public.wfm_user_access_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  role_label text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('all','branch','process','team','employee')),
  scope_value text,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wfm_user_access_scope_user ON public.wfm_user_access_scope(user_id, active_status);
CREATE INDEX IF NOT EXISTS idx_wfm_user_access_scope_employee ON public.wfm_user_access_scope(employee_id, active_status);
CREATE INDEX IF NOT EXISTS idx_wfm_user_access_scope_scope ON public.wfm_user_access_scope(scope_type, lower(coalesce(scope_value,'')));

-- Facial attendance device master/config
CREATE TABLE IF NOT EXISTS public.wfm_facial_device_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code text UNIQUE NOT NULL,
  device_name text NOT NULL,
  branch_name text,
  device_location text,
  vendor_name text,
  api_base_url text,
  api_auth_type text NOT NULL DEFAULT 'API_KEY',
  api_key_secret_name text,
  last_sync_at timestamptz,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wfm_device_sync_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.wfm_facial_device_master(id) ON DELETE SET NULL,
  sync_type text NOT NULL DEFAULT 'PUNCH_PULL',
  sync_status text NOT NULL DEFAULT 'Started',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  rows_received integer NOT NULL DEFAULT 0,
  rows_applied integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Raw punch staging from facial device/API or migrated old DB
CREATE TABLE IF NOT EXISTS public.wfm_external_punch_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid REFERENCES public.wfm_device_sync_run(id) ON DELETE SET NULL,
  source_system text NOT NULL DEFAULT 'FACIAL_DEVICE_API',
  external_punch_id text,
  device_code text,
  biometric_user_code text,
  employee_code text,
  punch_time timestamptz NOT NULL,
  punch_type text NOT NULL DEFAULT 'AUTO' CHECK (punch_type IN ('AUTO','IN','OUT','BREAK_IN','BREAK_OUT')),
  branch_name text,
  process_name text,
  team_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  apply_status text NOT NULL DEFAULT 'Pending',
  apply_error text,
  applied_session_id uuid,
  applied_break_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_system, external_punch_id)
);

CREATE INDEX IF NOT EXISTS idx_wfm_external_punch_staging_status ON public.wfm_external_punch_staging(apply_status, punch_time);
CREATE INDEX IF NOT EXISTS idx_wfm_external_punch_staging_emp_time ON public.wfm_external_punch_staging(employee_code, punch_time);

-- External DB migration connector inventory/staging. Credentials are NOT stored here; store secret names only.
CREATE TABLE IF NOT EXISTS public.wfm_external_db_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text UNIQUE NOT NULL,
  source_name text NOT NULL,
  db_type text NOT NULL DEFAULT 'SQL_SERVER',
  host_name text,
  database_name text,
  connection_secret_name text,
  sync_query_name text,
  active_status boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wfm_legacy_migration_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.wfm_external_db_source(id) ON DELETE SET NULL,
  migration_batch_no text UNIQUE NOT NULL,
  migration_type text NOT NULL DEFAULT 'PUNCH_HISTORY',
  batch_status text NOT NULL DEFAULT 'Draft',
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wfm_legacy_migration_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_batch_id uuid REFERENCES public.wfm_legacy_migration_batch(id) ON DELETE CASCADE,
  source_row_no integer,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'Pending',
  validation_errors text[],
  target_table text,
  target_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper view for UI/reporting
CREATE OR REPLACE VIEW public.wfm_live_tracker_scope_view AS
SELECT
  r.id AS roster_assignment_id,
  r.roster_date,
  r.roster_status,
  r.branch_name,
  r.process_name,
  r.team_name,
  r.manager_employee_id,
  r.team_leader_employee_id,
  e.id AS employee_id,
  e.employee_code,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  s.id AS shift_id,
  s.shift_code,
  s.shift_name,
  s.start_time,
  s.end_time,
  a.id AS attendance_session_id,
  a.login_time,
  a.logout_time,
  a.current_status,
  a.punch_source,
  COALESCE(a.total_login_minutes, 0) AS total_login_minutes,
  COALESCE((
    SELECT SUM(CASE WHEN b.break_end IS NULL THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - b.break_start)) / 60))::integer ELSE b.duration_minutes END)
    FROM public.wfm_break_log b
    WHERE b.session_id = a.id
  ),0) AS total_break_minutes
FROM public.wfm_roster_assignment r
LEFT JOIN public.employees e ON e.id = r.employee_id
LEFT JOIN public.wfm_shift_master s ON s.id = r.shift_id
LEFT JOIN public.wfm_attendance_session a ON a.roster_assignment_id = r.id OR (a.employee_id = r.employee_id AND a.session_date = r.roster_date)
WHERE COALESCE(s.active_status, true) = true
  AND s.deleted_at IS NULL;

-- Apply one punch payload from API/edge function/manual testing into staging.
CREATE OR REPLACE FUNCTION public.native_wfm_stage_external_punch(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.wfm_external_punch_staging (
    source_system,
    external_punch_id,
    device_code,
    biometric_user_code,
    employee_code,
    punch_time,
    punch_type,
    branch_name,
    process_name,
    team_name,
    raw_payload
  ) VALUES (
    COALESCE(NULLIF(p_payload->>'source_system',''), 'FACIAL_DEVICE_API'),
    NULLIF(p_payload->>'external_punch_id',''),
    NULLIF(p_payload->>'device_code',''),
    NULLIF(p_payload->>'biometric_user_code',''),
    NULLIF(p_payload->>'employee_code',''),
    (p_payload->>'punch_time')::timestamptz,
    COALESCE(NULLIF(p_payload->>'punch_type',''), 'AUTO'),
    NULLIF(p_payload->>'branch_name',''),
    NULLIF(p_payload->>'process_name',''),
    NULLIF(p_payload->>'team_name',''),
    p_payload
  )
  ON CONFLICT (source_system, external_punch_id) DO UPDATE SET
    raw_payload = EXCLUDED.raw_payload,
    punch_time = EXCLUDED.punch_time,
    punch_type = EXCLUDED.punch_type,
    apply_status = 'Pending',
    apply_error = NULL
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'stagingId', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$;

-- Convert pending staged punches into sessions/breaks. AUTO means first punch is IN, later punch is OUT.
CREATE OR REPLACE FUNCTION public.native_wfm_apply_pending_punches(p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_employee_id uuid;
  v_session_id uuid;
  v_roster_id uuid;
  v_session_date date;
  v_applied integer := 0;
  v_errors integer := 0;
  v_active_break_id uuid;
BEGIN
  FOR rec IN
    SELECT * FROM public.wfm_external_punch_staging
    WHERE apply_status = 'Pending'
    ORDER BY punch_time ASC
    LIMIT p_limit
  LOOP
    BEGIN
      v_employee_id := NULL;
      v_session_id := NULL;
      v_roster_id := NULL;
      v_active_break_id := NULL;
      v_session_date := (rec.punch_time AT TIME ZONE 'Asia/Kolkata')::date;

      SELECT id INTO v_employee_id
      FROM public.employees
      WHERE employee_code = rec.employee_code
      LIMIT 1;

      IF v_employee_id IS NULL THEN
        RAISE EXCEPTION 'Employee code not found: %', rec.employee_code;
      END IF;

      SELECT id INTO v_roster_id
      FROM public.wfm_roster_assignment
      WHERE employee_id = v_employee_id AND roster_date = v_session_date
      LIMIT 1;

      SELECT id INTO v_session_id
      FROM public.wfm_attendance_session
      WHERE employee_id = v_employee_id AND session_date = v_session_date
      LIMIT 1;

      IF rec.punch_type IN ('IN','AUTO') AND v_session_id IS NULL THEN
        INSERT INTO public.wfm_attendance_session (
          roster_assignment_id, employee_id, session_date, login_time, current_status,
          punch_source, external_punch_id, biometric_user_code, branch_name, process_name, team_name
        ) VALUES (
          v_roster_id, v_employee_id, v_session_date, rec.punch_time, 'On Shift',
          rec.source_system, rec.external_punch_id, rec.biometric_user_code, rec.branch_name, rec.process_name, rec.team_name
        ) RETURNING id INTO v_session_id;
      ELSIF rec.punch_type IN ('OUT','AUTO') AND v_session_id IS NOT NULL THEN
        UPDATE public.wfm_attendance_session
        SET logout_time = rec.punch_time,
            total_login_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (rec.punch_time - login_time)) / 60))::integer,
            current_status = 'Completed',
            punch_source = rec.source_system,
            external_punch_id = COALESCE(external_punch_id, rec.external_punch_id),
            updated_at = now()
        WHERE id = v_session_id;
      ELSIF rec.punch_type = 'BREAK_IN' THEN
        IF v_session_id IS NULL THEN RAISE EXCEPTION 'Session not found before break in'; END IF;
        INSERT INTO public.wfm_break_log (session_id, employee_id, break_start, break_type, punch_source, external_punch_id)
        VALUES (v_session_id, v_employee_id, rec.punch_time, 'Break', rec.source_system, rec.external_punch_id)
        RETURNING id INTO v_active_break_id;
        UPDATE public.wfm_attendance_session SET current_status = 'On Break', updated_at = now() WHERE id = v_session_id;
      ELSIF rec.punch_type = 'BREAK_OUT' THEN
        IF v_session_id IS NULL THEN RAISE EXCEPTION 'Session not found before break out'; END IF;
        SELECT id INTO v_active_break_id FROM public.wfm_break_log WHERE session_id = v_session_id AND break_end IS NULL ORDER BY break_start DESC LIMIT 1;
        IF v_active_break_id IS NULL THEN RAISE EXCEPTION 'Active break not found'; END IF;
        UPDATE public.wfm_break_log
        SET break_end = rec.punch_time,
            duration_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (rec.punch_time - break_start)) / 60))::integer,
            updated_at = now()
        WHERE id = v_active_break_id;
        UPDATE public.wfm_attendance_session SET current_status = 'On Shift', updated_at = now() WHERE id = v_session_id;
      END IF;

      UPDATE public.wfm_external_punch_staging
      SET apply_status = 'Applied', apply_error = NULL, applied_session_id = v_session_id
      WHERE id = rec.id;
      v_applied := v_applied + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.wfm_external_punch_staging
      SET apply_status = 'Error', apply_error = SQLERRM
      WHERE id = rec.id;
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'applied', v_applied, 'errors', v_errors);
END;
$$;

ALTER TABLE public.wfm_user_access_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_facial_device_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_device_sync_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_external_punch_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_external_db_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_legacy_migration_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_legacy_migration_row ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wfm_user_access_scope','wfm_facial_device_master','wfm_device_sync_run','wfm_external_punch_staging',
    'wfm_external_db_source','wfm_legacy_migration_batch','wfm_legacy_migration_row'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='authenticated_all_' || t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'authenticated_all_' || t, t);
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'PHASE 8C WFM SCOPE DEVICE MIGRATION FOUNDATION INSTALLED' AS status;
