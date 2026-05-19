-- ============================================================
-- Phase 8H: Import Staging Tables and Integration Registry
-- Run after Phase 8G
-- ============================================================
-- Tables created:
--   1. hrms_mysql_sync_staging      — MySQL call-master-backend performance data staging
--   2. hrms_payroll_sync_staging    — External payroll data import staging
--   3. hrms_bgv_staging             — Background verification staging
--   4. hrms_integration_event_log   — Event log for all external integration calls
--   5. hrms_integration_config      — Integration registry / vendor config placeholder
-- ============================================================

-- ── Table 1: MySQL Sync Staging ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hrms_mysql_sync_staging (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id     UUID        NOT NULL,
  source_table    TEXT        NOT NULL,
  record_id       TEXT        NOT NULL,
  raw_data        JSONB       NOT NULL DEFAULT '{}',
  apply_status    TEXT        NOT NULL DEFAULT 'pending',  -- pending, applied, failed, skipped
  error_message   TEXT,
  applied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_table, record_id)
);

ALTER TABLE public.hrms_mysql_sync_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view mysql sync staging" ON public.hrms_mysql_sync_staging;
DROP POLICY IF EXISTS "Admin HR can manage mysql sync staging"    ON public.hrms_mysql_sync_staging;

CREATE POLICY "Authenticated can view mysql sync staging"
  ON public.hrms_mysql_sync_staging FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage mysql sync staging"
  ON public.hrms_mysql_sync_staging FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mysql_sync_staging_sync_run    ON public.hrms_mysql_sync_staging (sync_run_id);
CREATE INDEX IF NOT EXISTS idx_mysql_sync_staging_status      ON public.hrms_mysql_sync_staging (apply_status);
CREATE INDEX IF NOT EXISTS idx_mysql_sync_staging_source      ON public.hrms_mysql_sync_staging (source_table);

-- ── Table 2: Payroll Sync Staging ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hrms_payroll_sync_staging (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID          REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_code   TEXT,
  payroll_month   TEXT          NOT NULL,               -- YYYY-MM format
  gross_salary    NUMERIC(12,2),
  net_salary      NUMERIC(12,2),
  deductions      JSONB         DEFAULT '{}',
  allowances      JSONB         DEFAULT '{}',
  payroll_status  TEXT          NOT NULL DEFAULT 'staged', -- staged, approved, rejected, paid
  source_system   TEXT,
  raw_data        JSONB         DEFAULT '{}',
  staged_by       UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  staged_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  approved_by     UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (employee_code, payroll_month)
);

ALTER TABLE public.hrms_payroll_sync_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view payroll sync staging" ON public.hrms_payroll_sync_staging;
DROP POLICY IF EXISTS "Admin HR can manage payroll sync staging"    ON public.hrms_payroll_sync_staging;

