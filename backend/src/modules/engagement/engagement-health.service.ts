import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

async function tableExists(tableName: string): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function scalar(sql: string, params: unknown[] = [], fallback = 0): Promise<number> {
  try {
    const [rows] = await db.execute<RowDataPacket[]>(sql, params);
    const first = rows[0] ?? {};
    const value = Object.values(first)[0];
    const n = Number(value ?? fallback);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function label(score: number): "highly_engaged" | "stable" | "watchlist" | "attrition_risk" {
  if (score >= 80) return "highly_engaged";
  if (score >= 60) return "stable";
  if (score >= 40) return "watchlist";
  return "attrition_risk";
}

export async function calculateEmployeeEngagementHealth(employeeId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const kudosReceived90d = await scalar(
    `SELECT COUNT(*) AS cnt FROM kudos_transaction WHERE receiver_id = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [employeeId]
  );
  const kudosGiven90d = await scalar(
    `SELECT COUNT(*) AS cnt FROM kudos_transaction WHERE sender_id = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [employeeId]
  );
  const badges180d = await scalar(
    `SELECT COUNT(*) AS cnt FROM employee_badge_earned WHERE employee_id = ? AND earned_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)`,
    [employeeId]
  );
  const surveys90d = await scalar(
    `SELECT COUNT(DISTINCT survey_id) AS cnt FROM survey_response WHERE employee_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [employeeId]
  );
  const pulses90d = await scalar(
    `SELECT COUNT(*) AS cnt FROM pulse_check WHERE employee_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [employeeId]
  );
  const pulseAvg = await scalar(
    `SELECT AVG(mood_score) AS avg_score FROM pulse_check WHERE employee_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`,
    [employeeId],
    3
  );

  let attendanceScore = 70;
  if (await tableExists("attendance_daily_record")) {
    const workedDays = await scalar(
      `SELECT COUNT(*) AS cnt FROM attendance_daily_record WHERE employee_id = ? AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`,
      [employeeId]
    );
    const absentDays = await scalar(
      `SELECT COUNT(*) AS cnt FROM attendance_daily_record WHERE employee_id = ? AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) AND status IN ('absent','Absent','A','LWP')`,
      [employeeId]
    );
    attendanceScore = workedDays > 0 ? clamp(100 - (absentDays / workedDays) * 100) : 70;
  }

  let performanceScore = 70;
  if (await tableExists("management_kpi_summary")) {
    performanceScore = await scalar(
      `SELECT COALESCE(AVG(weighted_score), AVG(score), 70) AS score FROM management_kpi_summary WHERE employee_id = ? AND period >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 3 MONTH), '%Y-%m')`,
      [employeeId],
      70
    );
  }

  const pulseScore = clamp((pulseAvg / 5) * 100);
  const kudosScore = clamp((kudosReceived90d * 8) + (kudosGiven90d * 4) + (badges180d * 10));
  const participationScore = clamp((surveys90d * 15) + (pulses90d * 10));

  const engagementScore = clamp(
    pulseScore * 0.25 +
    attendanceScore * 0.15 +
    kudosScore * 0.15 +
    participationScore * 0.10 +
    performanceScore * 0.15 +
    70 * 0.20
  );

  const riskLabel = label(engagementScore);
  const insight = {
    kudosReceived90d,
    kudosGiven90d,
    badges180d,
    surveys90d,
    pulses90d,
    pulseAvg,
    message: riskLabel === "attrition_risk"
      ? "Low engagement signals detected. HR/manager check-in recommended."
      : riskLabel === "watchlist"
        ? "Watchlist engagement trend. Manager should connect informally."
        : "Engagement signals are acceptable."
  };

  await db.execute(
    `INSERT INTO engagement_health_snapshot
       (id, employee_id, snapshot_date, engagement_score, pulse_score, kudos_score,
        participation_score, attendance_score, performance_score, risk_label, insight_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       engagement_score = VALUES(engagement_score), pulse_score = VALUES(pulse_score),
       kudos_score = VALUES(kudos_score), participation_score = VALUES(participation_score),
       attendance_score = VALUES(attendance_score), performance_score = VALUES(performance_score),
       risk_label = VALUES(risk_label), insight_json = VALUES(insight_json), created_at = NOW()`,
    [randomUUID(), employeeId, today, engagementScore, pulseScore, kudosScore, participationScore, attendanceScore, performanceScore, riskLabel, JSON.stringify(insight)]
  );

  return {
    employee_id: employeeId,
    snapshot_date: today,
    engagement_score: Math.round(engagementScore * 100) / 100,
    pulse_score: Math.round(pulseScore * 100) / 100,
    kudos_score: Math.round(kudosScore * 100) / 100,
    participation_score: Math.round(participationScore * 100) / 100,
    attendance_score: Math.round(attendanceScore * 100) / 100,
    performance_score: Math.round(performanceScore * 100) / 100,
    risk_label: riskLabel,
    insight,
  };
}

export async function getEngagementCommandCenter() {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT e.id AS employee_id,
            CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
            e.employee_code,
            b.branch_name,
            p.process_name,
            hs.engagement_score,
            hs.risk_label,
            hs.snapshot_date,
            hs.insight_json
       FROM engagement_health_snapshot hs
       JOIN employees e ON e.id = hs.employee_id
       LEFT JOIN branch_master b ON b.id = e.branch_id
       LEFT JOIN process_master p ON p.id = e.process_id
      WHERE hs.snapshot_date = (SELECT MAX(snapshot_date) FROM engagement_health_snapshot)
      ORDER BY hs.engagement_score ASC
      LIMIT 100`
  );

  const [summaryRows] = await db.execute<RowDataPacket[]>(
    `SELECT risk_label, COUNT(*) AS count, ROUND(AVG(engagement_score), 2) AS avg_score
       FROM engagement_health_snapshot
      WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM engagement_health_snapshot)
      GROUP BY risk_label`
  );

  const [kudosRows] = await db.execute<RowDataPacket[]>(
    `SELECT kt.kudos_id, kt.sent_at, kt.points_awarded, kt.custom_message,
            CASE WHEN kt.is_anonymous = 1 THEN 'Anonymous' ELSE sender.full_name END AS sender_name,
            receiver.full_name AS receiver_name,
            km.kudos_title, km.kudos_icon, km.kudos_category,
            COALESCE(reactions.reaction_count, 0) AS reaction_count
       FROM kudos_transaction kt
       LEFT JOIN employees sender ON sender.id = kt.sender_id
       LEFT JOIN employees receiver ON receiver.id = kt.receiver_id
       LEFT JOIN kudos_master km ON km.kudos_template_id = kt.kudos_template_id
       LEFT JOIN (SELECT kudos_id, COUNT(*) AS reaction_count FROM kudos_reaction GROUP BY kudos_id) reactions
         ON reactions.kudos_id = kt.kudos_id
      ORDER BY kt.sent_at DESC
      LIMIT 30`
  );

  return { summary: summaryRows, watchlist: rows, kudos_feed: kudosRows };
}

export async function scanEngagementHealth(limit = 500) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id FROM employees WHERE LOWER(COALESCE(employment_status, 'active')) = 'active' LIMIT ?`,
    [limit]
  );
  const results = [];
  for (const row of rows as Array<{ id: string }>) {
    results.push(await calculateEmployeeEngagementHealth(row.id));
  }
  return { scanned: results.length, results };
}
