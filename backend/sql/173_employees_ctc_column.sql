-- 173_employees_ctc_column.sql
-- Adds CTC (Cost to Company, annual) column to employees table
DROP PROCEDURE IF EXISTS _add_employees_ctc;
DELIMITER $$
CREATE PROCEDURE _add_employees_ctc()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'employees'
      AND COLUMN_NAME  = 'ctc'
  ) THEN
    ALTER TABLE employees
      ADD COLUMN ctc DECIMAL(12,2) NULL DEFAULT NULL
        COMMENT 'Annual Cost to Company (CTC) in INR';
  END IF;
END$$
DELIMITER ;
CALL _add_employees_ctc();
DROP PROCEDURE IF EXISTS _add_employees_ctc;