CREATE POLICY "Authenticated can view payroll sync staging"
  ON public.hrms_payroll_sync_staging FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage payroll sync staging"
  ON public.hrms_payroll_sync_staging FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_payroll_staging_employee    ON public.hrms_payroll_sync_staging (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_staging_month       ON public.hrms_payroll_sync_staging (payroll_month);
CREATE INDEX IF NOT EXISTS idx_payroll_staging_status      ON public.hrms_payroll_sync_staging (payroll_status);

-- ── Table 3: BGV Staging ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hrms_bgv_staging (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_code         TEXT,
  vendor_name           TEXT,
  verification_type     TEXT        NOT NULL,  -- education, employment, criminal, identity, address
  bgv_status            TEXT        NOT NULL DEFAULT 'initiated',  -- initiated, in_progress, completed, failed, cleared
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  result_summary        TEXT,
  result_data           JSONB       DEFAULT '{}',
  document_urls         TEXT[]      DEFAULT '{}',
  vendor_reference_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hrms_bgv_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view bgv staging" ON public.hrms_bgv_staging;
DROP POLICY IF EXISTS "Admin HR can manage bgv staging"    ON public.hrms_bgv_staging;

CREATE POLICY "Authenticated can view bgv staging"
  ON public.hrms_bgv_staging FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage bgv staging"
  ON public.hrms_bgv_staging FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_bgv_staging_employee     ON public.hrms_bgv_staging (employee_id);
CREATE INDEX IF NOT EXISTS idx_bgv_staging_status       ON public.hrms_bgv_staging (bgv_status);
CREATE INDEX IF NOT EXISTS idx_bgv_staging_type         ON public.hrms_bgv_staging (verification_type);

-- ── Table 4: Integration Event Log ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hrms_integration_event_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name    TEXT        NOT NULL,  -- dialler, facial_biometric, crm, bgv, sms, whatsapp, payroll, mysql_sync
  event_type          TEXT        NOT NULL,  -- push, pull, webhook, callback
  direction           TEXT        NOT NULL DEFAULT 'outbound',  -- outbound, inbound
  request_payload     JSONB       DEFAULT '{}',
  response_payload    JSONB       DEFAULT '{}',
  http_status         INTEGER,
  event_status        TEXT        NOT NULL DEFAULT 'success',  -- success, failed, pending, retrying
  error_message       TEXT,
  retry_count         INTEGER     NOT NULL DEFAULT 0,
  initiated_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hrms_integration_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view integration event log" ON public.hrms_integration_event_log;
DROP POLICY IF EXISTS "Admin HR can manage integration event log"    ON public.hrms_integration_event_log;

CREATE POLICY "Authenticated can view integration event log"
  ON public.hrms_integration_event_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage integration event log"
  ON public.hrms_integration_event_log FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_integration_event_log_name    ON public.hrms_integration_event_log (integration_name);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_status  ON public.hrms_integration_event_log (event_status);
CREATE INDEX IF NOT EXISTS idx_integration_event_log_created ON public.hrms_integration_event_log (created_at DESC);

-- ── Table 5: Integration Config ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hrms_integration_config (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key   TEXT        NOT NULL UNIQUE,  -- e.g. 'dialler', 'facial_biometric', 'crm', 'bgv', 'sms', 'whatsapp', 'payroll'
  integration_name  TEXT        NOT NULL,
  integration_type  TEXT        NOT NULL,  -- api_push, api_pull, webhook, file_sftp, database
  vendor_name       TEXT,
  base_url          TEXT,
  auth_type         TEXT,                  -- api_key, oauth2, basic, token
  secret_name       TEXT,                  -- Supabase Vault secret name — NOT the actual credential
  config_json       JSONB       DEFAULT '{}',  -- non-sensitive config only
  active_status     BOOLEAN     NOT NULL DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hrms_integration_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view integration config" ON public.hrms_integration_config;
DROP POLICY IF EXISTS "Admin HR can manage integration config"    ON public.hrms_integration_config;

CREATE POLICY "Authenticated can view integration config"
  ON public.hrms_integration_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin HR can manage integration config"
  ON public.hrms_integration_config FOR ALL TO authenticated
  USING (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_integration_config_key    ON public.hrms_integration_config (integration_key);
CREATE INDEX IF NOT EXISTS idx_integration_config_active ON public.hrms_integration_config (active_status);

-- ── Seed: Integration Config Placeholder Rows ─────────────────────────────────
-- Placeholder rows only — no real credentials stored here.
-- Actual secrets must be stored in Supabase Vault; reference them via secret_name.

INSERT INTO public.hrms_integration_config
  (integration_key, integration_name, integration_type, vendor_name, auth_type, notes)
VALUES
  (
    'dialler',
    'Dialler System',
    'api_push',
    NULL,
    'api_key',
    'Outbound dialler integration for call campaign management. Set base_url and secret_name before enabling.'
  ),
  (
    'facial_biometric',
    'Facial Biometric Attendance',
    'api_pull',
    NULL,
    'api_key',
    'Facial recognition device sync for attendance. Set base_url and secret_name before enabling.'
  ),
  (
    'crm',
    'CRM System',
    'api_push',
    NULL,
    'oauth2',
    'CRM integration for employee/agent data sync. Set base_url and secret_name before enabling.'
  ),
  (
    'bgv',
    'Background Verification',
    'api_push',
    NULL,
    'api_key',
    'BGV vendor integration for pre-employment checks. Set vendor_name, base_url and secret_name before enabling.'
  ),
  (
    'sms_gateway',
    'SMS Gateway',
    'api_push',
    NULL,
    'api_key',
    'SMS notification gateway for alerts and OTPs. Set vendor_name, base_url and secret_name before enabling.'
  ),
  (
    'whatsapp_gateway',
    'WhatsApp Gateway',
    'api_push',
    NULL,
    'api_key',
    'WhatsApp Business API gateway for notifications. Set vendor_name, base_url and secret_name before enabling.'
  ),
  (
    'payroll',
    'Payroll System',
    'file_sftp',
    NULL,
    'basic',
    'External payroll system integration for salary data import. Set vendor_name and secret_name before enabling.'
  )
ON CONFLICT (integration_key) DO NOTHING;
