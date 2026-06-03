-- =====================================================
-- Attendance Clock-In/Out Columns
-- File: 070_attendance_clock_columns.sql
-- Description: Additive migration — adds clock-in/out timestamps, work mode
--              and location columns to attendance_daily_record.
--              Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =====================================================

USE mas_hrms;

ALTER TABLE attendance_daily_record
  ADD COLUMN IF NOT EXISTS clock_in_time     DATETIME       NULL AFTER record_date,
  ADD COLUMN IF NOT EXISTS clock_out_time    DATETIME       NULL AFTER clock_in_time,
  ADD COLUMN IF NOT EXISTS work_mode         VARCHAR(50)    NULL DEFAULT 'office' AFTER clock_out_time,
  ADD COLUMN IF NOT EXISTS clock_in_lat      DECIMAL(10,8)  NULL AFTER work_mode,
  ADD COLUMN IF NOT EXISTS clock_in_lng      DECIMAL(11,8)  NULL AFTER clock_in_lat,
  ADD COLUMN IF NOT EXISTS clock_in_location VARCHAR(255)   NULL AFTER clock_in_lng,
  ADD COLUMN IF NOT EXISTS clock_out_lat     DECIMAL(10,8)  NULL AFTER clock_in_location,
  ADD COLUMN IF NOT EXISTS clock_out_lng     DECIMAL(11,8)  NULL AFTER clock_out_lat,
  ADD COLUMN IF NOT EXISTS clock_out_location VARCHAR(255)  NULL AFTER clock_out_lng;
