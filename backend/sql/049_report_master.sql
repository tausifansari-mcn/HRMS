USE mas_hrms;

CREATE TABLE IF NOT EXISTS report_master (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  report_code VARCHAR(50) NOT NULL,
  report_name VARCHAR(200) NOT NULL,
  report_category ENUM('branch','user','process','employee','payroll','attendance','kpi','custom') NOT NULL,
  query_key VARCHAR(100) NOT NULL COMMENT 'Named query key used by the reporting service',
  default_filters JSON NULL,
  export_formats JSON NOT NULL DEFAULT '["csv"]',
  admin_only TINYINT(1) NOT NULL DEFAULT 1,
  active_status TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_report_code (report_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO report_master (id, report_code, report_name, report_category, query_key, admin_only) VALUES
  (UUID(), 'BRANCH_MASTER',   'Branch Master Report',        'branch',    'branch_master',   1),
  (UUID(), 'USER_MASTER',     'User & Role Master',          'user',      'user_master',     1),
  (UUID(), 'PROCESS_MASTER',  'Process Master Report',       'process',   'process_master',  1),
  (UUID(), 'ROLE_ACCESS_MAP', 'Role-Page Access Matrix',     'user',      'role_access_map', 1),
  (UUID(), 'CC_HEADCOUNT',    'Call Centre Headcount',       'branch',    'cc_headcount',    1),
  (UUID(), 'EMPLOYEE_DIR',    'Employee Directory',          'employee',  'employee_dir',    1);

SELECT 'Migration 049 applied: report_master seeded with 6 built-in reports' AS status;
