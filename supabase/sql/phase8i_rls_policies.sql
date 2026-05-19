-- =============================================================
-- Phase 8I: Hard RLS Scope Enforcement — Write Access Lockdown
-- =============================================================
-- IMPORTANT: Run AFTER all data flows are verified working.
-- Run AFTER phases 8G and 8H.
--
-- Strategy:
--   - SELECT policies remain OPEN for all authenticated users
--     (dashboards must not break before scope data is populated).
--   - INSERT / UPDATE / DELETE are RESTRICTED:
--       • Admin/HR (via is_admin_or_hr) → full write access.
--       • Employees → may write only their OWN records on
--         personal tables (wfm_attendance_session, wfm_break_log,
--         lms_content_progress, lms_assessment_attempt).
--       • Master/reference tables → admin/HR only.
-- =============================================================
-- Depends on:
--   public.is_admin_or_hr(uuid) → BOOLEAN  (defined in initial migration)
--   public.employees(id, user_id)           (core employees table)
-- =============================================================

BEGIN;

-- ================================================================
-- HELPER: reusable employee-id lookup shorthand used inline below
-- ================================================================
-- (No helper function needed; we inline the sub-select per policy.)

-- ================================================================
-- 1. MASTER / REFERENCE TABLES
--    SELECT: open to all authenticated
--    ALL writes: admin/HR only
-- ================================================================

-- ----------------------------------------------------------------
-- 1a. employees
--     Existing migration already has granular SELECT + write
--     policies; we only need to harden the write side with 8I
--     naming so the policy is idempotent on re-run.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_employees" ON public.employees;
CREATE POLICY "phase8i_write_employees"
  ON public.employees
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 1b. departments
--     (Existing open "Anyone can view departments" SELECT policy
--     already covers read; we add a scoped write policy.)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_departments" ON public.departments;
CREATE POLICY "phase8i_write_departments"
  ON public.departments
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 1c. process_master
--     Existing policies from 20260516 migration already separate
--     SELECT/write; we add phase8i naming for consistency.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_process_master" ON public.process_master;
CREATE POLICY "phase8i_write_process_master"
  ON public.process_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 1d. branch_master  (created in phase8g)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_branch_master" ON public.branch_master;
CREATE POLICY "phase8i_write_branch_master"
  ON public.branch_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 1e. lob_master  (created in phase8g)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lob_master" ON public.lob_master;
CREATE POLICY "phase8i_write_lob_master"
  ON public.lob_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 1f. designation_master  (created in phase8g)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_designation_master" ON public.designation_master;
CREATE POLICY "phase8i_write_designation_master"
  ON public.designation_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ================================================================
-- 2. WFM OPERATIONAL TABLES
--    SELECT: keep the existing open authenticated_all_ policy
--    INSERT/UPDATE/DELETE:
--      • Admin/HR → full write
--      • Employee → own rows only (via employees.user_id lookup)
-- ================================================================

-- ----------------------------------------------------------------
-- 2a. wfm_attendance_session
--     employee_id FK → employees.id
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_wfm_attendance_session" ON public.wfm_attendance_session;
CREATE POLICY "phase8i_write_wfm_attendance_session"
  ON public.wfm_attendance_session
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 2b. wfm_break_log
--     employee_id FK → employees.id
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_wfm_break_log" ON public.wfm_break_log;
CREATE POLICY "phase8i_write_wfm_break_log"
  ON public.wfm_break_log
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 2c. wfm_roster_assignment
--     Admin/HR only — employees do not self-manage roster
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_wfm_roster_assignment" ON public.wfm_roster_assignment;
CREATE POLICY "phase8i_write_wfm_roster_assignment"
  ON public.wfm_roster_assignment
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 2d. wfm_shift_master
--     Admin/HR only
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_wfm_shift_master" ON public.wfm_shift_master;
CREATE POLICY "phase8i_write_wfm_shift_master"
  ON public.wfm_shift_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ================================================================
-- 3. QUALITY / OPERATIONS / PERFORMANCE TABLES
--    SELECT: open (dashboards rely on this)
--    ALL writes: admin/HR only
-- ================================================================

