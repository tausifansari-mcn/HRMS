-- =============================================================
-- Phase 7B Repair: Existing ats_recruiter_submission Compatibility
-- Run this once if Phase 7B failed with missing q_token or other columns.
-- Then rerun supabase/sql/phase7b_ats_recruiter_app.sql
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ats_recruiter_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS candidate_id uuid;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS candidate_code text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS q_token text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS recruiter_profile_id uuid;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS recruiter_name text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS walkin_end_stage text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round1_result text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round1_voc text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round1_remarks text;

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS skill_typing_score text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS skill_ai_score text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS skill_result text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS skill_voc text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS skill_remarks text;

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round2_result text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round2_voc text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round2_remarks text;

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round3_result text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round3_voc text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS round3_remarks text;

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS final_decision text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS offer_salary text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS offer_doj date;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS reporting_timing time;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS interviewed_for_process text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS ot_details text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS performance_incentives text;

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS previous_submitted_time timestamptz;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS last_walkin_end_stage text;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS last_final_decision text;

ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'NATIVE_ATS_RECRUITER_APP';
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.ats_recruiter_submission ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill candidate_code if an older table used candidate_id_text or similar metadata later.
UPDATE public.ats_recruiter_submission
SET candidate_code = coalesce(candidate_code, '')
WHERE candidate_code IS NULL;

-- Drop old failed/partial index if present, then recreate safely after columns exist.
DROP INDEX IF EXISTS public.ats_recruiter_submission_candidate_token_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ats_recruiter_submission_candidate_token_uq
ON public.ats_recruiter_submission(candidate_code, coalesce(q_token,''));

ALTER TABLE public.ats_recruiter_submission ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ats_recruiter_submission'
      AND policyname = 'authenticated_all_ats_recruiter_submission'
  ) THEN
    CREATE POLICY authenticated_all_ats_recruiter_submission
    ON public.ats_recruiter_submission
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

COMMIT;

SELECT 'PHASE 7B REPAIR COMPLETED - RERUN phase7b_ats_recruiter_app.sql NOW' AS status;
