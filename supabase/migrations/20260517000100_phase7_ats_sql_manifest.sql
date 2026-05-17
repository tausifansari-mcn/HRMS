-- =============================================================
-- Phase 7 ATS SQL Manifest
-- This migration is a visibility/index manifest for the Phase 7 ATS SQL files.
-- The executable SQL files are stored under supabase/sql for manual Supabase SQL Editor execution.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.native_migration_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_code text NOT NULL UNIQUE,
  file_path text NOT NULL,
  description text NOT NULL,
  execution_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.native_migration_manifest (phase_code, file_path, description, execution_order)
VALUES
('PHASE_7A_ATS_CANDIDATE_FORM', 'supabase/sql/phase7a_ats_candidate_form.sql', 'Native ATS Candidate Registration replica: public form, option master, candidate table support, recruiter assignment and file upload support.', 710),
('PHASE_7B_ATS_RECRUITER_REPAIR', 'supabase/sql/phase7b_repair_existing_ats_recruiter_submission.sql', 'Repair existing ats_recruiter_submission table for missing recruiter app columns such as q_token and previous submission fields.', 720),
('PHASE_7B_ATS_RECRUITER_APP', 'supabase/sql/phase7b_ats_recruiter_app.sql', 'Native Recruiter Mobile App replica: recruiter login, pending candidates, candidate details and recruiter submission RPC.', 730),
('PHASE_7C_ATS_CANDIDATE_JOURNEY', 'supabase/sql/phase7c_ats_candidate_journey_command_center.sql', 'Candidate lifecycle and journey command-center support.', 740),
('PHASE_7D_ATS_TO_HRMS_ONBOARDING', 'supabase/sql/phase7d_ats_selected_candidate_to_hrms_onboarding.sql', 'Selected candidate to HRMS onboarding employee bridge.', 750),
('PHASE_7E_ATS_DASHBOARD_V2', 'supabase/sql/phase7e_ats_dashboard_v2_access_and_validation.sql', 'ATS dashboard route/access and validation SQL.', 760),
('PHASE_7F_ATS_GSHEET_SCHEMA_ALIGNMENT', 'supabase/sql/phase7f_ats_gsheet_exact_schema_alignment.sql', 'Exact ATS GSheet schema alignment: sheet/header map and replica views for Candidates, Queue_View, and Recruiter Submission.', 770),
('PHASE_7_VALIDATION_CHECKLIST', 'supabase/sql/phase7_validation_checklist.sql', 'Validation queries for ATS Phase 7 tables, columns, latest recruiter submissions and onboarding bridge.', 780)
ON CONFLICT (phase_code) DO UPDATE SET
  file_path = EXCLUDED.file_path,
  description = EXCLUDED.description,
  execution_order = EXCLUDED.execution_order;

SELECT 'PHASE 7 ATS SQL MANIFEST INSTALLED - SEE supabase/sql FOR EXECUTABLE FILES' AS status;
