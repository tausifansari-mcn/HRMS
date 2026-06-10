import { db } from "../../db/mysql.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface InterviewAssignment {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_mobile: string;
  candidate_email: string | null;
  interviewer_id: string;
  interviewer_name: string;
  interview_round: number;
  assigned_by: string | null;
  assigned_by_name: string | null;
  assigned_at: string;
  interview_date: string | null;
  interview_time: string | null;
  status: string;
  result: string | null;
  voc: string | null;
  remarks: string | null;
  evidence_url: string | null;
  submitted_at: string | null;
  branch_id: string | null;
  branch_name: string | null;
  process_id: string | null;
  process_name: string | null;
  current_stage: string;
}

export interface SubmitResultInput {
  assignmentId: string;
  result: string; // Selected, Rejected, OnHold
  voc?: string | null;
  remarks: string;
  evidence_url?: string | null;
}

export interface RescheduleInput {
  assignmentId: string;
  newDate: string;
  newTime: string | null;
  reason: string;
}

export class InterviewerService {
  /**
   * Get interviews assigned to an interviewer
   */
  async getMyInterviews(
    interviewerId: string,
    filters?: {
      status?: string;
      date?: string;
      round?: number;
    }
  ): Promise<InterviewAssignment[]> {
    let sql = `
      SELECT
        ia.id,
        ia.candidate_id,
        c.full_name as candidate_name,
        c.mobile as candidate_mobile,
        c.email as candidate_email,
        ia.interviewer_id,
        e.full_name as interviewer_name,
        ia.interview_round,
        ia.assigned_by,
        e2.full_name as assigned_by_name,
        ia.assigned_at,
        ia.interview_date,
        ia.interview_time,
        ia.status,
        ia.result,
        ia.voc,
        ia.remarks,
        ia.evidence_url,
        ia.submitted_at,
        ia.branch_id,
        b.branch_name,
        ia.process_id,
        p.process_name,
        c.current_stage
      FROM ats_interview_assignment ia
      INNER JOIN ats_candidate c ON ia.candidate_id = c.id
      INNER JOIN employees e ON ia.interviewer_id = e.id
      LEFT JOIN employees e2 ON ia.assigned_by = e2.id
      LEFT JOIN branch_master b ON ia.branch_id = b.id
      LEFT JOIN process_master p ON ia.process_id = p.id
      WHERE ia.interviewer_id = ?
    `;

    const params: (string | number)[] = [interviewerId];

    if (filters?.status) {
      sql += " AND ia.status = ?";
      params.push(filters.status);
    }

    if (filters?.date) {
      sql += " AND ia.interview_date = ?";
      params.push(filters.date);
    }

    if (filters?.round) {
      sql += " AND ia.interview_round = ?";
      params.push(filters.round);
    }

    sql += " ORDER BY ia.interview_date DESC, ia.assigned_at DESC";

    const [rows] = await db.execute<RowDataPacket[]>(sql, params);
    return rows as InterviewAssignment[];
  }

  /**
   * Get single interview assignment (with security check)
   */
  async getInterviewById(
    assignmentId: string,
    interviewerId: string
  ): Promise<InterviewAssignment | null> {
    const sql = `
      SELECT
        ia.id,
        ia.candidate_id,
        c.full_name as candidate_name,
        c.mobile as candidate_mobile,
        c.email as candidate_email,
        ia.interviewer_id,
        e.full_name as interviewer_name,
        ia.interview_round,
        ia.assigned_by,
        e2.full_name as assigned_by_name,
        ia.assigned_at,
        ia.interview_date,
        ia.interview_time,
        ia.status,
        ia.result,
        ia.voc,
        ia.remarks,
        ia.evidence_url,
        ia.submitted_at,
        ia.branch_id,
        b.branch_name,
        ia.process_id,
        p.process_name,
        c.current_stage
      FROM ats_interview_assignment ia
      INNER JOIN ats_candidate c ON ia.candidate_id = c.id
      INNER JOIN employees e ON ia.interviewer_id = e.id
      LEFT JOIN employees e2 ON ia.assigned_by = e2.id
      LEFT JOIN branch_master b ON ia.branch_id = b.id
      LEFT JOIN process_master p ON ia.process_id = p.id
      WHERE ia.id = ? AND ia.interviewer_id = ?
    `;

    const [rows] = await db.execute<RowDataPacket[]>(sql, [assignmentId, interviewerId]);
    return rows.length > 0 ? (rows[0] as InterviewAssignment) : null;
  }

