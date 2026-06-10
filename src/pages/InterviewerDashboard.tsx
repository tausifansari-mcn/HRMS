import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { interviewerApi } from "../lib/interviewerApi";
import type { InterviewAssignment, InterviewStats } from "../types/interviewer";
import {
  ROUND_LABELS,
  STATUS_COLORS,
  RESULT_COLORS,
} from "../types/interviewer";

export default function InterviewerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<InterviewStats | null>(null);
  const [interviews, setInterviews] = useState<InterviewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("Assigned");

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [statsData, interviewsData] = await Promise.all([
        interviewerApi.getStats(),
        interviewerApi.getMyInterviews({ status: filterStatus || undefined }),
      ]);
      setStats(statsData);
      setInterviews(interviewsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(assignment: InterviewAssignment) {
    navigate(`/interviewer/submit/${assignment.id}`);
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interviews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Data</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Interviewer Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage your assigned interviews</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <StatsCard
            title="Total Assigned"
            value={stats.total_assigned}
            icon="📋"
            color="blue"
          />
          <StatsCard
            title="Pending"
            value={stats.pending}
            icon="⏳"
            color="yellow"
          />
          <StatsCard
            title="Completed"
            value={stats.completed}
            icon="✅"
            color="green"
          />
          <StatsCard
            title="No Show"
            value={stats.no_show}
            icon="❌"
            color="red"
          />
          <StatsCard
            title="Today"
            value={stats.today_interviews}
            icon="📅"
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
          <div className="flex gap-2">
            {["All", "Assigned", "Completed", "NoShow", "Rescheduled"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status === "All" ? "" : status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === (status === "All" ? "" : status)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interviews Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            My Interviews ({interviews.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        ) : interviews.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg">No interviews found</p>
            <p className="text-sm mt-1">
              {filterStatus
                ? `No interviews with status "${filterStatus}"`
                : "You don't have any assigned interviews yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Round
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Result
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {interviews.map((interview) => (
                  <tr
                    key={interview.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(interview)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {interview.candidate_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {interview.candidate_mobile}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {ROUND_LABELS[interview.interview_round] || `Round ${interview.interview_round}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {interview.interview_date ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {new Date(interview.interview_date).toLocaleDateString()}
                          </div>
                          {interview.interview_time && (
                            <div className="text-sm text-gray-500">
                              {interview.interview_time}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not scheduled</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          STATUS_COLORS[interview.status]
                        }`}
                      >
                        {interview.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {interview.result ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            RESULT_COLORS[interview.result]
                          }`}
                        >
                          {interview.result}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {interview.branch_name || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(interview);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        {interview.status === "Assigned" ? "Submit Result" : "View Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: "blue" | "green" | "yellow" | "red" | "purple";
}

function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`text-4xl ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
