-- ============================================================
-- Phase 8G: Bulk Upload Import RPCs
-- 7 import RPCs + generate_upload_batch_no
-- ============================================================
-- Target tables:
--   EMPLOYEE_MASTER   → public.employees        (exists)
--   PROCESS_MASTER    → public.process_master   (exists, added in 20260516)
--   DEPARTMENT_MASTER → public.departments      (exists)
--   ASSET_MASTER      → public.assets           (exists)
--   BRANCH_MASTER     → public.branch_master    (created below if not exists)
--   LOB_MASTER        → public.lob_master       (created below if not exists)
--   DESIGNATION_MASTER→ public.designation_master (created below if not exists)
-- ============================================================

-- ============================================================
-- CREATE MISSING MASTER TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code TEXT NOT NULL UNIQUE,
  branch_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin HR can manage branch master" ON public.branch_master;
DROP POLICY IF EXISTS "Authenticated can view branch master" ON public.branch_master;

CREATE POLICY "Authenticated can view branch master"
  ON public.branch_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage branch master"
  ON public.branch_master FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----

CREATE TABLE IF NOT EXISTS public.lob_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lob_code TEXT NOT NULL UNIQUE,
  lob_name TEXT NOT NULL,
  process_code TEXT,
  process_name TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lob_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin HR can manage lob master" ON public.lob_master;
DROP POLICY IF EXISTS "Authenticated can view lob master" ON public.lob_master;

CREATE POLICY "Authenticated can view lob master"
  ON public.lob_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage lob master"
  ON public.lob_master FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----

CREATE TABLE IF NOT EXISTS public.designation_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_code TEXT NOT NULL UNIQUE,
  designation_name TEXT NOT NULL,
  department_name TEXT,
  level TEXT,
  active_status BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.designation_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin HR can manage designation master" ON public.designation_master;
DROP POLICY IF EXISTS "Authenticated can view designation master" ON public.designation_master;

CREATE POLICY "Authenticated can view designation master"
  ON public.designation_master FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage designation master"
  ON public.designation_master FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_branch_master_active ON public.branch_master(active_status);
CREATE INDEX IF NOT EXISTS idx_lob_master_active ON public.lob_master(active_status);
CREATE INDEX IF NOT EXISTS idx_designation_master_active ON public.designation_master(active_status);

-- ============================================================
-- UPLOAD TEMPLATE ENTRIES for missing types
-- ============================================================

INSERT INTO public.upload_template_master (
  upload_type_code, upload_type_name, target_table, description,
  required_columns, optional_columns, sample_row, validation_rules, active_status
)
VALUES
(
  'PROCESS_MASTER', 'Process Master Upload', 'process_master',
  'Bulk create process master records.',
  to_jsonb(ARRAY['process_code','process_name']::text[]),
  to_jsonb(ARRAY['department_name','process_type','branch_name','location_name','active_status','description']::text[]),
  '{"process_code":"PROC001","process_name":"Inbound Sales","department_name":"Sales","process_type":"inbound","active_status":"true"}'::jsonb,
  '{}'::jsonb, true
),
(
  'BRANCH_MASTER', 'Branch Master Upload', 'branch_master',
  'Bulk create branch master records.',
  to_jsonb(ARRAY['branchcode','branchname']::text[]),
  to_jsonb(ARRAY['city','state','country','active_status','description']::text[]),
  '{"branchcode":"BRN001","branchname":"Delhi Branch","city":"Delhi","country":"India","active_status":"true"}'::jsonb,
  '{}'::jsonb, true
),
(
  'LOB_MASTER', 'LOB Master Upload', 'lob_master',
  'Bulk create Line of Business master records.',
  to_jsonb(ARRAY['lobcode','lobname']::text[]),
  to_jsonb(ARRAY['processcode','processname','active_status','description']::text[]),
  '{"lobcode":"LOB001","lobname":"Retail Banking","processcode":"PROC001","active_status":"true"}'::jsonb,
  '{}'::jsonb, true
),
(
  'DESIGNATION_MASTER', 'Designation Master Upload', 'designation_master',
  'Bulk create designation master records.',
  to_jsonb(ARRAY['designationcode','designationname']::text[]),
  to_jsonb(ARRAY['departmentname','level','active_status','description']::text[]),
  '{"designationcode":"DESIG001","designationname":"Senior Executive","departmentname":"Operations","level":"L3","active_status":"true"}'::jsonb,
  '{}'::jsonb, true
)
ON CONFLICT (upload_type_code) DO UPDATE SET
  upload_type_name = EXCLUDED.upload_type_name,
  target_table = EXCLUDED.target_table,
  description = EXCLUDED.description,
  required_columns = EXCLUDED.required_columns,
  optional_columns = EXCLUDED.optional_columns,
  sample_row = EXCLUDED.sample_row,
  active_status = EXCLUDED.active_status,
  updated_at = now();

