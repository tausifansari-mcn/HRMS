-- 012_roster_shift_times.sql
-- Add per-assignment shift override times so CSV upload can set individual
-- start/end times without touching the shift master.
USE mas_hrms;

ALTER TABLE wfm_roster_assignment
  ADD COLUMN IF NOT EXISTS shift_start_time VARCHAR(5)  NULL COMMENT 'HH:MM override, NULL = use shift master' AFTER roster_status,
  ADD COLUMN IF NOT EXISTS shift_end_time   VARCHAR(5)  NULL COMMENT 'HH:MM override, NULL = use shift master' AFTER shift_start_time;
