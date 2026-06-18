import React, { useContext, useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import {
  saveInternalNote,
  retryPdfGeneration,
} from "@/services/recruiter/candidateService";
import { useQueryClient } from "@tanstack/react-query";
import { useCandidateDetailsQuery } from "@/hooks/queries/useCandidateDetailsQuery";
import { useUpdateCandidateStatusMutation } from "@/hooks/queries/useCandidatesQuery";


const CandidateProfile = () => {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const queryClient = useQueryClient();

  const {
    data: profileData,
    isLoading,
    error: queryError,
  } = useCandidateDetailsQuery(candidateId, user?.id);

  const [localStatusState, setLocalStatusState] = useState(null);
  const [localError, setLocalError] = useState(null);

  const loading = isLoading;
  const error = localError || (queryError ? "Failed to load candidate profile." : null);

  useEffect(() => {
    if (profileData?.candidate?.status) {
      setLocalStatusState(profileData.candidate.status);
    }
  }, [profileData?.candidate?.status]);

  const statusState = localStatusState || profileData?.candidate?.status || null;

  const [noteText, setNoteText] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryPdfLoading, setRetryPdfLoading] = useState(false);

  const updateStatusMutation = useUpdateCandidateStatusMutation();

  const handleRetryEvaluation = async () => {
    if (!profileData?.assessment?.id) return;
    setRetryLoading(true);
    try {
      const { error } = await supabase.functions.invoke("evaluate-responses", {
        body: { assessmentId: profileData.assessment.id },
      });

      if (error) {
        throw error;
      }

      toast.success("Evaluation restarted successfully!");
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
    } catch (err) {
      console.error("Failed to retry evaluation:", err);
      toast.error(err.message || "Failed to retry evaluation. Please try again.");
    } finally {
      setRetryLoading(false);
    }
  };

  const handleRetryPdf = async () => {
    if (!profileData?.assessment?.id || !profileData?.result?.id) return;
    setRetryPdfLoading(true);
    try {
      const { error } = await retryPdfGeneration(
        profileData.assessment.id,
        profileData.result.id
      );

      if (error) {
        throw error;
      }

      toast.success("PDF generation restarted!");
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
    } catch (err) {
      console.error("Failed to retry PDF generation:", err);
      toast.error(err.message || "Failed to retry PDF generation. Please try again.");
    } finally {
      setRetryPdfLoading(false);
    }
  };

  const handleShortlist = async () => {
    if (!user?.id || !profileData?.candidate) return;
    setLocalStatusState("shortlisted");
    setLocalError(null);
    updateStatusMutation.mutate(
      {
        candidateId: profileData.candidate.id,
        recruiterId: user.id,
        status: "shortlisted",
        jobId: profileData.candidate.job_id,
      },
      {
        onError: () => {
          setLocalStatusState(profileData.candidate.status);
          setLocalError("Failed to update candidate status.");
        },
      }
    );
  };

  const handleReject = async () => {
    if (!user?.id || !profileData?.candidate) return;
    setLocalStatusState("rejected");
    setShowRejectConfirm(false);
    setLocalError(null);
    updateStatusMutation.mutate(
      {
        candidateId: profileData.candidate.id,
        recruiterId: user.id,
        status: "rejected",
        jobId: profileData.candidate.job_id,
      },
      {
        onError: () => {
          setLocalStatusState(profileData.candidate.status);
          setLocalError("Failed to update candidate status.");
        },
      }
    );
  };

  const handleSaveNote = async () => {
    if (!user?.id || !profileData?.candidate) return;
    try {
      const { error: noteError } = await saveInternalNote(
        profileData.candidate.id,
        user.id,
        noteText
      );
      if (!noteError) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
        queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      }
    } catch (err) {
      // Inline state error handling
    }
  };

  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const sortedResponses = useMemo(() => {
    if (!profileData?.responses) return [];
    return [...profileData.responses].sort((a, b) => {
      const indexA = a.question?.order_index ?? 0;
      const indexB = b.question?.order_index ?? 0;
      return indexA - indexB;
    });
  }, [profileData?.responses]);

  const handleBack = () => {
    if (profileData?.candidate?.job_id) {
      navigate(`/jobs/${profileData.candidate.job_id}`);
    } else {
      navigate("/jobs");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 min-h-screen text-text-primary font-sans bg-primary">
        <div className="h-4 bg-tertiary rounded w-24 animate-pulse mb-4"></div>

        <div className="flex flex-col md:flex-row gap-6 animate-pulse">
          {/* Left Column Skeletons */}
          <div className="flex-1 space-y-6">
            {/* Header Skeleton */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="h-7 bg-tertiary rounded w-2/3"></div>
                <div className="h-4 bg-tertiary rounded w-1/3"></div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 w-24">
                <div className="h-10 bg-tertiary rounded w-full"></div>
                <div className="h-3 bg-tertiary rounded w-2/3"></div>
              </div>
            </div>

            {/* Executive Summary Skeleton */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 h-64">
              <div className="h-5 bg-tertiary rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-tertiary rounded w-full"></div>
                <div className="h-4 bg-tertiary rounded w-5/6"></div>
                <div className="h-4 bg-tertiary rounded w-4/5"></div>
              </div>
            </div>

            {/* Integrity Signals Skeleton */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 h-48">
              <div className="h-5 bg-tertiary rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-tertiary rounded w-full"></div>
                <div className="h-4 bg-tertiary rounded w-full"></div>
                <div className="h-4 bg-tertiary rounded w-full"></div>
              </div>
            </div>

            {/* Skill Passport Skeleton */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 h-52">
              <div className="h-5 bg-tertiary rounded w-1/4 mb-4"></div>
              <div className="space-y-4">
                <div className="h-4 bg-tertiary rounded w-2/3"></div>
                <div className="h-4 bg-tertiary rounded w-3/4"></div>
              </div>
            </div>

            {/* Assessment Breakdown Skeleton */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 h-96">
              <div className="h-5 bg-tertiary rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-20 bg-tertiary rounded w-full"></div>
                <div className="h-20 bg-tertiary rounded w-full"></div>
              </div>
            </div>
          </div>

          {/* Right Column Skeletons */}
          <div className="w-full md:w-80 shrink-0">
            <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4 h-64">
              <div className="h-10 bg-tertiary rounded w-full"></div>
              <div className="h-10 bg-tertiary rounded w-full"></div>
              <div className="h-10 bg-tertiary rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !profileData) {
    return (
      <div className="space-y-6 p-6 min-h-screen text-text-primary font-sans bg-primary flex flex-col items-center justify-center text-center">
        <div className="flex items-center justify-center p-3 rounded-full bg-error/15 text-error mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-text-primary text-lg font-semibold">Failed to load candidate profile</h3>
        <p className="text-text-secondary text-sm max-w-md mt-1 mb-6">{error}</p>
        <button
          onClick={loadProfile}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold rounded-lg transition-smooth cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!profileData) return null;

  const { candidate, assessment, result, job } = profileData;

  const score = result.overall_score ?? 0;
  const scoreColor = score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-error";

  const isClean =
    (assessment.tab_switches ?? 0) === 0 &&
    (assessment.paste_attempts ?? 0) === 0 &&
    !assessment.is_flagged;

  return (
    <div className="space-y-6 p-6 min-h-screen text-text-primary font-sans bg-primary">
      {/* Back to Job link */}
      <div>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-smooth mb-4 cursor-pointer"
        >
          ← Back to Job
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left Column (flex-1) */}
        <div className="flex-1 space-y-6 w-full">
          {/* Header block */}
          <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-text-primary text-2xl font-bold">{candidate.full_name}</h1>
                <span className="bg-tertiary border border-border-default rounded px-2 py-0.5 font-mono text-xs text-text-secondary">
                  SG-{candidate.id.slice(-4).toUpperCase()}
                </span>
                {result.passed === true && (
                  <span className="bg-success/15 text-success rounded-full px-3 py-1 text-xs font-medium">
                    Pre-Verified
                  </span>
                )}
              </div>
              <p className="text-text-secondary text-sm">{candidate.email}</p>
              {job && <p className="text-text-tertiary text-xs">Role: {job.title}</p>}
            </div>

            <div className="flex sm:flex-col items-start sm:items-end gap-3 sm:gap-1 shrink-0">
              {assessment.status === "completed" && (
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-bold font-mono ${scoreColor}`}>{score}%</span>
                </div>
              )}
              <div className="flex flex-col sm:items-end gap-1">
                {assessment.status === "completed" && (
                  <span className="text-text-tertiary text-xs uppercase tracking-wider font-semibold">
                    Overall Score
                  </span>
                )}
                {assessment.status === "pending_review" ? (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-warning/15 text-warning">
                    Pending Review
                  </span>
                ) : assessment.status === "evaluating" ? (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-accent-soft text-accent">
                    Evaluating
                  </span>
                ) : assessment.status === "failed" ? (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-error/15 text-error">
                    Failed
                  </span>
                ) : (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      result.passed ? "bg-success/15 text-success" : "bg-error/15 text-error"
                    }`}
                  >
                    {result.passed ? "Passed" : "Failed"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {assessment.status === "pending_review" && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-warning text-sm font-semibold mb-1">Evaluation Needs Review</h4>
                <p className="text-text-secondary text-xs leading-relaxed">
                  The AI grading engine encountered a temporary issue while evaluating this candidate's responses. No score has been generated. You can trigger a retry using the action on the right.
                </p>
              </div>
            </div>
          )}

          {assessment.status === "evaluating" && (
            <div className="bg-accent-soft/10 border border-accent/20 rounded-xl p-4 flex items-start gap-3 animate-pulse">
              <svg className="w-5 h-5 text-accent shrink-0 mt-0.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div>
                <h4 className="text-accent text-sm font-semibold mb-1">Evaluation in Progress</h4>
                <p className="text-text-secondary text-xs leading-relaxed">
                  The AI grading engine is currently evaluating the candidate's answers. Results will be available shortly.
                </p>
              </div>
            </div>
          )}

          {/* Executive AI Summary section */}
          {assessment.status === "completed" && (
            <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-border-default pb-3">
                <h2 className="text-text-primary font-semibold text-lg">Executive Summary</h2>
                {result.hiring_signal && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      result.hiring_signal === "No Hire" ? "bg-error/15 text-error" : "bg-success/15 text-success"
                    }`}
                  >
                    {result.hiring_signal}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {result.executive_summary ? (
                  <p className="text-text-secondary text-sm leading-relaxed">{result.executive_summary}</p>
                ) : (
                  <p className="text-text-tertiary text-sm">Summary not yet generated</p>
                )}
                {result.hiring_rationale && (
                  <p className="text-text-tertiary text-xs italic mt-2 border-l-2 border-border-default pl-3 leading-relaxed">
                    {result.hiring_rationale}
                  </p>
                )}
              </div>

              {/* Technical Confidence block inside Executive Summary */}
              <div className="pt-4 border-t border-border-default space-y-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-text-primary">Technical Confidence</span>
                  <span
                    className={`text-xs font-semibold ${
                      result.confidence_label === "High"
                        ? "text-success"
                        : result.confidence_label === "Medium"
                          ? "text-warning"
                          : "text-error"
                    }`}
                  >
                    {result.confidence_label} ({result.confidence_score ?? 0}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-tertiary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      result.confidence_label === "High"
                        ? "bg-success"
                        : result.confidence_label === "Medium"
                          ? "bg-warning"
                          : "bg-error"
                    }`}
                    style={{ width: `${result.confidence_score ?? 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Integrity section */}
          <div className="bg-secondary border border-border-default rounded-xl p-5">
            <h2 className="text-text-primary font-semibold text-lg border-b border-border-default pb-3 mb-3">
              Integrity Signals
            </h2>
            <div className="space-y-3 mt-3">
              {isClean && (
                <div className="pb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success">
                    Clean submission ✓
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-border-default/50">
                <span className="text-text-secondary">Tab Switches</span>
                <span
                  className={`font-mono font-medium ${
                    assessment.tab_switches > 0 ? "text-error font-bold" : "text-text-primary"
                  }`}
                >
                  {assessment.tab_switches ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-border-default/50">
                <span className="text-text-secondary">Paste Detected</span>
                <span
                  className={`font-mono font-medium ${
                    assessment.paste_attempts > 0 ? "text-error font-bold" : "text-text-primary"
                  }`}
                >
                  {assessment.paste_attempts ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-border-default/50">
                <span className="text-text-secondary">Flagged</span>
                <span>
                  {assessment.is_flagged ? (
                    <span className="bg-error/15 text-error px-2 py-0.5 rounded text-xs font-medium">Yes</span>
                  ) : (
                    <span className="bg-success/15 text-success px-2 py-0.5 rounded text-xs font-medium">No</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5">
                <span className="text-text-secondary">Time Taken</span>
                <span className="font-mono text-text-primary">
                  {formatTime(result.time_taken_seconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Skill Passport section */}
          {assessment.status === "completed" && (
            <div className="bg-secondary border border-border-default rounded-xl p-5">
              <h2 className="text-text-primary font-semibold text-lg border-b border-border-default pb-3 mb-3">
                Skill Passport
              </h2>
              {result.skill_scores && result.skill_scores.length > 0 ? (
                <div className="space-y-4 mt-3">
                  {result.skill_scores.map((skillItem, index) => {
                    const scoreVal = skillItem.score ?? 0;
                    return (
                      <div key={index} className="space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-text-primary font-medium">{skillItem.skill}</span>
                          <span className="text-text-secondary text-xs">{skillItem.level}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-tertiary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${scoreVal}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-text-tertiary text-sm mt-3">Skill breakdown not available</p>
              )}
            </div>
          )}

          {/* Assessment Breakdown section */}
          <div className="bg-secondary border border-border-default rounded-xl p-5">
            <h2 className="text-text-primary font-semibold text-lg border-b border-border-default pb-3">
              Assessment Breakdown
            </h2>
            {sortedResponses.length > 0 ? (
              <div className="space-y-4 mt-4">
                {sortedResponses.map((resp, idx) => {
                  const q = resp.question || {};
                  const difficultyColor =
                    q.difficulty === "Easy"
                      ? "bg-success/15 text-success"
                      : q.difficulty === "Medium"
                        ? "bg-warning/15 text-warning"
                        : "bg-error/15 text-error";

                  return (
                    <div
                      key={resp.id || idx}
                      className="bg-tertiary border border-border-default rounded-lg p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-text-secondary text-sm font-semibold">
                            Q{q.order_index ?? idx + 1}
                          </span>
                          {q.skill && (
                            <span className="bg-accent-soft text-accent rounded px-2 py-0.5 text-xs font-medium">
                              {q.skill}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${difficultyColor}`}>
                            {q.difficulty || "Medium"}
                          </span>
                          <span className="font-mono text-sm text-text-secondary">
                            {resp.points_earned ?? 0}/{q.points ?? 0} pts
                          </span>
                        </div>
                      </div>

                      <p className="text-text-primary text-sm font-medium">{q.question_text}</p>

                      {/* Candidate's Answer */}
                      <div className="space-y-1">
                        <span className="block text-text-tertiary text-[10px] font-bold uppercase tracking-wider">
                          Candidate's Answer
                        </span>
                        {q.question_type === "mcq" ? (
                          <p
                            className={`text-sm font-semibold ${
                              resp.is_correct ? "text-success" : "text-error"
                            }`}
                          >
                            {resp.answer_given || "No answer"} {resp.is_correct ? "✓" : "✗"}
                          </p>
                        ) : (
                          <pre className="bg-primary border border-border-default rounded p-3 text-sm text-text-secondary font-mono whitespace-pre-wrap">
                            {resp.answer_given || "(Empty response)"}
                          </pre>
                        )}
                      </div>

                      {/* Ideal Answer (text questions only) */}
                      {q.question_type === "text" && q.ideal_answer && (
                        <div className="space-y-1">
                          <span className="block text-text-tertiary text-[10px] font-bold uppercase tracking-wider">
                            Ideal Answer
                          </span>
                          <pre className="bg-primary/40 border border-border-default/50 rounded p-3 text-sm text-text-secondary font-mono whitespace-pre-wrap">
                            {q.ideal_answer}
                          </pre>
                        </div>
                      )}

                      {/* AI Critique */}
                      {(resp.ai_feedback || (resp.missed_concepts && resp.missed_concepts.length > 0)) && (
                        <div className="space-y-1 border-t border-border-default/50 pt-2">
                          <span className="block text-text-tertiary text-[10px] font-bold uppercase tracking-wider">
                            AI Critique
                          </span>
                          {resp.ai_feedback && (
                            <p className="text-text-secondary text-sm italic leading-relaxed">
                              {resp.ai_feedback}
                            </p>
                          )}
                          {resp.missed_concepts && resp.missed_concepts.length > 0 && (
                            <p className="text-error text-xs font-semibold">
                              Missed: {resp.missed_concepts.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-text-tertiary text-sm mt-3">No responses recorded for this candidate</p>
            )}
          </div>
        </div>

        {/* Right Column (Candidate Actions sidebar) */}
        <div className="w-full md:w-80 shrink-0 md:sticky md:top-6">
          <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-3">
            <h3 className="text-text-primary font-semibold text-base mb-2">Actions</h3>

            {/* Retry Evaluation Button for Pending Review */}
            {assessment?.status === "pending_review" && (
              <button
                onClick={handleRetryEvaluation}
                disabled={retryLoading}
                className="w-full py-2.5 px-4 bg-warning hover:bg-warning/80 text-text-primary text-sm font-semibold rounded-lg transition-smooth cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {retryLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {retryLoading ? "Retrying..." : "Retry Evaluation"}
              </button>
            )}

            {/* Retry PDF Button for Failed PDF Status */}
            {profileData?.result?.pdf_status === "failed" && (
              <button
                onClick={handleRetryPdf}
                disabled={retryPdfLoading}
                className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold rounded-lg transition-smooth cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {retryPdfLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {retryPdfLoading ? "Retrying..." : "Retry PDF"}
              </button>
            )}

            {/* Shortlist Button */}
            {statusState === "shortlisted" ? (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-accent text-text-primary text-sm font-semibold rounded-lg opacity-80 cursor-not-allowed text-center"
              >
                Shortlisted ✓
              </button>
            ) : (
              <button
                onClick={handleShortlist}
                className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-text-primary text-sm font-semibold rounded-lg transition-smooth cursor-pointer text-center"
              >
                Shortlist Candidate
              </button>
            )}

            {/* Send Email link styled as button */}
            <a
              href={`mailto:${candidate.email}`}
              className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-secondary border border-border-default text-text-secondary hover:text-text-primary hover:bg-tertiary text-sm font-semibold rounded-lg transition-smooth cursor-pointer text-center"
            >
              Send Email
            </a>

            {/* Add Note Section */}
            <div className="space-y-2">
              <button
                onClick={() => setShowNote(!showNote)}
                className="w-full py-2.5 px-4 bg-secondary border border-border-default text-text-secondary hover:text-text-primary hover:bg-tertiary text-sm font-semibold rounded-lg transition-smooth cursor-pointer text-center"
              >
                Add Internal Note
              </button>
              {showNote && (
                <div className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Type a note here..."
                    rows={4}
                    className="bg-tertiary border border-border-default rounded-lg p-3 text-sm text-text-primary w-full resize-none outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  ></textarea>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleSaveNote}
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-text-primary text-xs font-semibold rounded transition-smooth cursor-pointer"
                    >
                      Save Note
                    </button>
                    {noteSaved && <span className="text-success text-xs font-medium">Note saved</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Reject Section */}
            {statusState === "rejected" ? (
              <button
                disabled
                className="w-full py-2.5 px-4 bg-error text-text-primary text-sm font-semibold rounded-lg opacity-85 cursor-not-allowed text-center"
              >
                Rejected
              </button>
            ) : showRejectConfirm ? (
              <div className="bg-tertiary border border-border-default rounded-lg p-3 mt-2 space-y-2">
                <p className="text-xs text-text-secondary">Are you sure you want to reject this candidate?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    className="flex-1 py-1.5 px-3 bg-error hover:bg-error/80 text-text-primary text-xs font-semibold rounded transition-smooth cursor-pointer"
                  >
                    Yes, Reject
                  </button>
                  <button
                    onClick={() => setShowRejectConfirm(false)}
                    className="flex-1 py-1.5 px-3 bg-secondary border border-border-default text-text-secondary hover:text-text-primary text-xs font-semibold rounded transition-smooth cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRejectConfirm(true)}
                className="w-full py-2.5 px-4 bg-secondary border border-error text-error hover:bg-error/10 text-sm font-semibold rounded-lg transition-smooth cursor-pointer text-center"
              >
                Reject Candidate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