-- ============================================================
-- generate_upload_batch_no
-- Already defined in 20260516 migration — this is a safe OR REPLACE
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_upload_batch_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today TEXT := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD');
  v_next  INTEGER;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can create upload batches';
  END IF;

  SELECT COALESCE(
    MAX((regexp_match(upload_batch_no, '^BULK-' || v_today || '-([0-9]+)$'))[1]::INTEGER),
    0
  ) + 1
  INTO v_next
  FROM public.upload_batch
  WHERE upload_batch_no LIKE 'BULK-' || v_today || '-%';

  RETURN 'BULK-' || v_today || '-' || lpad(v_next::TEXT, 4, '0');
END;
$$;

-- ============================================================
-- import_upload_batch  (EMPLOYEE_MASTER)
-- Already defined in 20260516 migration — safe OR REPLACE.
-- Full implementation retained here so phase8g is self-contained.
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch         public.upload_batch%ROWTYPE;
  v_row           public.upload_batch_row%ROWTYPE;
  v_data          JSONB;
  v_errors        TEXT[];
  v_employee_id   UUID;
  v_department_id UUID;
  v_manager_id    UUID;
  v_employee_code TEXT;
  v_first_name    TEXT;
  v_last_name     TEXT;
  v_email         TEXT;
  v_designation   TEXT;
  v_hire_date     DATE;
  v_status        TEXT;
  v_work_start    TIME;
  v_work_end      TIME;
  v_work_days     INT[];
  v_date_of_birth DATE;
  v_imported      INTEGER := 0;
  v_error_rows    INTEGER := 0;
  v_total_valid   INTEGER := 0;
  v_part          TEXT;
  v_text          TEXT;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload batch not found';
  END IF;

  IF v_batch.upload_type_code <> 'EMPLOYEE_MASTER' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Use the dedicated RPC for ' || v_batch.upload_type_code,
      'importedRows', 0, 'errorRows', 0
    );
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_total_valid   := v_total_valid + 1;
    v_data          := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors        := ARRAY[]::TEXT[];
    v_department_id := NULL;
    v_manager_id    := NULL;
    v_employee_id   := NULL;
    v_work_days     := NULL;
    v_date_of_birth := NULL;

    -- Key field extraction (lowercase CSV headers)
    v_employee_code := upper(trim(COALESCE(v_data->>'employeecode', v_data->>'EmployeeCode', '')));
    v_first_name    := trim(COALESCE(v_data->>'firstname', v_data->>'FirstName', ''));
    v_last_name     := trim(COALESCE(v_data->>'lastname', v_data->>'LastName', ''));
    v_email         := lower(trim(COALESCE(v_data->>'email', v_data->>'Email', '')));
    v_designation   := trim(COALESCE(v_data->>'designation', v_data->>'Designation', ''));

    IF v_employee_code = '' THEN v_errors := array_append(v_errors, 'employeecode is required'); END IF;
    IF v_first_name    = '' THEN v_errors := array_append(v_errors, 'firstname is required');     END IF;
    IF v_last_name     = '' THEN v_errors := array_append(v_errors, 'lastname is required');      END IF;
    IF v_email         = '' THEN v_errors := array_append(v_errors, 'email is required');         END IF;
    IF v_email <> '' AND v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
      v_errors := array_append(v_errors, 'email format is invalid');
    END IF;
    IF v_designation = '' THEN v_errors := array_append(v_errors, 'designation is required'); END IF;

    -- HireDate — accept YYYY-MM-DD and DD-MM-YYYY
    BEGIN
      v_text := trim(COALESCE(v_data->>'hiredate', v_data->>'HireDate', ''));
      IF v_text = '' THEN
        v_errors := array_append(v_errors, 'hiredate is required');
      ELSIF v_text ~ '^\d{2}-\d{2}-\d{4}$' THEN
        v_hire_date := to_date(v_text, 'DD-MM-YYYY');
      ELSE
        v_hire_date := v_text::DATE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'hiredate must be YYYY-MM-DD or DD-MM-YYYY');
    END;

    -- Status
    v_status := lower(trim(COALESCE(v_data->>'status', v_data->>'Status', 'active')));
    IF v_status = '' THEN v_status := 'active'; END IF;
    IF v_status NOT IN ('active','inactive','onboarding','offboarded') THEN
      v_errors := array_append(v_errors, 'status must be active, inactive, onboarding, or offboarded');
    END IF;

    -- DOB
    BEGIN
      v_text := trim(COALESCE(v_data->>'dateofbirth', v_data->>'DateOfBirth', ''));
      IF v_text <> '' THEN
        IF v_text ~ '^\d{2}-\d{2}-\d{4}$' THEN
          v_date_of_birth := to_date(v_text, 'DD-MM-YYYY');
        ELSE
          v_date_of_birth := v_text::DATE;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'dateofbirth must be YYYY-MM-DD or DD-MM-YYYY');
    END;

    -- Uniqueness checks
    IF v_employee_code <> '' AND EXISTS (SELECT 1 FROM public.employees WHERE employee_code = v_employee_code) THEN
      v_errors := array_append(v_errors, 'employeecode already exists: ' || v_employee_code);
    END IF;
    IF v_email <> '' AND EXISTS (SELECT 1 FROM public.employees WHERE lower(email) = v_email) THEN
      v_errors := array_append(v_errors, 'email already exists: ' || v_email);
    END IF;

    -- Department lookup
    v_text := trim(COALESCE(v_data->>'department', v_data->>'Department', ''));
    IF v_text <> '' THEN
      SELECT id INTO v_department_id FROM public.departments WHERE lower(name) = lower(v_text) LIMIT 1;
      IF v_department_id IS NULL THEN
        v_errors := array_append(v_errors, 'department not found: ' || v_text);
      END IF;
    END IF;

    -- Manager lookup by code
    v_text := trim(COALESCE(v_data->>'managercode', v_data->>'ManagerCode', ''));
    IF v_text <> '' THEN
      SELECT id INTO v_manager_id FROM public.employees WHERE lower(employee_code) = lower(v_text) LIMIT 1;
      IF v_manager_id IS NULL THEN
        v_errors := array_append(v_errors, 'managercode not found: ' || v_text);
      END IF;
    END IF;

    -- Manager fallback by email
    v_text := lower(trim(COALESCE(v_data->>'manageremail', v_data->>'ManagerEmail', '')));
    IF v_manager_id IS NULL AND v_text <> '' THEN
      SELECT id INTO v_manager_id FROM public.employees WHERE lower(email) = v_text LIMIT 1;
      IF v_manager_id IS NULL THEN
        v_errors := array_append(v_errors, 'manageremail not found: ' || v_text);
      END IF;
    END IF;

    -- Working hours
    BEGIN
      v_text := trim(COALESCE(v_data->>'workinghoursstart', v_data->>'WorkingHoursStart', '09:00'));
      IF v_text = '' THEN v_text := '09:00'; END IF;
      v_work_start := v_text::TIME;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'workinghoursstart must be HH:MM');
    END;

    BEGIN
      v_text := trim(COALESCE(v_data->>'workinghoursend', v_data->>'WorkingHoursEnd', '18:00'));
      IF v_text = '' THEN v_text := '18:00'; END IF;
      v_work_end := v_text::TIME;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'workinghoursend must be HH:MM');
    END;

    -- Working days
    v_text := trim(COALESCE(v_data->>'workingdays', v_data->>'WorkingDays', '1,2,3,4,5'));
    IF v_text <> '' THEN
      v_work_days := ARRAY[]::INT[];
      FOREACH v_part IN ARRAY string_to_array(replace(v_text, ' ', ''), ',') LOOP
        BEGIN
          IF v_part <> '' THEN
            IF v_part::INT < 0 OR v_part::INT > 6 THEN
              v_errors := array_append(v_errors, 'workingdays values must be 0-6');
            ELSE
              v_work_days := array_append(v_work_days, v_part::INT);
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_errors := array_append(v_errors, 'workingdays must be comma-separated numbers 0-6');
        END;
      END LOOP;
    END IF;

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row
      SET row_status = 'error', error_messages = v_errors, updated_at = now()
      WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.employees (
        employee_code, first_name, last_name, email, phone,
        date_of_birth, gender, address, city, country,
        department_id, designation, manager_id, hire_date,
        employment_type, status, working_hours_start, working_hours_end, working_days
      ) VALUES (
        v_employee_code, v_first_name, v_last_name, v_email,
        NULLIF(trim(COALESCE(v_data->>'phone', v_data->>'Phone', '')), ''),
        v_date_of_birth,
        NULLIF(trim(COALESCE(v_data->>'gender', v_data->>'Gender', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'address', v_data->>'Address', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'city', v_data->>'City', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'country', v_data->>'Country', '')), ''),
        v_department_id, v_designation, v_manager_id, v_hire_date,
        NULLIF(trim(COALESCE(v_data->>'employmenttype', v_data->>'EmploymentType', 'full-time')), ''),
        v_status::public.employee_status,
        v_work_start, v_work_end,
        COALESCE(v_work_days, ARRAY[1,2,3,4,5]::INT[])
      )
      RETURNING id INTO v_employee_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_employee_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row
      SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now()
      WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by  = auth.uid(),
    imported_at  = now(),
    error_summary = CASE
      WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
        THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed during import'
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Employee import completed',
    'importedRows', v_imported,
    'errorRows', v_error_rows
  );
