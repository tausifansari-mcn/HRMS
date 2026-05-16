-- =============================================================
-- Phase 7A: Native ATS Candidate Registration Replica
-- Live-schema safe SQL for Supabase
-- Purpose: rebuild Apps Script Candidate Web Form natively in HRMS
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------
-- Storage bucket for candidate files
-- -----------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('ats-candidate-documents', 'ats-candidate-documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ATS candidate documents public read'
  ) THEN
    CREATE POLICY "ATS candidate documents public read"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'ats-candidate-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ATS candidate documents public insert'
  ) THEN
    CREATE POLICY "ATS candidate documents public insert"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'ats-candidate-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ATS candidate documents authenticated update'
  ) THEN
    CREATE POLICY "ATS candidate documents authenticated update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'ats-candidate-documents')
    WITH CHECK (bucket_id = 'ats-candidate-documents');
  END IF;
END $$;

-- -----------------------------
-- Option master for dynamic form choices
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.ats_option_category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL UNIQUE,
  category_name text NOT NULL,
  description text,
  active_status boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ats_option_value (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL REFERENCES public.ats_option_category(category_key) ON DELETE CASCADE,
  option_value text NOT NULL,
  option_label text NOT NULL,
  active_status boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 999,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, option_value)
);

ALTER TABLE public.ats_option_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_option_value ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_option_category' AND policyname='public_read_ats_option_category') THEN
    CREATE POLICY public_read_ats_option_category ON public.ats_option_category FOR SELECT TO public USING (active_status = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_option_value' AND policyname='public_read_ats_option_value') THEN
    CREATE POLICY public_read_ats_option_value ON public.ats_option_value FOR SELECT TO public USING (active_status = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_option_category' AND policyname='authenticated_manage_ats_option_category') THEN
    CREATE POLICY authenticated_manage_ats_option_category ON public.ats_option_category FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_option_value' AND policyname='authenticated_manage_ats_option_value') THEN
    CREATE POLICY authenticated_manage_ats_option_value ON public.ats_option_value FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.ats_option_category (category_key, category_name, display_order)
VALUES
('education','Education',10),
('experience','Experience',20),
('gender','Gender',30),
('roleApplied','Role Applied',40),
('branch','Branch',50),
('preferredShift','Preferred Shift Timing',60),
('nightShiftComfort','Comfortable with night shifts',70)
ON CONFLICT (category_key) DO UPDATE SET category_name = EXCLUDED.category_name, display_order = EXCLUDED.display_order, active_status = true, updated_at = now();

INSERT INTO public.ats_option_value (category_key, option_value, option_label, display_order)
VALUES
('gender','Male','Male',10),
('gender','Female','Female',20),
('gender','Other','Other',30),
('education','10th','10th',10),
('education','12th','12th',20),
('education','Graduate','Graduate',30),
('education','Post Graduate','Post Graduate',40),
('experience','Fresher','Fresher',10),
('experience','Experienced','Experienced',20),
('roleApplied','Executive','Executive',10),
('roleApplied','Customer Support','Customer Support',20),
('branch','Okaya','Okaya',10),
('branch','Trapezoid','Trapezoid',20),
('branch','Jaldarshan','Jaldarshan',30),
('preferredShift','Day Shift','Day Shift',10),
('preferredShift','Night Shift','Night Shift',20),
('preferredShift','Any Shift','Any Shift',30),
('nightShiftComfort','Yes','Yes',10),
('nightShiftComfort','No','No',20)
ON CONFLICT (category_key, option_value) DO UPDATE SET option_label = EXCLUDED.option_label, display_order = EXCLUDED.display_order, active_status = true, updated_at = now();

-- -----------------------------
-- Recruiter master
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.ats_recruiter_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  recruiter_code text,
  pin text,
  recruiter_name text NOT NULL,
  email text,
  mobile text,
  branch_name text,
  available_today boolean NOT NULL DEFAULT true,
  active_status boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_recruiter_profile ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE public.ats_recruiter_profile ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ats_recruiter_profile_code_uq
ON public.ats_recruiter_profile (recruiter_code)
WHERE recruiter_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ats_recruiter_profile_name_branch
ON public.ats_recruiter_profile (lower(recruiter_name), lower(coalesce(branch_name,'')));

ALTER TABLE public.ats_recruiter_profile ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_recruiter_profile' AND policyname='public_read_active_recruiters') THEN
    CREATE POLICY public_read_active_recruiters ON public.ats_recruiter_profile FOR SELECT TO public USING (active_status = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_recruiter_profile' AND policyname='authenticated_manage_recruiters') THEN
    CREATE POLICY authenticated_manage_recruiters ON public.ats_recruiter_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------
-- Candidate master and related tables
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.ats_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code text UNIQUE,
  full_name text,
  mobile text,
  email text,
  address text,
  education text,
  experience text,
  gender text,
  role_applied text,
  recruiter_name text,
  branch_name text,
  rotational_shift text,
  preferred_shift text,
  night_shift_comfort text,
  leaves_required text,
  own_two_wheeler text,
  id_proof_available text,
  education_proof_available text,
  resume_url text,
  resume_path text,
  selfie_url text,
  selfie_path text,
  q_token text,
  walkin_end_stage text,
  status text NOT NULL DEFAULT 'Waiting',
  source_system text NOT NULL DEFAULT 'NATIVE_ATS_CANDIDATE_FORM',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS candidate_code text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS education text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS experience text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS role_applied text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS recruiter_name text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS rotational_shift text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS preferred_shift text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS night_shift_comfort text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS leaves_required text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS own_two_wheeler text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS id_proof_available text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS education_proof_available text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS resume_path text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS selfie_path text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS q_token text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS walkin_end_stage text;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Waiting';
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'NATIVE_ATS_CANDIDATE_FORM';
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ats_candidate ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='ats_candidate'
      AND indexname='ats_candidate_candidate_code_uq'
  ) THEN
    CREATE UNIQUE INDEX ats_candidate_candidate_code_uq
    ON public.ats_candidate(candidate_code)
    WHERE candidate_code IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ats_candidate_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.ats_candidate(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text,
  file_path text,
  file_url text,
  mime_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ats_candidate_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.ats_candidate(id) ON DELETE CASCADE,
  recruiter_profile_id uuid REFERENCES public.ats_recruiter_profile(id) ON DELETE SET NULL,
  recruiter_name text,
  recruiter_email text,
  recruiter_mobile text,
  branch_name text,
  assignment_status text NOT NULL DEFAULT 'Waiting',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS ats_candidate_assignment_candidate_uq
ON public.ats_candidate_assignment (candidate_id);

CREATE TABLE IF NOT EXISTS public.ats_candidate_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.ats_candidate(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  event_type text NOT NULL DEFAULT 'Candidate Registration',
  event_note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.ats_candidate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_candidate_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_candidate_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_candidate_status_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_candidate' AND policyname='public_insert_ats_candidate') THEN
    CREATE POLICY public_insert_ats_candidate ON public.ats_candidate FOR INSERT TO public WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_candidate' AND policyname='authenticated_all_ats_candidate') THEN
    CREATE POLICY authenticated_all_ats_candidate ON public.ats_candidate FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_candidate_document' AND policyname='public_insert_ats_candidate_document') THEN
    CREATE POLICY public_insert_ats_candidate_document ON public.ats_candidate_document FOR INSERT TO public WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_candidate_document' AND policyname='authenticated_all_ats_candidate_document') THEN
    CREATE POLICY authenticated_all_ats_candidate_document ON public.ats_candidate_document FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_candidate_assignment' AND policyname='authenticated_all_ats_candidate_assignment') THEN
    CREATE POLICY authenticated_all_ats_candidate_assignment ON public.ats_candidate_assignment FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ats_candidate_status_log' AND policyname='authenticated_all_ats_candidate_status_log') THEN
    CREATE POLICY authenticated_all_ats_candidate_status_log ON public.ats_candidate_status_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.ats_candidate_seq START 1;

CREATE OR REPLACE FUNCTION public.native_ats_submit_candidate(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required text[] := ARRAY[
    'name','mobile','email','address','education','experience','gender',
    'roleApplied','recruiterName','branch','rotationalShift','preferredShift',
    'nightShiftComfort','leavesRequired','ownTwoWheeler','idProofAvailable','educationProofAvailable'
  ];
  v_key text;
  v_mobile text := regexp_replace(coalesce(payload->>'mobile',''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_candidate_id uuid;
  v_candidate_code text;
  v_seq bigint;
  v_now timestamptz := now();
  v_ms text;
  v_recruiter public.ats_recruiter_profile%ROWTYPE;
BEGIN
  FOREACH v_key IN ARRAY v_required LOOP
    IF length(trim(coalesce(payload->>v_key,''))) = 0 THEN
      RAISE EXCEPTION '% is required.', v_key;
    END IF;
  END LOOP;

  IF v_mobile !~ '^\d{10}$' THEN
    RAISE EXCEPTION 'Enter a valid 10-digit mobile number.';
  END IF;

  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ats_candidate c
    WHERE (c.created_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND (
        regexp_replace(coalesce(c.mobile,''), '\D', '', 'g') = v_mobile
        OR lower(coalesce(c.email,'')) = v_email
      )
  ) THEN
    RAISE EXCEPTION 'You have already submitted today';
  END IF;

  SELECT * INTO v_recruiter
  FROM public.ats_recruiter_profile r
  WHERE lower(trim(r.recruiter_name)) = lower(trim(coalesce(payload->>'recruiterName','')))
    AND lower(trim(coalesce(r.branch_name,''))) = lower(trim(coalesce(payload->>'branch','')))
    AND r.active_status = true
  ORDER BY r.available_today DESC, r.updated_at DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  IF v_recruiter.id IS NULL THEN
    SELECT * INTO v_recruiter
    FROM public.ats_recruiter_profile r
    WHERE lower(trim(r.recruiter_name)) = lower(trim(coalesce(payload->>'recruiterName','')))
      AND r.active_status = true
    ORDER BY r.available_today DESC, r.updated_at DESC NULLS LAST, r.created_at DESC
    LIMIT 1;
  END IF;

  v_seq := nextval('public.ats_candidate_seq');
  v_ms := lpad(floor(extract(milliseconds from v_now))::int::text, 3, '0');
  v_candidate_code := 'C' || to_char(v_now AT TIME ZONE 'Asia/Kolkata','YYYYMMDDHH24MISS') || v_ms || '_R' || v_seq::text;

  INSERT INTO public.ats_candidate (
    candidate_code, q_token, full_name, mobile, email, address, education, experience, gender,
    role_applied, recruiter_name, branch_name, rotational_shift, preferred_shift, night_shift_comfort,
    leaves_required, own_two_wheeler, id_proof_available, education_proof_available, status, walkin_end_stage, metadata
  ) VALUES (
    v_candidate_code, '', trim(payload->>'name'), v_mobile, v_email, trim(payload->>'address'), trim(payload->>'education'),
    trim(payload->>'experience'), trim(payload->>'gender'), trim(payload->>'roleApplied'), trim(payload->>'recruiterName'),
    trim(payload->>'branch'), trim(payload->>'rotationalShift'), trim(payload->>'preferredShift'), trim(payload->>'nightShiftComfort'),
    trim(payload->>'leavesRequired'), trim(payload->>'ownTwoWheeler'), trim(payload->>'idProofAvailable'),
    trim(payload->>'educationProofAvailable'), 'Waiting', 'Arrival', jsonb_build_object('source', 'native_candidate_form')
  ) RETURNING id INTO v_candidate_id;

  INSERT INTO public.ats_candidate_assignment (
    candidate_id, recruiter_profile_id, recruiter_name, recruiter_email, recruiter_mobile, branch_name, assignment_status
  ) VALUES (
    v_candidate_id, v_recruiter.id, coalesce(v_recruiter.recruiter_name, trim(payload->>'recruiterName')),
    coalesce(v_recruiter.email, ''), coalesce(v_recruiter.mobile, ''), coalesce(v_recruiter.branch_name, trim(payload->>'branch')), 'Waiting'
  ) ON CONFLICT (candidate_id) DO UPDATE SET
    recruiter_profile_id = EXCLUDED.recruiter_profile_id,
    recruiter_name = EXCLUDED.recruiter_name,
    recruiter_email = EXCLUDED.recruiter_email,
    recruiter_mobile = EXCLUDED.recruiter_mobile,
    branch_name = EXCLUDED.branch_name,
    assignment_status = EXCLUDED.assignment_status;

  INSERT INTO public.ats_candidate_status_log (candidate_id, old_status, new_status, event_type, event_note, metadata)
  VALUES (v_candidate_id, NULL, 'Waiting', 'Candidate Registration', 'Candidate registered through native ATS candidate form', jsonb_build_object('candidate_code', v_candidate_code));

  RETURN jsonb_build_object(
    'success', true,
    'candidateDbId', v_candidate_id,
    'candidateId', v_candidate_code,
    'recruiterName', coalesce(v_recruiter.recruiter_name, trim(payload->>'recruiterName')),
    'recruiterMobile', coalesce(v_recruiter.mobile, ''),
    'recruiterEmail', coalesce(v_recruiter.email, ''),
    'branch', coalesce(v_recruiter.branch_name, trim(payload->>'branch'))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.native_ats_update_candidate_files(
  p_candidate_id uuid,
  p_resume_path text DEFAULT NULL,
  p_resume_url text DEFAULT NULL,
  p_resume_name text DEFAULT NULL,
  p_resume_mime text DEFAULT NULL,
  p_resume_size bigint DEFAULT NULL,
  p_selfie_path text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_selfie_name text DEFAULT NULL,
  p_selfie_mime text DEFAULT NULL,
  p_selfie_size bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ats_candidate
  SET resume_path = coalesce(p_resume_path, resume_path),
      resume_url = coalesce(p_resume_url, resume_url),
      selfie_path = coalesce(p_selfie_path, selfie_path),
      selfie_url = coalesce(p_selfie_url, selfie_url),
      updated_at = now()
  WHERE id = p_candidate_id;

  IF p_resume_path IS NOT NULL THEN
    INSERT INTO public.ats_candidate_document(candidate_id, document_type, file_name, file_path, file_url, mime_type, file_size)
    VALUES (p_candidate_id, 'RESUME', p_resume_name, p_resume_path, p_resume_url, p_resume_mime, p_resume_size);
  END IF;

  IF p_selfie_path IS NOT NULL THEN
    INSERT INTO public.ats_candidate_document(candidate_id, document_type, file_name, file_path, file_url, mime_type, file_size)
    VALUES (p_candidate_id, 'SELFIE', p_selfie_name, p_selfie_path, p_selfie_url, p_selfie_mime, p_selfie_size);
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

INSERT INTO public.module_master (module_code, module_name, module_group, description, route_prefix, icon_name, display_order, active_status, is_subscription_module)
VALUES ('ATS', 'Applicant Tracking System', 'WORKFORCE', 'Native ATS recruitment workflows', '/ats', 'Users', 20, true, true)
ON CONFLICT (module_code) DO UPDATE SET module_name = EXCLUDED.module_name, module_group = EXCLUDED.module_group, description = EXCLUDED.description, route_prefix = EXCLUDED.route_prefix, icon_name = EXCLUDED.icon_name, display_order = EXCLUDED.display_order, active_status = true, updated_at = now();

INSERT INTO public.page_master (module_code, page_code, page_name, page_description, route_path, open_mode, icon_name, display_order, active_status)
VALUES
('ATS','ATS_CANDIDATE_REGISTRATION','Candidate Registration','Native candidate web form replica','/ats/candidate-registration','internal','UserPlus',10,true),
('ATS','ATS_DASHBOARD','ATS Dashboard','Native ATS dashboard','/ats/dashboard','internal','LayoutDashboard',20,true),
('ATS','ATS_RECRUITER_QUEUE','Recruiter Candidate Queue','Native recruiter queue','/ats/recruiter/my-candidates','internal','ClipboardList',30,true)
ON CONFLICT (page_code) DO UPDATE SET module_code = EXCLUDED.module_code, page_name = EXCLUDED.page_name, page_description = EXCLUDED.page_description, route_path = EXCLUDED.route_path, open_mode = EXCLUDED.open_mode, icon_name = EXCLUDED.icon_name, display_order = EXCLUDED.display_order, active_status = true, updated_at = now();

INSERT INTO public.role_page_access (role_key, page_code, can_view, can_create, can_edit, can_delete, can_export, active_status)
VALUES
('admin','ATS_CANDIDATE_REGISTRATION',true,true,true,true,true,true),
('hr','ATS_CANDIDATE_REGISTRATION',true,true,true,false,true,true),
('manager','ATS_CANDIDATE_REGISTRATION',true,true,false,false,false,true),
('recruiter','ATS_CANDIDATE_REGISTRATION',true,true,false,false,false,true),
('admin','ATS_DASHBOARD',true,true,true,true,true,true),
('hr','ATS_DASHBOARD',true,true,true,false,true,true),
('recruiter','ATS_RECRUITER_QUEUE',true,true,true,false,false,true),
('admin','ATS_RECRUITER_QUEUE',true,true,true,true,true,true),
('hr','ATS_RECRUITER_QUEUE',true,true,true,false,true,true)
ON CONFLICT (role_key, page_code) DO UPDATE SET can_view = EXCLUDED.can_view, can_create = EXCLUDED.can_create, can_edit = EXCLUDED.can_edit, can_delete = EXCLUDED.can_delete, can_export = EXCLUDED.can_export, active_status = true, updated_at = now();

INSERT INTO public.role_module_access (role_key, module_code, can_view, can_manage, active_status)
VALUES
('admin','ATS',true,true,true),
('hr','ATS',true,true,true),
('manager','ATS',true,false,true),
('recruiter','ATS',true,false,true)
ON CONFLICT (role_key, module_code) DO UPDATE SET can_view = EXCLUDED.can_view, can_manage = EXCLUDED.can_manage, active_status = true, updated_at = now();

COMMIT;

SELECT 'PHASE 7A NATIVE ATS CANDIDATE FORM REPLICA INSTALLED' AS status;
