-- =============================================================
-- Phase 7D: Selected Candidate -> HRMS Onboarding Employee Bridge
-- Purpose: keep the candidate journey continuous after recruiter selection.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS public.hrms_employee_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.ats_candidate_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.ats_candidate(id) ON DELETE CASCADE,
  candidate_code text,
  lifecycle_stage text NOT NULL DEFAULT 'Candidate Registered',
  lifecycle_status text NOT NULL DEFAULT 'Open',
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  onboarding_id uuid,
  selected_at timestamptz,
  joined_at timestamptz,
  dropped_at timestamptz,
  remarks text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS candidate_id uuid;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS candidate_code text;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'Candidate Registered';
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'Open';
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS onboarding_id uuid;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS selected_at timestamptz;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS joined_at timestamptz;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS dropped_at timestamptz;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.ats_candidate_lifecycle ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ats_candidate_lifecycle_candidate_uq
ON public.ats_candidate_lifecycle(candidate_id);

ALTER TABLE public.ats_candidate_lifecycle ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='ats_candidate_lifecycle'
      AND policyname='authenticated_all_ats_candidate_lifecycle'
  ) THEN
    CREATE POLICY authenticated_all_ats_candidate_lifecycle
    ON public.ats_candidate_lifecycle
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.native_ats_generate_employee_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_try integer := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_code := 'MCN' || lpad(nextval('public.hrms_employee_code_seq')::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_code = v_code);
    IF v_try > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique employee code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.native_ats_convert_selected_candidate_to_employee(
  p_candidate_id uuid,
  p_employee_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.ats_candidate%ROWTYPE;
  v_submission public.ats_recruiter_submission%ROWTYPE;
  v_lifecycle public.ats_candidate_lifecycle%ROWTYPE;
  v_existing_employee public.employees%ROWTYPE;
  v_employee_id uuid;
  v_employee_code text;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_hire_date date;
  v_salary numeric;
  v_offer_salary_text text;
BEGIN
  SELECT * INTO v_candidate
  FROM public.ats_candidate
  WHERE id = p_candidate_id
  LIMIT 1;

  IF v_candidate.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Candidate not found.');
  END IF;

  SELECT * INTO v_submission
  FROM public.ats_recruiter_submission
  WHERE candidate_code = v_candidate.candidate_code
  ORDER BY submitted_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF coalesce(v_submission.final_decision, '') <> 'Selected' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only Selected candidates can be moved to HRMS onboarding.');
  END IF;

  SELECT * INTO v_lifecycle
  FROM public.ats_candidate_lifecycle
  WHERE candidate_id = v_candidate.id
  LIMIT 1;

  IF v_lifecycle.employee_id IS NOT NULL THEN
    SELECT * INTO v_existing_employee FROM public.employees WHERE id = v_lifecycle.employee_id LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyConverted', true,
      'message', 'Candidate is already linked to HRMS onboarding.',
      'employeeId', v_lifecycle.employee_id,
      'employeeCode', v_existing_employee.employee_code
    );
  END IF;

  IF coalesce(v_candidate.email, '') <> '' THEN
    SELECT * INTO v_existing_employee
    FROM public.employees
    WHERE lower(email) = lower(v_candidate.email)
    LIMIT 1;

    IF v_existing_employee.id IS NOT NULL THEN
      INSERT INTO public.ats_candidate_lifecycle (
        candidate_id, candidate_code, lifecycle_stage, lifecycle_status, employee_id, selected_at, remarks, metadata
      ) VALUES (
        v_candidate.id, v_candidate.candidate_code, 'Linked to Existing Employee', 'Open', v_existing_employee.id, coalesce(v_submission.submitted_at, now()),
        'Existing employee matched by email', jsonb_build_object('matched_by','email')
      )
      ON CONFLICT (candidate_id) DO UPDATE SET
        lifecycle_stage = EXCLUDED.lifecycle_stage,
        lifecycle_status = EXCLUDED.lifecycle_status,
        employee_id = EXCLUDED.employee_id,
        selected_at = coalesce(public.ats_candidate_lifecycle.selected_at, EXCLUDED.selected_at),
        remarks = EXCLUDED.remarks,
        metadata = public.ats_candidate_lifecycle.metadata || EXCLUDED.metadata,
        updated_at = now();

      RETURN jsonb_build_object(
        'ok', true,
        'alreadyConverted', true,
        'message', 'Candidate matched with existing employee record.',
        'employeeId', v_existing_employee.id,
        'employeeCode', v_existing_employee.employee_code
      );
    END IF;
  END IF;

  v_full_name := trim(coalesce(v_candidate.full_name, ''));
  v_first_name := nullif(split_part(v_full_name, ' ', 1), '');
  v_last_name := nullif(trim(regexp_replace(v_full_name, '^\S+\s*', '')), '');

  IF v_first_name IS NULL THEN v_first_name := 'Candidate'; END IF;
  IF v_last_name IS NULL THEN v_last_name := 'Profile'; END IF;

  v_employee_code := nullif(trim(coalesce(p_employee_code, '')), '');
  IF v_employee_code IS NULL THEN
    v_employee_code := public.native_ats_generate_employee_code();
  END IF;

  IF EXISTS (SELECT 1 FROM public.employees WHERE employee_code = v_employee_code) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Employee code already exists.');
  END IF;

  v_hire_date := coalesce(v_submission.offer_doj, current_date);

  INSERT INTO public.employees (
    employee_code,
    first_name,
    last_name,
    email,
    phone,
    gender,
    address,
    designation,
    hire_date,
    employment_type,
    status
  ) VALUES (
    v_employee_code,
    v_first_name,
    v_last_name,
    coalesce(nullif(v_candidate.email, ''), lower(v_employee_code) || '@pending.local'),
    nullif(v_candidate.mobile, ''),
    nullif(v_candidate.gender, ''),
    nullif(v_candidate.address, ''),
    coalesce(nullif(v_candidate.role_applied, ''), 'Executive'),
    v_hire_date,
    'full-time',
    'onboarding'
  )
  RETURNING id INTO v_employee_id;

  v_offer_salary_text := trim(coalesce(v_submission.offer_salary, ''));
  IF v_offer_salary_text <> '' THEN
    v_salary := nullif(regexp_replace(v_offer_salary_text, '[^0-9.]', '', 'g'), '')::numeric;
    IF v_salary IS NOT NULL AND v_salary > 0 THEN
      INSERT INTO public.salary_structures (
        employee_id, basic_salary, effective_from
      ) VALUES (
        v_employee_id, v_salary, v_hire_date
      )
      ON CONFLICT (employee_id) DO NOTHING;
    END IF;
  END IF;

  IF v_candidate.resume_url IS NOT NULL THEN
    INSERT INTO public.employee_documents (employee_id, document_type, document_name, file_url)
    VALUES (v_employee_id, 'resume', 'Resume from ATS Candidate Registration', v_candidate.resume_url);
  END IF;

  UPDATE public.ats_candidate
  SET status = 'Selected - Onboarding',
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('hrms_employee_id', v_employee_id, 'hrms_employee_code', v_employee_code)
  WHERE id = v_candidate.id;

  INSERT INTO public.ats_candidate_lifecycle (
    candidate_id, candidate_code, lifecycle_stage, lifecycle_status, employee_id, selected_at, remarks, metadata
  ) VALUES (
    v_candidate.id,
    v_candidate.candidate_code,
    'HRMS Onboarding Created',
    'Open',
    v_employee_id,
    coalesce(v_submission.submitted_at, now()),
    'HRMS employee onboarding record created from selected ATS candidate',
    jsonb_build_object('employee_code', v_employee_code, 'offer_doj', v_submission.offer_doj)
  )
  ON CONFLICT (candidate_id) DO UPDATE SET
    lifecycle_stage = EXCLUDED.lifecycle_stage,
    lifecycle_status = EXCLUDED.lifecycle_status,
    employee_id = EXCLUDED.employee_id,
    selected_at = coalesce(public.ats_candidate_lifecycle.selected_at, EXCLUDED.selected_at),
    remarks = EXCLUDED.remarks,
    metadata = public.ats_candidate_lifecycle.metadata || EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.ats_candidate_status_log (
    candidate_id, old_status, new_status, event_type, event_note, metadata
  ) VALUES (
    v_candidate.id,
    coalesce(v_candidate.status, 'Waiting'),
    'Selected - Onboarding',
    'ATS_TO_HRMS_ONBOARDING',
    'Created HRMS onboarding employee record ' || v_employee_code,
    jsonb_build_object('employee_id', v_employee_id, 'employee_code', v_employee_code)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'HRMS onboarding employee created successfully.',
    'employeeId', v_employee_id,
    'employeeCode', v_employee_code
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$;

COMMIT;

SELECT 'PHASE 7D ATS SELECTED CANDIDATE TO HRMS ONBOARDING BRIDGE INSTALLED' AS status;