END;
$$;

-- ============================================================
-- import_process_upload_batch  (PROCESS_MASTER)
-- Target table: public.process_master
-- CSV: process_code, process_name, department_name, process_type,
--      branch_name, location_name, active_status, description
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_process_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch         public.upload_batch%ROWTYPE;
  v_row           public.upload_batch_row%ROWTYPE;
  v_data          JSONB;
  v_errors        TEXT[];
  v_record_id     UUID;
  v_department_id UUID;
  v_imported      INTEGER := 0;
  v_error_rows    INTEGER := 0;
  v_process_code  TEXT;
  v_process_name  TEXT;
  v_text          TEXT;
  v_active        BOOLEAN;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload batch not found'; END IF;

  IF v_batch.upload_type_code <> 'PROCESS_MASTER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Batch is not PROCESS_MASTER type', 'importedRows', 0, 'errorRows', 0);
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_data          := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors        := ARRAY[]::TEXT[];
    v_department_id := NULL;
    v_record_id     := NULL;

    v_process_code := upper(trim(COALESCE(v_data->>'process_code', v_data->>'ProcessCode', '')));
    v_process_name := trim(COALESCE(v_data->>'process_name', v_data->>'ProcessName', v_data->>'processname', ''));

    IF v_process_code = '' THEN v_errors := array_append(v_errors, 'process_code is required'); END IF;
    IF v_process_name = '' THEN v_errors := array_append(v_errors, 'process_name is required'); END IF;

    IF v_process_code <> '' AND EXISTS (SELECT 1 FROM public.process_master WHERE process_code = v_process_code) THEN
      v_errors := array_append(v_errors, 'process_code already exists: ' || v_process_code);
    END IF;

    -- Department lookup by name
    v_text := trim(COALESCE(v_data->>'department_name', v_data->>'DepartmentName', ''));
    IF v_text <> '' THEN
      SELECT id INTO v_department_id FROM public.departments WHERE lower(name) = lower(v_text) LIMIT 1;
    END IF;

    -- active_status
    v_text := lower(trim(COALESCE(v_data->>'active_status', v_data->>'ActiveStatus', 'true')));
    v_active := (v_text IN ('true', '1', 'yes', 'active'));

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = v_errors, updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.process_master (
        process_code, process_name, department_id, process_type,
        branch_name, location_name, active_status, description,
        created_by, updated_by
      ) VALUES (
        v_process_code, v_process_name, v_department_id,
        NULLIF(trim(COALESCE(v_data->>'process_type', v_data->>'ProcessType', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'branch_name', v_data->>'BranchName', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'location_name', v_data->>'LocationName', '')), ''),
        v_active,
        NULLIF(trim(COALESCE(v_data->>'description', v_data->>'Description', '')), ''),
        auth.uid(), auth.uid()
      )
      RETURNING id INTO v_record_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_record_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by = auth.uid(), imported_at = now(),
    error_summary = CASE WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
      THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed'
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Process import completed', 'importedRows', v_imported, 'errorRows', v_error_rows);
END;
$$;

