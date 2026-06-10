/**
 * Interviewer Module Types
 * Types for interview assignment tracking and result submission
 */

export interface InterviewAssignment {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_mobile: string;
  candidate_email: string | null;
  interviewer_id: string;
  interviewer_name: string;
  interview_round: number; // 1, 2, 3, or 4 (client)
  assigned_by: string | null;
  assigned_by_name: string | null;
  assigned_at: string;
  interview_date: string | null;
  interview_time: string | null;
  status: InterviewStatus;
  result: InterviewResult | null;
  voc: string | null; // Voice of Customer - reason
  remarks: string | null;
  evidence_url: string | null;
  submitted_at: string | null;
  branch_id: string | null;
  branch_name: string | null;
  process_id: string | null;
  process_name: string | null;
  current_stage: string;
}

export type InterviewStatus =
  | "Assigned"
  | "Completed"
  | "NoShow"
  | "Rescheduled"
  | "Cancelled";

export type InterviewResult =
  | "Selected"
  | "Rejected"
  | "OnHold"
  | "Pending";

export interface InterviewStats {
  total_assigned: number;
  completed: number;
  pending: number;
  no_show: number;
  today_interviews: number;
}

export interface SubmitResultRequest {
  assignmentId: string;
  result: InterviewResult;
  voc?: string | null;
  remarks: string;
  evidence_url?: string | null;
}

export interface MarkNoShowRequest {
  assignmentId: string;
  remarks: string;
}

export interface RescheduleRequest {
  assignmentId: string;
  newDate: string; // YYYY-MM-DD
  newTime?: string | null; // HH:MM:SS
  reason: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
}

// Common VOC (Voice of Customer) reasons for selections
export const SELECTION_VOCS = [
  "Strong technical skills",
  "Excellent communication",
  "Good cultural fit",
  "Relevant experience",
  "Quick learner",
  "Strong problem-solving",
  "Team player",
  "Leadership potential",
];

// Common VOC reasons for rejections
export const REJECTION_VOCS = [
  "Poor communication skills",
  "Insufficient technical knowledge",
  "Lack of relevant experience",
  "Attitude concerns",
  "Salary expectations mismatch",
  "Not a cultural fit",
  "Failed technical assessment",
  "Unprofessional behavior",
  "Availability issues",
  "Better candidates available",
];

// Round labels
export const ROUND_LABELS: Record<number, string> = {
  1: "Round 1 (Technical)",
  2: "Round 2 (HR)",
  3: "Round 3 (Final)",
  4: "Client Interview",
};

// Status badge colors
export const STATUS_COLORS: Record<InterviewStatus, string> = {
  Assigned: "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  NoShow: "bg-red-100 text-red-800",
  Rescheduled: "bg-yellow-100 text-yellow-800",
  Cancelled: "bg-gray-100 text-gray-800",
};

// Result badge colors
export const RESULT_COLORS: Record<InterviewResult, string> = {
  Selected: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  OnHold: "bg-yellow-100 text-yellow-800",
  Pending: "bg-gray-100 text-gray-800",
};
