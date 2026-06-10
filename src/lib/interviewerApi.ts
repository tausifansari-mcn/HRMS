import { hrmsApi } from "./hrmsApi.js";
import type {
  InterviewAssignment,
  InterviewStats,
  SubmitResultRequest,
  MarkNoShowRequest,
  RescheduleRequest,
  ApiResponse,
} from "../types/interviewer.js";

/**
 * Interviewer API Client
 * All endpoints require interviewer role authentication
 */

const BASE_PATH = "/api/ats/interviewer";

export const interviewerApi = {
  /**
   * Get all interviews assigned to the logged-in interviewer
   * @param filters Optional filters: status, date, round
   */
  getMyInterviews: async (filters?: {
    status?: string;
    date?: string;
    round?: number;
  }): Promise<InterviewAssignment[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.date) params.append("date", filters.date);
    if (filters?.round) params.append("round", filters.round.toString());

    const queryString = params.toString();
    const path = `${BASE_PATH}/my-interviews${queryString ? `?${queryString}` : ""}`;

    const response = await hrmsApi.get<ApiResponse<InterviewAssignment[]>>(path);
    return response.data || [];
  },

  /**
   * Get single interview assignment details
   * Security: Only if assigned to logged-in interviewer
   */
  getInterviewById: async (assignmentId: string): Promise<InterviewAssignment> => {
    const response = await hrmsApi.get<ApiResponse<InterviewAssignment>>(
      `${BASE_PATH}/interview/${assignmentId}`
    );
    if (!response.data) {
      throw new Error("Interview assignment not found");
    }
    return response.data;
  },

  /**
   * Submit interview result (Selected/Rejected/OnHold)
   * Security: Only for assigned interviews, cannot modify completed
   */
  submitResult: async (request: SubmitResultRequest): Promise<{ message: string }> => {
    const response = await hrmsApi.post<ApiResponse<void>>(
      `${BASE_PATH}/submit-result`,
      request
    );
    return { message: response.message || "Interview result submitted successfully" };
  },

  /**
   * Mark candidate as no-show for interview
   * Security: Only for assigned interviews
   */
  markNoShow: async (request: MarkNoShowRequest): Promise<{ message: string }> => {
    const response = await hrmsApi.post<ApiResponse<void>>(
      `${BASE_PATH}/mark-noshow`,
      request
    );
    return { message: response.message || "Candidate marked as no-show" };
  },

  /**
   * Reschedule an interview
   * Security: Only for assigned interviews, cannot reschedule completed
   */
  reschedule: async (request: RescheduleRequest): Promise<{ message: string }> => {
    const response = await hrmsApi.post<ApiResponse<void>>(
      `${BASE_PATH}/reschedule`,
      request
    );
    return { message: response.message || "Interview rescheduled successfully" };
  },

  /**
   * Get interview statistics for dashboard
   */
  getStats: async (): Promise<InterviewStats> => {
    const response = await hrmsApi.get<ApiResponse<InterviewStats>>(
      `${BASE_PATH}/stats`
    );
    return response.data || {
      total_assigned: 0,
      completed: 0,
      pending: 0,
      no_show: 0,
      today_interviews: 0,
    };
  },
};