-- ============================================================
-- import_department_upload_batch  (DEPARTMENT_MASTER)
-- Target table: public.departments
-- CSV: departmentname, description, managercode, manageremail
-- Note: departments.name is the unique column (TEXT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_department_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch     public.upload_batch%ROWTYPE;
  v_row       public.upload_batch_row%ROWTYPE;
  v_data      JSONB;
  v_errors    TEXT[];
  v_record_id UUID;
  v_imported  INTEGER := 0;
  v_error_rows INTEGER := 0;
  v_dept_name TEXT;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload batch not found'; END IF;

  IF v_batch.upload_type_code <> 'DEPARTMENT_MASTER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Batch is not DEPARTMENT_MASTER type', 'importedRows', 0, 'errorRows', 0);
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_data       := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors     := ARRAY[]::TEXT[];
    v_record_id  := NULL;

    v_dept_name := trim(COALESCE(v_data->>'departmentname', v_data->>'DepartmentName', v_data->>'department_name', ''));

    IF v_dept_name = '' THEN
      v_errors := array_append(v_errors, 'departmentname is required');
    ELSIF EXISTS (SELECT 1 FROM public.departments WHERE lower(name) = lower(v_dept_name)) THEN
      v_errors := array_append(v_errors, 'departmentname already exists: ' || v_dept_name);
    END IF;

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = v_errors, updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.departments (name, description)
      VALUES (
        v_dept_name,
        NULLIF(trim(COALESCE(v_data->>'description', v_data->>'Description', '')), '')
      )
      RETURNING id INTO v_record_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_record_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by = auth.uid(), imported_at = now(),
    error_summary = CASE WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
      THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed'
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Department import completed', 'importedRows', v_imported, 'errorRows', v_error_rows);
END;
$$;

