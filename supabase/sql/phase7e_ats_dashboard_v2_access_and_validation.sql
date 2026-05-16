-- =============================================================
-- Phase 7E: ATS Dashboard v2 Access + Validation
-- Dashboard route: /ats/dashboard
-- =============================================================

BEGIN;

INSERT INTO public.page_master (module_code, page_code, page_name, page_description, route_path, open_mode, icon_name, display_order, active_status)
VALUES
('ATS','ATS_DASHBOARD','ATS Dashboard v2','FTD/WTD/MTD recruitment funnel, recruiter productivity, SLA breach, source funnel and candidate journey drilldown','/ats/dashboard','internal','LayoutDashboard',20,true)
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
('admin','ATS_DASHBOARD',true,true,true,true,true,true),
('hr','ATS_DASHBOARD',true,true,true,false,true,true),
('manager','ATS_DASHBOARD',true,false,false,false,true,true),
('recruiter','ATS_DASHBOARD',true,false,false,false,false,true)
ON CONFLICT (role_key, page_code) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_export = EXCLUDED.can_export,
  active_status = true,
  updated_at = now();

COMMIT;

-- Dashboard validation snapshot.
SELECT
  'ATS Dashboard v2 validation' AS section,
  COUNT(*) AS total_candidates,
  COUNT(*) FILTER (WHERE created_at::date = current_date) AS ftd_candidates,
  COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', current_date)) AS mtd_candidates
FROM public.ats_candidate;

SELECT
  COALESCE(rs.recruiter_name, 'Unassigned') AS recruiter_name,
  COUNT(*) AS submissions,
  COUNT(*) FILTER (WHERE rs.final_decision = 'Selected') AS selected,
  COUNT(*) FILTER (WHERE rs.final_decision = 'Client Round - Pending') AS client_pending,
  COUNT(*) FILTER (WHERE rs.final_decision IN ('Rejected','No Show')) AS rejected_or_no_show
FROM public.ats_recruiter_submission rs
GROUP BY COALESCE(rs.recruiter_name, 'Unassigned')
ORDER BY submissions DESC;

SELECT 'PHASE 7E ATS DASHBOARD V2 ACCESS + VALIDATION INSTALLED' AS status;
