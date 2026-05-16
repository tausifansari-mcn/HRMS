-- =============================================================
-- Phase 7 ATS Validation Checklist
-- Run after Phase 7A, 7B repair, 7B, 7C, and 7D SQL files.
-- =============================================================

SELECT 'ats_candidate' AS table_name, COUNT(*) AS row_count FROM public.ats_candidate
UNION ALL SELECT 'ats_recruiter_profile', COUNT(*) FROM public.ats_recruiter_profile
UNION ALL SELECT 'ats_candidate_assignment', COUNT(*) FROM public.ats_candidate_assignment
UNION ALL SELECT 'ats_recruiter_submission', COUNT(*) FROM public.ats_recruiter_submission
UNION ALL SELECT 'ats_candidate_status_log', COUNT(*) FROM public.ats_candidate_status_log
UNION ALL SELECT 'ats_candidate_lifecycle', COUNT(*) FROM public.ats_candidate_lifecycle
UNION ALL SELECT 'ats_option_category', COUNT(*) FROM public.ats_option_category
UNION ALL SELECT 'ats_option_value', COUNT(*) FROM public.ats_option_value;

-- Verify required recruiter submission columns exist.
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('ats_recruiter_submission','ats_candidate','ats_candidate_lifecycle')
  AND column_name IN (
    'candidate_code','q_token','submitted_at','walkin_end_stage','final_decision',
    'previous_submitted_time','last_walkin_end_stage','last_final_decision',
    'employee_id','lifecycle_stage','lifecycle_status'
  )
ORDER BY table_name, column_name;

-- Latest recruiter submissions with candidate details.
SELECT
  rs.candidate_code,
  c.full_name,
  c.mobile,
  c.branch_name,
  rs.recruiter_name,
  rs.final_decision,
  rs.walkin_end_stage,
  rs.interviewed_for_process,
  rs.submitted_at,
  rs.previous_submitted_time
FROM public.ats_recruiter_submission rs
LEFT JOIN public.ats_candidate c
  ON c.candidate_code = rs.candidate_code
ORDER BY rs.submitted_at DESC
LIMIT 20;

-- Selected candidate onboarding bridge view.
SELECT
  c.candidate_code,
  c.full_name,
  rs.final_decision,
  l.lifecycle_stage,
  l.lifecycle_status,
  l.employee_id,
  l.metadata ->> 'employee_code' AS employee_code
FROM public.ats_candidate c
LEFT JOIN LATERAL (
  SELECT final_decision, submitted_at
  FROM public.ats_recruiter_submission s
  WHERE s.candidate_code = c.candidate_code
  ORDER BY s.submitted_at DESC NULLS LAST
  LIMIT 1
) rs ON true
LEFT JOIN public.ats_candidate_lifecycle l
  ON l.candidate_id = c.id
WHERE rs.final_decision = 'Selected'
ORDER BY rs.submitted_at DESC NULLS LAST;