-- ----------------------------------------------------------------
-- 3a. quality_score_log
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_quality_score_log" ON public.quality_score_log;
CREATE POLICY "phase8i_write_quality_score_log"
  ON public.quality_score_log
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 3b. operations_productivity_log
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_operations_productivity_log" ON public.operations_productivity_log;
CREATE POLICY "phase8i_write_operations_productivity_log"
  ON public.operations_productivity_log
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 3c. performance_target_master
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_performance_target_master" ON public.performance_target_master;
CREATE POLICY "phase8i_write_performance_target_master"
  ON public.performance_target_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ================================================================
-- 4. LMS TABLES
--    SELECT: open (existing authenticated_all_ policy covers this)
--    INSERT/UPDATE/DELETE:
--      • Master/catalog tables (classroom, module, content,
--        certification rules, question bank): admin/HR only
--      • Progress/attempt tables: employee own-row + admin/HR
-- ================================================================

-- ----------------------------------------------------------------
-- 4a. lms_classroom_master — admin/HR only writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_classroom_master" ON public.lms_classroom_master;
CREATE POLICY "phase8i_write_lms_classroom_master"
  ON public.lms_classroom_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 4b. lms_module_master — admin/HR only writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_module_master" ON public.lms_module_master;
CREATE POLICY "phase8i_write_lms_module_master"
  ON public.lms_module_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 4c. lms_content_master — admin/HR only writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_content_master" ON public.lms_content_master;
CREATE POLICY "phase8i_write_lms_content_master"
  ON public.lms_content_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 4d. lms_module_assignment — admin/HR only writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_module_assignment" ON public.lms_module_assignment;
CREATE POLICY "phase8i_write_lms_module_assignment"
  ON public.lms_module_assignment
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 4e. lms_certification_rule_master — admin/HR only writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_certification_rule_master" ON public.lms_certification_rule_master;
CREATE POLICY "phase8i_write_lms_certification_rule_master"
  ON public.lms_certification_rule_master
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 4f. lms_question_bank — admin/HR only writes
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_question_bank" ON public.lms_question_bank;
CREATE POLICY "phase8i_write_lms_question_bank"
  ON public.lms_question_bank
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 4g. lms_content_progress — employee can update own; admin/HR all
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_content_progress" ON public.lms_content_progress;
CREATE POLICY "phase8i_write_lms_content_progress"
  ON public.lms_content_progress
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 4h. lms_assessment_attempt — employee can insert own; admin/HR all
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "phase8i_write_lms_assessment_attempt" ON public.lms_assessment_attempt;
CREATE POLICY "phase8i_write_lms_assessment_attempt"
  ON public.lms_assessment_attempt
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin_or_hr(auth.uid())
    OR employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- ================================================================
-- 5. SCOPE MANAGEMENT TABLES
--    user_assignment_scope: admin/HR writes; users read own row
--    workforce_role_catalog: admin/HR writes only
-- ================================================================

-- ----------------------------------------------------------------
-- 5a. user_assignment_scope
--     Existing authenticated_all_ policy is wide open — replace
--     the write side but keep SELECT open via a separate policy.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_all_user_assignment_scope" ON public.user_assignment_scope;

DROP POLICY IF EXISTS "phase8i_select_user_assignment_scope" ON public.user_assignment_scope;
CREATE POLICY "phase8i_select_user_assignment_scope"
  ON public.user_assignment_scope
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "phase8i_write_user_assignment_scope" ON public.user_assignment_scope;
CREATE POLICY "phase8i_write_user_assignment_scope"
  ON public.user_assignment_scope
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ----------------------------------------------------------------
-- 5b. workforce_role_catalog — admin/HR only
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_all_workforce_role_catalog" ON public.workforce_role_catalog;

DROP POLICY IF EXISTS "phase8i_select_workforce_role_catalog" ON public.workforce_role_catalog;
CREATE POLICY "phase8i_select_workforce_role_catalog"
  ON public.workforce_role_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "phase8i_write_workforce_role_catalog" ON public.workforce_role_catalog;
CREATE POLICY "phase8i_write_workforce_role_catalog"
  ON public.workforce_role_catalog
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- ================================================================
-- END Phase 8I
-- ================================================================

COMMIT;