-- ============================================================
-- import_asset_upload_batch  (ASSET_MASTER)
-- Target table: public.assets
-- CSV: assetcode, assetname, category, status, serialnumber,
--      purchasedate, purchasecost, vendor, warrantyenddate, notes
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_asset_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch      public.upload_batch%ROWTYPE;
  v_row        public.upload_batch_row%ROWTYPE;
  v_data       JSONB;
  v_errors     TEXT[];
  v_record_id  UUID;
  v_imported   INTEGER := 0;
  v_error_rows INTEGER := 0;
  v_asset_code TEXT;
  v_name       TEXT;
  v_category   TEXT;
  v_status     TEXT;
  v_text       TEXT;
  v_purchase_date     DATE;
  v_warranty_end_date DATE;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload batch not found'; END IF;

  IF v_batch.upload_type_code <> 'ASSET_MASTER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Batch is not ASSET_MASTER type', 'importedRows', 0, 'errorRows', 0);
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_data       := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors     := ARRAY[]::TEXT[];
    v_record_id  := NULL;
    v_purchase_date     := NULL;
    v_warranty_end_date := NULL;

    v_asset_code := upper(trim(COALESCE(v_data->>'assetcode', v_data->>'AssetCode', '')));
    v_name       := trim(COALESCE(v_data->>'assetname', v_data->>'AssetName', v_data->>'name', ''));
    v_category   := trim(COALESCE(v_data->>'category', v_data->>'Category', ''));

    IF v_asset_code = '' THEN v_errors := array_append(v_errors, 'assetcode is required'); END IF;
    IF v_name      = '' THEN v_errors := array_append(v_errors, 'assetname is required');  END IF;
    IF v_category  = '' THEN v_errors := array_append(v_errors, 'category is required');   END IF;

    IF v_asset_code <> '' AND EXISTS (SELECT 1 FROM public.assets WHERE asset_code = v_asset_code) THEN
      v_errors := array_append(v_errors, 'assetcode already exists: ' || v_asset_code);
    END IF;

    -- Status
    v_status := lower(trim(COALESCE(v_data->>'status', v_data->>'Status', 'available')));
    IF v_status = '' THEN v_status := 'available'; END IF;
    IF v_status NOT IN ('available', 'assigned', 'maintenance', 'retired') THEN
      v_errors := array_append(v_errors, 'status must be available, assigned, maintenance, or retired');
    END IF;

    -- Purchase date
    BEGIN
      v_text := trim(COALESCE(v_data->>'purchasedate', v_data->>'PurchaseDate', ''));
      IF v_text <> '' THEN
        IF v_text ~ '^\d{2}-\d{2}-\d{4}$' THEN
          v_purchase_date := to_date(v_text, 'DD-MM-YYYY');
        ELSE
          v_purchase_date := v_text::DATE;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'purchasedate must be YYYY-MM-DD or DD-MM-YYYY');
    END;

    -- Warranty end date
    BEGIN
      v_text := trim(COALESCE(v_data->>'warrantyenddate', v_data->>'WarrantyEndDate', ''));
      IF v_text <> '' THEN
        IF v_text ~ '^\d{2}-\d{2}-\d{4}$' THEN
          v_warranty_end_date := to_date(v_text, 'DD-MM-YYYY');
        ELSE
          v_warranty_end_date := v_text::DATE;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'warrantyenddate must be YYYY-MM-DD or DD-MM-YYYY');
    END;

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = v_errors, updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.assets (
        asset_code, name, category, serial_number,
        purchase_date, purchase_cost, vendor, warranty_end_date, status, notes
      ) VALUES (
        v_asset_code, v_name, v_category,
        NULLIF(trim(COALESCE(v_data->>'serialnumber', v_data->>'SerialNumber', '')), ''),
        v_purchase_date,
        NULLIF(trim(COALESCE(v_data->>'purchasecost', v_data->>'PurchaseCost', '')), '')::DECIMAL(12,2),
        NULLIF(trim(COALESCE(v_data->>'vendor', v_data->>'Vendor', '')), ''),
        v_warranty_end_date,
        v_status::public.asset_status,
        NULLIF(trim(COALESCE(v_data->>'notes', v_data->>'Notes', '')), '')
      )
      RETURNING id INTO v_record_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_record_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by = auth.uid(), imported_at = now(),
    error_summary = CASE WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
      THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed'
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Asset import completed', 'importedRows', v_imported, 'errorRows', v_error_rows);
END;
$$;

