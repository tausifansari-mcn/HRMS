-- Migration 120: Interviewer Workflow
-- Purpose: Add interviewer role and interview assignment tracking
-- Date: 2026-06-10

-- 1. Add interviewer role (branch_head already exists)
INSERT INTO workforce_role_catalog (id, role_key, role_name, description, active_status, created_at)
SELECT UUID(), 'interviewer', 'Interviewer', 'Conducts candidate interviews and submits results', 1, NOW()
WHERE NOT EXISTS (SELECT 1 FROM workforce_role_catalog WHERE role_key = 'interviewer');

-- 2. Add page access for interviewer role
INSERT INTO role_page_access (id, role_key, page_code, can_view, can_create, can_edit, can_delete, can_export)
VALUES
(UUID(), 'interviewer', 'ATS_INTERVIEW_QUEUE', 1, 0, 1, 0, 0),
(UUID(), 'interviewer', 'ATS_INTERVIEW_SUBMIT', 1, 1, 1, 0, 0)
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), can_edit = VALUES(can_edit);

-- 3. Add page access for branch_head (if needed)
INSERT INTO role_page_access (id, role_key, page_code, can_view, can_create, can_edit, can_delete, can_export)
VALUES
(UUID(), 'branch_head', 'ATS_INTERVIEW_APPROVALS', 1, 0, 1, 0, 0)
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), can_edit = VALUES(can_edit);

-- 4. Create interview assignment table
CREATE TABLE IF NOT EXISTS ats_interview_assignment (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  candidate_id CHAR(36) NOT NULL,
  interviewer_id CHAR(36) NOT NULL,
  interview_round TINYINT NOT NULL COMMENT '1=Round1, 2=Round2, 3=Round3, 4=Client',
  assigned_by CHAR(36),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  interview_date DATE,
  interview_time TIME,
  status VARCHAR(50) DEFAULT 'Assigned' COMMENT 'Assigned, Completed, NoShow, Rescheduled, Cancelled',
  result VARCHAR(120) COMMENT 'Selected, Rejected, OnHold, Pending',
  voc VARCHAR(255) COMMENT 'Voice of Customer - rejection/selection reason',
  remarks TEXT,
  evidence_url VARCHAR(500) COMMENT 'Optional evidence/notes document URL',
  submitted_at DATETIME,
  branch_id CHAR(36),
  process_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES ats_candidate(id) ON DELETE CASCADE,
  FOREIGN KEY (interviewer_id) REFERENCES employees(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branch_master(id) ON DELETE SET NULL,
  FOREIGN KEY (process_id) REFERENCES process_master(id) ON DELETE SET NULL,
  INDEX idx_interviewer_status (interviewer_id, status),
  INDEX idx_candidate_round (candidate_id, interview_round),
  INDEX idx_interview_date (interview_date),
  INDEX idx_branch_status (branch_id, status),
  INDEX idx_assigned_at (assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create interview approval log (for branch head approvals)
CREATE TABLE IF NOT EXISTS ats_interview_approval_log (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  assignment_id CHAR(36) NOT NULL,
  candidate_id CHAR(36) NOT NULL,
  approved_by CHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL COMMENT 'Approved, Rejected, SendBack',
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES ats_interview_assignment(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES ats_candidate(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE RESTRICT,
  INDEX idx_assignment (assignment_id),
  INDEX idx_approved_by (approved_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Add indexes to ats_candidate for interview result queries
-- Check and add indexes only if they don't exist
SET @exist_idx1 = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = 'mas_hrms' AND table_name = 'ats_candidate' AND index_name = 'idx_round1_result');
SET @sqlstmt1 = IF(@exist_idx1 = 0, 'ALTER TABLE ats_candidate ADD INDEX idx_round1_result (round1_result)', 'SELECT "Index idx_round1_result already exists"');
PREPARE stmt1 FROM @sqlstmt1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @exist_idx2 = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = 'mas_hrms' AND table_name = 'ats_candidate' AND index_name = 'idx_round2_result');
SET @sqlstmt2 = IF(@exist_idx2 = 0, 'ALTER TABLE ats_candidate ADD INDEX idx_round2_result (round2_result)', 'SELECT "Index idx_round2_result already exists"');
PREPARE stmt2 FROM @sqlstmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @exist_idx3 = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = 'mas_hrms' AND table_name = 'ats_candidate' AND index_name = 'idx_round3_result');
SET @sqlstmt3 = IF(@exist_idx3 = 0, 'ALTER TABLE ats_candidate ADD INDEX idx_round3_result (round3_result)', 'SELECT "Index idx_round3_result already exists"');
PREPARE stmt3 FROM @sqlstmt3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- Migration complete
SELECT 'Migration 120: Interviewer Workflow - COMPLETED' as status;