  /**
   * Submit interview result
   */
  async submitResult(
    input: SubmitResultInput,
    interviewerId: string
  ): Promise<{ success: boolean; message: string }> {
    // 1. Verify assignment belongs to this interviewer and is not already completed
    const assignment = await this.getInterviewById(input.assignmentId, interviewerId);

    if (!assignment) {
      return { success: false, message: "Interview assignment not found or access denied" };
    }

    if (assignment.status === "Completed") {
      return { success: false, message: "Interview result already submitted" };
    }

    // 2. Validate result enum
    const validResults = ["Selected", "Rejected", "OnHold"];
    if (!validResults.includes(input.result)) {
      return { success: false, message: "Invalid result value" };
    }

    // 3. Update interview assignment
    const updateAssignmentSql = `
      UPDATE ats_interview_assignment
      SET status = 'Completed',
          result = ?,
          voc = ?,
          remarks = ?,
          evidence_url = ?,
          submitted_at = NOW(),
          updated_at = NOW()
      WHERE id = ? AND interviewer_id = ?
    `;

    await db.execute(updateAssignmentSql, [
      input.result,
      input.voc || null,
      input.remarks,
      input.evidence_url || null,
      input.assignmentId,
      interviewerId,
    ]);

    // 4. Update ats_candidate with round result
    const roundField = `round${assignment.interview_round}_result`;
    const vocField = `round${assignment.interview_round}_voc`;
    const remarksField = `round${assignment.interview_round}_remarks`;

    const updateCandidateSql = `
      UPDATE ats_candidate
      SET ${roundField} = ?,
          ${vocField} = ?,
          ${remarksField} = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    await db.execute(updateCandidateSql, [
      input.result,
      input.voc || null,
      input.remarks,
      assignment.candidate_id,
    ]);

    // 5. If rejected, update candidate stage and set rejection_voc
    if (input.result === "Rejected") {
      const updateRejectionSql = `
        UPDATE ats_candidate
        SET current_stage = 'Rejected',
            rejection_voc = ?,
            updated_at = NOW()
        WHERE id = ?
      `;
      await db.execute(updateRejectionSql, [input.voc || null, assignment.candidate_id]);

      // Log stage change
      const logStageSql = `
        INSERT INTO ats_candidate_stage_log
        (id, candidate_id, from_stage, to_stage, stage_date, remarks, updated_by)
        VALUES (UUID(), ?, ?, 'Rejected', NOW(), ?, ?)
      `;
      await db.execute(logStageSql, [
        assignment.candidate_id,
        assignment.current_stage,
        `Rejected in Round ${assignment.interview_round}: ${input.remarks}`,
        interviewerId,
      ]);
    }

    // 6. If selected and this is final round, move to next stage
    if (input.result === "Selected" && assignment.interview_round === 3) {
      const updateSelectedSql = `
        UPDATE ats_candidate
        SET current_stage = 'Selected',
            updated_at = NOW()
        WHERE id = ?
      `;
      await db.execute(updateSelectedSql, [assignment.candidate_id]);

      // Log stage change
      const logStageSql = `
        INSERT INTO ats_candidate_stage_log
        (id, candidate_id, from_stage, to_stage, stage_date, remarks, updated_by)
        VALUES (UUID(), ?, ?, 'Selected', NOW(), ?, ?)
      `;
      await db.execute(logStageSql, [
        assignment.candidate_id,
        assignment.current_stage,
        `Selected after Round ${assignment.interview_round}`,
        interviewerId,
      ]);
    }

    return { success: true, message: "Interview result submitted successfully" };
  }

  /**
   * Mark candidate as no-show
   */
  async markNoShow(
    assignmentId: string,
    interviewerId: string,
    remarks: string
  ): Promise<{ success: boolean; message: string }> {
    // Verify assignment belongs to this interviewer
    const assignment = await this.getInterviewById(assignmentId, interviewerId);

    if (!assignment) {
      return { success: false, message: "Interview assignment not found or access denied" };
    }

    if (assignment.status === "Completed") {
      return { success: false, message: "Cannot mark completed interview as no-show" };
    }

    // Update assignment status
    const updateSql = `
      UPDATE ats_interview_assignment
      SET status = 'NoShow',
          remarks = ?,
          updated_at = NOW()
      WHERE id = ? AND interviewer_id = ?
    `;

    await db.execute(updateSql, [remarks, assignmentId, interviewerId]);

    // Log in stage log
    const logSql = `
      INSERT INTO ats_candidate_stage_log
      (id, candidate_id, from_stage, to_stage, stage_date, remarks, updated_by)
      VALUES (UUID(), ?, ?, ?, NOW(), ?, ?)
    `;
    await db.execute(logSql, [
      assignment.candidate_id,
      assignment.current_stage,
      assignment.current_stage, // Same stage
      `No-show for Round ${assignment.interview_round} interview: ${remarks}`,
      interviewerId,
    ]);

    return { success: true, message: "Candidate marked as no-show" };
  }

  /**
   * Reschedule interview
   */
  async reschedule(
    input: RescheduleInput,
    interviewerId: string
  ): Promise<{ success: boolean; message: string }> {
    // Verify assignment belongs to this interviewer
    const assignment = await this.getInterviewById(input.assignmentId, interviewerId);

    if (!assignment) {
      return { success: false, message: "Interview assignment not found or access denied" };
    }

    if (assignment.status === "Completed") {
      return { success: false, message: "Cannot reschedule completed interview" };
    }

    // Update interview date/time and status
    const updateSql = `
      UPDATE ats_interview_assignment
      SET interview_date = ?,
          interview_time = ?,
          status = 'Rescheduled',
          remarks = CONCAT(IFNULL(remarks, ''), '\\n[Rescheduled]: ', ?),
          updated_at = NOW()
      WHERE id = ? AND interviewer_id = ?
    `;

    await db.execute(updateSql, [
      input.newDate,
      input.newTime || null,
      input.reason,
      input.assignmentId,
      interviewerId,
    ]);

    // Log in stage log
    const logSql = `
      INSERT INTO ats_candidate_stage_log
      (id, candidate_id, from_stage, to_stage, stage_date, remarks, updated_by)
      VALUES (UUID(), ?, ?, ?, NOW(), ?, ?)
    `;
    await db.execute(logSql, [
      assignment.candidate_id,
      assignment.current_stage,
      assignment.current_stage, // Same stage
      `Round ${assignment.interview_round} interview rescheduled to ${input.newDate}: ${input.reason}`,
      interviewerId,
    ]);

    return { success: true, message: "Interview rescheduled successfully" };
  }

  /**
   * Get interview statistics for interviewer dashboard
   */
  async getInterviewerStats(interviewerId: string): Promise<{
    total_assigned: number;
    completed: number;
    pending: number;
    no_show: number;
    today_interviews: number;
  }> {
    const sql = `
      SELECT
        COUNT(*) as total_assigned,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'NoShow' THEN 1 ELSE 0 END) as no_show,
        SUM(CASE WHEN interview_date = CURDATE() THEN 1 ELSE 0 END) as today_interviews
      FROM ats_interview_assignment
      WHERE interviewer_id = ?
    `;

    const [rows] = await db.execute<RowDataPacket[]>(sql, [interviewerId]);
    return rows[0] as any;
  }
}

export const interviewerService = new InterviewerService();
