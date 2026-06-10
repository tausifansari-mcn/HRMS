import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { interviewerApi } from "../lib/interviewerApi";
import type { InterviewAssignment, InterviewResult } from "../types/interviewer";
import { ROUND_LABELS, SELECTION_VOCS, REJECTION_VOCS } from "../types/interviewer";

export default function InterviewSubmitResult() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const [interview, setInterview] = useState<InterviewAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<InterviewResult>("Selected");
  const [voc, setVoc] = useState("");
  const [remarks, setRemarks] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  useEffect(() => {
    if (assignmentId) {
      loadInterview();
    }
  }, [assignmentId]);

  async function loadInterview() {
    try {
      setLoading(true);
      setError(null);
      const data = await interviewerApi.getInterviewById(assignmentId!);
      setInterview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interview");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!interview) return;

    if (remarks.length < 10) {
      setError("Remarks must be at least 10 characters");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await interviewerApi.submitResult({
        assignmentId: interview.id,
        result,
        voc: voc || null,
        remarks,
        evidence_url: evidenceUrl || null,
      });
      alert("Interview result submitted successfully!");
      navigate("/interviewer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit result");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNoShow() {
    if (!interview) return;
    const reason = prompt("Please provide a reason for marking as no-show:");
    if (!reason || reason.length < 10) {
      alert("Reason must be at least 10 characters");
      return;
    }

    try {
      setSubmitting(true);
      await interviewerApi.markNoShow({ assignmentId: interview.id, remarks: reason });
      alert("Candidate marked as no-show");
      navigate("/interviewer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark no-show");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReschedule() {
    if (!interview) return;
    const newDate = prompt("New date (YYYY-MM-DD):");
    if (!newDate) return;

    const reason = prompt("Reason for rescheduling:");
    if (!reason || reason.length < 10) {
      alert("Reason must be at least 10 characters");
      return;
    }

    try {
      setSubmitting(true);
      await interviewerApi.reschedule({
        assignmentId: interview.id,
        newDate,
        newTime: null,
        reason,
      });
      alert("Interview rescheduled successfully");
      navigate("/interviewer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interview details...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate("/interviewer/dashboard")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!interview) return null;

  const isCompleted = interview.status === "Completed";
  const vocOptions = result === "Rejected" ? REJECTION_VOCS : SELECTION_VOCS;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/interviewer/dashboard")}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isCompleted ? "Interview Details" : "Submit Interview Result"}
          </h1>
        </div>

        {/* Interview Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Interview Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Candidate" value={interview.candidate_name} />
            <InfoField label="Mobile" value={interview.candidate_mobile} />
            <InfoField label="Round" value={ROUND_LABELS[interview.interview_round]} />
            <InfoField label="Status" value={interview.status} />
            <InfoField label="Date" value={interview.interview_date ? new Date(interview.interview_date).toLocaleDateString() : "Not scheduled"} />
            <InfoField label="Time" value={interview.interview_time || "Not specified"} />
            <InfoField label="Branch" value={interview.branch_name || "-"} />
            <InfoField label="Process" value={interview.process_name || "-"} />
          </div>
        </div>

        {isCompleted ? (
          /* View Mode */
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Submitted Result</h2>
            <div className="space-y-4">
              <InfoField label="Result" value={interview.result || "Pending"} />
              <InfoField label="VOC" value={interview.voc || "-"} />
              <InfoField label="Remarks" value={interview.remarks || "-"} />
              {interview.evidence_url && (
                <InfoField label="Evidence URL" value={interview.evidence_url} />
              )}
              <InfoField label="Submitted At" value={interview.submitted_at ? new Date(interview.submitted_at).toLocaleString() : "-"} />
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <>
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Submit Result</h2>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Result */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Result *
                  </label>
                  <div className="flex gap-4">
                    {["Selected", "Rejected", "OnHold"].map((r) => (
                      <label key={r} className="flex items-center">
                        <input
                          type="radio"
                          name="result"
                          value={r}
                          checked={result === r}
                          onChange={(e) => setResult(e.target.value as InterviewResult)}
                          className="mr-2"
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* VOC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice of Customer (Reason)
                  </label>
                  <select
                    value={voc}
                    onChange={(e) => setVoc(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select a reason (optional)</option>
                    {vocOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks * (min 10 characters)
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={4}
                    required
                    minLength={10}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Provide detailed feedback about the candidate's performance..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {remarks.length} / 10 characters minimum
                  </p>
                </div>

                {/* Evidence URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Evidence URL (optional)
                  </label>
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://..."
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Result"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/interviewer/dashboard")}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>

            {/* Other Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Other Actions</h2>
              <div className="flex gap-3">
                <button
                  onClick={handleNoShow}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Mark as No-Show
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={submitting}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  Reschedule Interview
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="font-medium text-gray-900">{value || "-"}</p>
    </div>
  );
}
