-- 099_ats_candidate_uploads.sql
-- Add columns for candidate file uploads (resume, selfie)
USE mas_hrms;

ALTER TABLE ats_candidate
ADD COLUMN IF NOT EXISTS resume_url VARCHAR(500) NULL COMMENT 'URL/path to uploaded resume',
ADD COLUMN IF NOT EXISTS selfie_url VARCHAR(500) NULL COMMENT 'URL/path to uploaded selfie photo';