-- ============================================================
-- import_branch_upload_batch  (BRANCH_MASTER)
-- Target table: public.branch_master
-- CSV: branchcode, branchname, city, state, country, active_status, description
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_branch_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch      public.upload_batch%ROWTYPE;
  v_row        public.upload_batch_row%ROWTYPE;
  v_data       JSONB;
  v_errors     TEXT[];
  v_record_id  UUID;
  v_imported   INTEGER := 0;
  v_error_rows INTEGER := 0;
  v_branch_code TEXT;
  v_branch_name TEXT;
  v_active      BOOLEAN;
  v_text        TEXT;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload batch not found'; END IF;

  IF v_batch.upload_type_code <> 'BRANCH_MASTER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Batch is not BRANCH_MASTER type', 'importedRows', 0, 'errorRows', 0);
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_data       := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors     := ARRAY[]::TEXT[];
    v_record_id  := NULL;

    v_branch_code := upper(trim(COALESCE(v_data->>'branchcode', v_data->>'BranchCode', '')));
    v_branch_name := trim(COALESCE(v_data->>'branchname', v_data->>'BranchName', ''));

    IF v_branch_code = '' THEN v_errors := array_append(v_errors, 'branchcode is required'); END IF;
    IF v_branch_name = '' THEN v_errors := array_append(v_errors, 'branchname is required'); END IF;

    IF v_branch_code <> '' AND EXISTS (SELECT 1 FROM public.branch_master WHERE branch_code = v_branch_code) THEN
      v_errors := array_append(v_errors, 'branchcode already exists: ' || v_branch_code);
    END IF;

    v_text   := lower(trim(COALESCE(v_data->>'active_status', v_data->>'ActiveStatus', 'true')));
    v_active := (v_text IN ('true', '1', 'yes', 'active'));

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = v_errors, updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.branch_master (
        branch_code, branch_name, city, state, country, active_status, description, created_by, updated_by
      ) VALUES (
        v_branch_code, v_branch_name,
        NULLIF(trim(COALESCE(v_data->>'city', v_data->>'City', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'state', v_data->>'State', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'country', v_data->>'Country', '')), ''),
        v_active,
        NULLIF(trim(COALESCE(v_data->>'description', v_data->>'Description', '')), ''),
        auth.uid(), auth.uid()
      )
      RETURNING id INTO v_record_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_record_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by = auth.uid(), imported_at = now(),
    error_summary = CASE WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
      THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed'
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Branch import completed', 'importedRows', v_imported, 'errorRows', v_error_rows);
END;
$$;

