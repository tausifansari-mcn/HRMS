-- CI-001 fix: add hash columns alongside the masked display columns on ats_candidate
-- These store SHA-256 digests of the raw PII so deduplication/verification is still possible
-- without storing the original values. The display columns retain masked strings only.
ALTER TABLE ats_candidate
  ADD COLUMN IF NOT EXISTS aadhar_number_hash  CHAR(64)    NULL AFTER aadhar_number,
  ADD COLUMN IF NOT EXISTS pan_number_hash     CHAR(64)    NULL AFTER pan_number,
  ADD COLUMN IF NOT EXISTS bank_account_no_hash CHAR(64)   NULL AFTER bank_account_no;
