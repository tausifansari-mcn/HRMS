import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

export const lmsService = {
  async getProgress(employeeId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM lms_learning_progress_snapshot WHERE employee_id = ? ORDER BY synced_at DESC",
      [employeeId]
    );
    return rows as RowDataPacket[];
  },

  async getCertifications(employeeId: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM lms_certification_snapshot WHERE employee_id = ? ORDER BY issued_date DESC",
      [employeeId]
    );
    return rows as RowDataPacket[];
  },

  async listMappings() {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT m.*, e.full_name, e.employee_code
       FROM lms_employee_mapping m
       LEFT JOIN employees e ON e.id = m.employee_id
       WHERE m.is_active = 1
       ORDER BY e.full_name`
    );
    return rows as RowDataPacket[];
  },

  async upsertMapping(employeeId: string, lmsLearnerId: string, email?: string) {
    await db.execute(
      `INSERT INTO lms_employee_mapping (id, employee_id, lms_learner_id, email)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lms_learner_id = VALUES(lms_learner_id), email = VALUES(email)`,
      [randomUUID(), employeeId, lmsLearnerId, email ?? null]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM lms_employee_mapping WHERE employee_id = ? LIMIT 1", [employeeId]
    );
    return (rows as RowDataPacket[])[0];
  },

  async getSyncLog() {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM lms_sync_audit_log ORDER BY created_at DESC LIMIT 100"
    );
    return rows as RowDataPacket[];
  },

  async getProgressSummary() {
    // Aggregate progress stats per employee
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT
         e.id AS employee_id,
         e.employee_code,
         CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS employee_name,
         COUNT(DISTINCT lp.course_id) AS modules_assigned,
         SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) AS modules_completed,
         ROUND(
           (SUM(CASE WHEN lp.status = 'completed' THEN 1 ELSE 0 END) * 100.0) /
           NULLIF(COUNT(DISTINCT lp.course_id), 0),
           0
         ) AS completion_percent,
         COUNT(DISTINCT lc.id) AS certifications_earned,
         MAX(lp.synced_at) AS last_activity
       FROM employees e
       LEFT JOIN lms_employee_mapping lem ON lem.employee_id = e.id AND lem.is_active = 1
       LEFT JOIN lms_learning_progress_snapshot lp ON lp.employee_id = e.id
       LEFT JOIN lms_certification_snapshot lc ON lc.employee_id = e.id
       WHERE e.active_status = 1
       GROUP BY e.id, e.employee_code, e.first_name, e.last_name
       HAVING modules_assigned > 0
       ORDER BY employee_name`
    );
    return rows as RowDataPacket[];
  },
};