-- ============================================================
-- import_lob_upload_batch  (LOB_MASTER)
-- Target table: public.lob_master
-- CSV: lobcode, lobname, processcode, processname, active_status, description
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_lob_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch      public.upload_batch%ROWTYPE;
  v_row        public.upload_batch_row%ROWTYPE;
  v_data       JSONB;
  v_errors     TEXT[];
  v_record_id  UUID;
  v_imported   INTEGER := 0;
  v_error_rows INTEGER := 0;
  v_lob_code   TEXT;
  v_lob_name   TEXT;
  v_active     BOOLEAN;
  v_text       TEXT;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload batch not found'; END IF;

  IF v_batch.upload_type_code <> 'LOB_MASTER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Batch is not LOB_MASTER type', 'importedRows', 0, 'errorRows', 0);
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_data      := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors    := ARRAY[]::TEXT[];
    v_record_id := NULL;

    v_lob_code := upper(trim(COALESCE(v_data->>'lobcode', v_data->>'LobCode', v_data->>'LOBCode', '')));
    v_lob_name := trim(COALESCE(v_data->>'lobname', v_data->>'LobName', v_data->>'LOBName', ''));

    IF v_lob_code = '' THEN v_errors := array_append(v_errors, 'lobcode is required'); END IF;
    IF v_lob_name = '' THEN v_errors := array_append(v_errors, 'lobname is required'); END IF;

    IF v_lob_code <> '' AND EXISTS (SELECT 1 FROM public.lob_master WHERE lob_code = v_lob_code) THEN
      v_errors := array_append(v_errors, 'lobcode already exists: ' || v_lob_code);
    END IF;

    v_text   := lower(trim(COALESCE(v_data->>'active_status', v_data->>'ActiveStatus', 'true')));
    v_active := (v_text IN ('true', '1', 'yes', 'active'));

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = v_errors, updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.lob_master (
        lob_code, lob_name, process_code, process_name,
        active_status, description, created_by, updated_by
      ) VALUES (
        v_lob_code, v_lob_name,
        NULLIF(upper(trim(COALESCE(v_data->>'processcode', v_data->>'ProcessCode', ''))), ''),
        NULLIF(trim(COALESCE(v_data->>'processname', v_data->>'ProcessName', '')), ''),
        v_active,
        NULLIF(trim(COALESCE(v_data->>'description', v_data->>'Description', '')), ''),
        auth.uid(), auth.uid()
      )
      RETURNING id INTO v_record_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_record_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by = auth.uid(), imported_at = now(),
    error_summary = CASE WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
      THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed'
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'message', 'LOB import completed', 'importedRows', v_imported, 'errorRows', v_error_rows);
END;
$$;

-- ============================================================
-- import_designation_upload_batch  (DESIGNATION_MASTER)
-- Target table: public.designation_master
-- CSV: designationcode, designationname, departmentname, level, active_status, description
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_designation_upload_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch          public.upload_batch%ROWTYPE;
  v_row            public.upload_batch_row%ROWTYPE;
  v_data           JSONB;
  v_errors         TEXT[];
  v_record_id      UUID;
  v_imported       INTEGER := 0;
  v_error_rows     INTEGER := 0;
  v_desig_code     TEXT;
  v_desig_name     TEXT;
  v_active         BOOLEAN;
  v_text           TEXT;
BEGIN
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin/HR can import upload batches';
  END IF;

  SELECT * INTO v_batch FROM public.upload_batch WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload batch not found'; END IF;

  IF v_batch.upload_type_code <> 'DESIGNATION_MASTER' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Batch is not DESIGNATION_MASTER type', 'importedRows', 0, 'errorRows', 0);
  END IF;

  UPDATE public.upload_batch
  SET batch_status = 'importing', imported_by = auth.uid(), updated_at = now()
  WHERE id = p_batch_id;

  FOR v_row IN
    SELECT * FROM public.upload_batch_row
    WHERE upload_batch_id = p_batch_id AND row_status IN ('valid', 'pending')
    ORDER BY row_no
  LOOP
    v_data      := COALESCE(v_row.normalized_data, v_row.raw_data, '{}'::jsonb);
    v_errors    := ARRAY[]::TEXT[];
    v_record_id := NULL;

    v_desig_code := upper(trim(COALESCE(v_data->>'designationcode', v_data->>'DesignationCode', '')));
    v_desig_name := trim(COALESCE(v_data->>'designationname', v_data->>'DesignationName', ''));

    IF v_desig_code = '' THEN v_errors := array_append(v_errors, 'designationcode is required'); END IF;
    IF v_desig_name = '' THEN v_errors := array_append(v_errors, 'designationname is required'); END IF;

    IF v_desig_code <> '' AND EXISTS (SELECT 1 FROM public.designation_master WHERE designation_code = v_desig_code) THEN
      v_errors := array_append(v_errors, 'designationcode already exists: ' || v_desig_code);
    END IF;

    v_text   := lower(trim(COALESCE(v_data->>'active_status', v_data->>'ActiveStatus', 'true')));
    v_active := (v_text IN ('true', '1', 'yes', 'active'));

    IF array_length(v_errors, 1) IS NOT NULL THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = v_errors, updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.designation_master (
        designation_code, designation_name, department_name, level,
        active_status, description, created_by, updated_by
      ) VALUES (
        v_desig_code, v_desig_name,
        NULLIF(trim(COALESCE(v_data->>'departmentname', v_data->>'DepartmentName', '')), ''),
        NULLIF(trim(COALESCE(v_data->>'level', v_data->>'Level', '')), ''),
        v_active,
        NULLIF(trim(COALESCE(v_data->>'description', v_data->>'Description', '')), ''),
        auth.uid(), auth.uid()
      )
      RETURNING id INTO v_record_id;

      UPDATE public.upload_batch_row
      SET row_status = 'imported', target_record_id = v_record_id,
          error_messages = ARRAY[]::TEXT[], updated_at = now()
      WHERE id = v_row.id;
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.upload_batch_row SET row_status = 'error', error_messages = ARRAY[SQLERRM], updated_at = now() WHERE id = v_row.id;
      v_error_rows := v_error_rows + 1;
    END;
  END LOOP;

  UPDATE public.upload_batch SET
    imported_rows = v_imported,
    error_rows    = (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error'),
    batch_status  = CASE
      WHEN v_imported > 0 AND (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0 THEN 'imported_with_errors'
      WHEN v_imported > 0 THEN 'imported'
      ELSE 'failed'
    END,
    imported_by = auth.uid(), imported_at = now(),
    error_summary = CASE WHEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error') > 0
      THEN (SELECT COUNT(*) FROM public.upload_batch_row WHERE upload_batch_id = p_batch_id AND row_status = 'error')::TEXT || ' row(s) failed'
      ELSE NULL END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Designation import completed', 'importedRows', v_imported, 'errorRows', v_error_rows);
END;
$$;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT EXECUTE ON FUNCTION public.generate_upload_batch_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_upload_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_process_upload_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_department_upload_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_asset_upload_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_branch_upload_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_lob_upload_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_designation_upload_batch(UUID) TO authenticated;
