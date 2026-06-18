import React, { useContext, useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AuthContext from "@/context/AuthContext";
import CandidateRow from "@/components/recruiter/CandidateRow";
import UpgradeBanner from "@/components/recruiter/UpgradeBanner";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { exportCandidatesCSV } from "@/services/recruiter/jobsService";
import { useQueryClient } from "@tanstack/react-query";
import { useJobDetailsQuery } from "@/hooks/queries/useJobDetailsQuery";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import {
  useCandidatesQuery,
  useUpdateCandidateStatusMutation,
  useBulkUpdateCandidateStatusMutation,
} from "@/hooks/queries/useCandidatesQuery";
import { useToggleJobActiveMutation } from "@/hooks/queries/useJobsQuery";

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useContext(AuthContext);

  const queryClient = useQueryClient();

  const {
    data: jobData,
    isLoading: isJobLoading,
    error: jobQueryError,
    refetch: refetchJob,
  } = useJobDetailsQuery(jobId, user?.id);

  const {
    data: candidatesData,
    isLoading: isCandidatesLoading,
    error: candidatesQueryError,
    refetch: refetchCandidates,
  } = useCandidatesQuery(jobId, user?.id);

  const [localJobError, setLocalJobError] = useState(null);
  const [localCandidatesError, setLocalCandidatesError] = useState(null);

  const job = jobData || null;
  const candidates = candidatesData || [];
  const jobLoading = isJobLoading;
  const candidatesLoading = isCandidatesLoading;

  const jobError = localJobError || (jobQueryError ? "Failed to load job." : null);
  const candidatesError = localCandidatesError || (candidatesQueryError ? "Failed to load candidates." : null);

  const toggleActiveMutation = useToggleJobActiveMutation();
  const updateCandidateStatusMutation = useUpdateCandidateStatusMutation();
  const bulkUpdateCandidateStatusMutation = useBulkUpdateCandidateStatusMutation();

  const togglingActive = toggleActiveMutation.isPending;

  const handleRetryEvaluation = async (assessmentId) => {
    try {
      const { error } = await supabase.functions.invoke("evaluate-responses", {
        body: { assessmentId },
      });

      if (error) {
        throw error;
      }

      toast.success("Evaluation restarted successfully!");
      queryClient.invalidateQueries({ queryKey: ["candidates", jobId] });
    } catch (err) {
      console.error("Failed to retry evaluation:", err);
      toast.error(err.message || "Failed to retry evaluation. Please try again.");
      throw err;
    }
  };

  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState("score");
  const [search, setSearch] = useState("");

  const [copied, setCopied] = useState(false);

  const handleToggleActive = async () => {
    if (!job || !user?.id) return;
    setLocalJobError(null);
    toggleActiveMutation.mutate(
      { jobId: job.id, recruiterId: user.id, isActive: !job.is_active },
      {
        onError: () => {
          setLocalJobError("Failed to update job status.");
        },
      }
    );
  };

  const handleCopyLink = () => {
    if (!job?.assessment_link_token) return;
    const url = `https://skill-gate-b.vercel.app/assess/${job.assessment_link_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShortlist = async (candidateId) => {
    if (!user?.id) return;
    setLocalCandidatesError(null);
    updateCandidateStatusMutation.mutate(
      { candidateId, recruiterId: user.id, status: "shortlisted", jobId },
      {
        onError: () => {
          setLocalCandidatesError("Failed to update candidate status.");
        },
      }
    );
  };

  const handleReject = async (candidateId) => {
    if (!user?.id) return;
    setLocalCandidatesError(null);
    updateCandidateStatusMutation.mutate(
      { candidateId, recruiterId: user.id, status: "rejected", jobId },
      {
        onError: () => {
          setLocalCandidatesError("Failed to update candidate status.");
        },
      }
    );
  };

  const handleBulkShortlist = async () => {
    if (!user?.id || selectedIds.length === 0) return;
    setLocalCandidatesError(null);
    const idsToUpdate = [...selectedIds];
    setSelectedIds([]);
    bulkUpdateCandidateStatusMutation.mutate(
      { candidateIds: idsToUpdate, recruiterId: user.id, status: "shortlisted", jobId },
      {
        onError: () => {
          setLocalCandidatesError("Failed to bulk update candidates.");
        },
      }
    );
  };

  const handleBulkReject = async () => {
    if (!user?.id || selectedIds.length === 0) return;
    setLocalCandidatesError(null);
    const idsToUpdate = [...selectedIds];
    setSelectedIds([]);
    bulkUpdateCandidateStatusMutation.mutate(
      { candidateIds: idsToUpdate, recruiterId: user.id, status: "rejected", jobId },
      {
        onError: () => {
          setLocalCandidatesError("Failed to bulk update candidates.");
        },
      }
    );
  };

  const handleBulkExport = () => {
    const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
    exportCandidatesCSV(selectedCandidates, job?.title || "job");
  };

  const handleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setSelectedIds([]);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setSelectedIds([]);
  };

  const processedCandidates = useMemo(() => {
    let result = [...candidates];

    if (activeFilter === "Passed") {
      result = result.filter((c) => c.passed);
    } else if (activeFilter === "Failed") {
      result = result.filter((c) => !c.passed);
    } else if (activeFilter === "Flagged") {
      result = result.filter((c) => c.tabSwitches > 0 || c.pasteAttempts > 0);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(query) ||
          (c.email || "").toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      return b.score - a.score;
    });

    return result;
  }, [candidates, activeFilter, search, sortBy]);

  const isAllVisibleSelected =
    processedCandidates.length > 0 &&
    processedCandidates.every((c) => selectedIds.includes(c.id));

  const handleHeaderCheckboxChange = () => {
    const visibleIds = processedCandidates.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const next = new Set([...prev, ...visibleIds]);
        return Array.from(next);
      });
    }
  };

  const assessmentUrl = job ? `https://skill-gate-b.vercel.app/r/${job.assessment_link_token}` : "";
  const isOverLimit = profile ? profile.assessments_used >= profile.assessments_limit : false;

  // Computations for stats
  const totalCandidatesCount = candidates.length;
  const passedCount = candidates.filter((c) => c.passed).length;
  const failedCount = candidates.filter((c) => !c.passed).length;
  const avgScore =
    totalCandidatesCount > 0
      ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / totalCandidatesCount)
      : 0;

  return (
    <div className="space-y-6 p-6 min-h-screen pb-24 md:pb-6 text-text-primary font-sans bg-primary">
      {/* Back link and Header */}
      {jobLoading || authLoading ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse pb-6 border-b border-border-default">
          <div className="space-y-3">
            <div className="h-4 bg-tertiary rounded w-24"></div>
            <div className="h-8 bg-tertiary rounded w-64"></div>
            <div className="h-4 bg-tertiary rounded w-40"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 bg-tertiary rounded w-28"></div>
            <div className="h-10 bg-tertiary rounded w-10"></div>
          </div>
        </div>
      ) : jobError ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-error/25 bg-error/15 px-4 py-3 text-sm text-error">
          <span>{jobError}</span>
          <button
            onClick={refetchJob}
            className="font-semibold text-error hover:text-text-primary transition-smooth cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : job ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border-default">
          <div>
            <button
              onClick={() => navigate("/jobs")}
              className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-smooth mb-2 cursor-pointer"
            >
              ← All Jobs
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-text-primary text-2xl font-semibold font-sans">{job.title}</h1>
              {job.is_active ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error/15 text-error">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-text-secondary text-sm mt-1">{job.company_name}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleActive}
              disabled={togglingActive}
              className={`inline-flex items-center justify-center font-semibold rounded-lg px-4 py-2 text-sm transition-smooth gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                job.is_active
                  ? "border border-error text-error hover:bg-error/10"
                  : "border border-success text-success hover:bg-success/10"
              }`}
            >
              {togglingActive && (
                <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {job.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => navigate(`/jobs/${job.id}/settings`)}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-tertiary transition-smooth border border-border-default cursor-pointer"
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* Main body content */}
      {!jobLoading && job && (
        <>
          {candidatesLoading ? (
            <div className="space-y-6">
              {/* Stats Cards Skeleton */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-secondary border border-border-default rounded-xl p-5 space-y-2">
                    <div className="h-4 bg-tertiary rounded w-2/3"></div>
                    <div className="h-8 bg-tertiary rounded w-1/2 mt-2"></div>
                  </div>
                ))}
              </div>

              {/* Table Skeleton */}
              <div className="overflow-x-auto rounded-xl border border-border-default bg-secondary">
                <table className="w-full border-collapse">
                  <thead className="bg-secondary text-left text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-default">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <div className="h-4 w-4 bg-tertiary rounded"></div>
                      </th>
                      <th className="px-4 py-3 w-16">#</th>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Result</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3 w-16">Flag</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <CandidateRow
                        key={index}
                        candidate={{}}
                        selected={false}
                        onSelect={() => {}}
                        onShortlist={() => {}}
                        onReject={() => {}}
                        skeleton={true}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : candidatesError ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-error/25 bg-error/15 px-4 py-3 text-sm text-error">
              <span>{candidatesError}</span>
              <button
                onClick={refetchCandidates}
                className="font-semibold text-error hover:text-text-primary transition-smooth cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : totalCandidatesCount === 0 ? (
            /* Empty state (no candidates) */
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto space-y-8">
              <div className="p-4 rounded-full bg-secondary border border-border-default text-text-tertiary">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-text-primary text-xl font-semibold">Share your link to start screening</h3>
                {isOverLimit ? (
                  <p className="text-error font-medium text-sm">
                    Your assessment link is disabled — upgrade to share this job
                  </p>
                ) : (
                  <p className="text-text-secondary text-sm">
                    Send the link below to candidates. When they complete the assessment, their results will appear here.
                  </p>
                )}
              </div>
              <div className="w-full">
                {isOverLimit ? (
                  profile && (
                    <UpgradeBanner
                      assessmentsUsed={profile.assessments_used}
                      assessmentsLimit={profile.assessments_limit}
                      subscriptionTier={profile.subscription_tier}
                    />
                  )
                ) : (
                  <>
                    <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-3 text-left">
                      <span className="block text-text-secondary text-xs font-semibold uppercase tracking-wide">
                        Assessment Link
                      </span>
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                        <div className="flex-1 bg-tertiary border border-border-default rounded-lg px-4 py-2.5 font-mono text-sm text-text-primary break-all select-all flex items-center">
                          {assessmentUrl}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyLink}
                            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent hover:bg-accent-hover text-text-primary transition-smooth min-w-21.25 cursor-pointer"
                          >
                            {copied ? "Copied!" : "Copy"}
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(assessmentUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-2.5 rounded-lg bg-tertiary border border-border-default text-text-secondary hover:text-text-primary hover:bg-secondary transition-smooth cursor-pointer"
                            title="Share on WhatsApp"
                          >
                            <svg className="w-5.5 h-5.5 fill-current text-[#25D366]" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.638 1.971 14.167.947 11.536.947c-5.444 0-9.87 4.372-9.873 9.802-.001 1.762.463 3.484 1.343 5.012L2.025 21.84l6.19-1.62c-.524.31-.058.035 1.58-.926z" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                    {profile && (
                      <UpgradeBanner
                        assessmentsUsed={profile.assessments_used}
                        assessmentsLimit={profile.assessments_limit}
                        subscriptionTier={profile.subscription_tier}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Normal state (has candidates) */
            <div className="space-y-6">
              {/* Assessment Link Block */}
              {isOverLimit ? (
                profile && (
                  <UpgradeBanner
                    assessmentsUsed={profile.assessments_used}
                    assessmentsLimit={profile.assessments_limit}
                    subscriptionTier={profile.subscription_tier}
                  />
                )
              ) : (
                <>
                  <div className="bg-secondary border border-border-default rounded-xl p-5 space-y-3">
                    <span className="block text-text-secondary text-xs font-semibold uppercase tracking-wide">
                      Assessment Link
                    </span>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                      <div className="flex-1 bg-tertiary border border-border-default rounded-lg px-4 py-2.5 font-mono text-sm text-text-primary break-all select-all flex items-center">
                        {assessmentUrl}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyLink}
                          className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent hover:bg-accent-hover text-text-primary transition-smooth min-w-21.25 cursor-pointer"
                        >
                          {copied ? "Copied!" : "Copy"}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(assessmentUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2.5 rounded-lg bg-tertiary border border-border-default text-text-secondary hover:text-text-primary hover:bg-secondary transition-smooth cursor-pointer"
                          title="Share on WhatsApp"
                        >
                          <svg className="w-5.5 h-5.5 fill-current text-[#25D366]" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.638 1.971 14.167.947 11.536.947c-5.444 0-9.87 4.372-9.873 9.802-.001 1.762.463 3.484 1.343 5.012L2.025 21.84l6.19-1.62c-.524.31-.058.035 1.58-.926z" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  {profile && (
                    <UpgradeBanner
                      assessmentsUsed={profile.assessments_used}
                      assessmentsLimit={profile.assessments_limit}
                      subscriptionTier={profile.subscription_tier}
                    />
                  )}
                </>
              )}

              {/* Link Stats Row */}
              <div className="flex flex-wrap gap-4 text-text-secondary text-sm">
                <div className="bg-secondary border border-border-default rounded-full px-4 py-1.5 font-medium">
                  Opened: <span className="text-text-primary">{job.open_count ?? '—'}</span>
                </div>
                <div className="bg-secondary border border-border-default rounded-full px-4 py-1.5 font-medium">
                  Started: <span className="text-text-primary">—</span>
                </div>
                <div className="bg-secondary border border-border-default rounded-full px-4 py-1.5 font-medium">
                  Completed: <span className="text-text-primary font-mono">{totalCandidatesCount}</span>
                </div>
              </div>

              {/* Stats Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-secondary border border-border-default rounded-xl p-5">
                  <p className="text-text-secondary text-sm font-medium">Total Candidates</p>
                  <p className="text-text-primary text-3xl font-bold mt-2 font-mono">{totalCandidatesCount}</p>
                </div>
                <div className="bg-secondary border border-border-default rounded-xl p-5">
                  <p className="text-text-secondary text-sm font-medium">Passed</p>
                  <p className="text-success text-3xl font-bold mt-2 font-mono">{passedCount}</p>
                </div>
                <div className="bg-secondary border border-border-default rounded-xl p-5">
                  <p className="text-text-secondary text-sm font-medium">Failed</p>
                  <p className="text-error text-3xl font-bold mt-2 font-mono">{failedCount}</p>
                </div>
                <div className="bg-secondary border border-border-default rounded-xl p-5">
                  <p className="text-text-secondary text-sm font-medium">Avg Score</p>
                  <p className="text-accent text-3xl font-bold mt-2 font-mono">{avgScore}%</p>
                </div>
              </div>

              {/* Filters and Controls */}
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex border-b border-border-default no-scrollbar overflow-x-auto">
                  {["All", "Passed", "Failed", "Flagged"].map((filter) => {
                    const isFilterActive = activeFilter === filter;
                    return (
                      <button
                        key={filter}
                        onClick={() => handleFilterChange(filter)}
                        className={`px-4 py-2 text-sm font-medium transition-smooth border-b-2 -mb-0.5 cursor-pointer ${
                          isFilterActive
                            ? "border-accent text-accent"
                            : "border-transparent text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>

                {/* Search and Sort controls */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={search}
                      onChange={handleSearchChange}
                      className="w-full pl-9 pr-4 py-2 bg-secondary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary transition-smooth focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-secondary border border-border-default rounded-lg text-text-primary transition-smooth focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm px-3 py-2 cursor-pointer"
                    >
                      <option value="score">By Score</option>
                      <option value="date">By Date</option>
                      <option value="name">By Name</option>
                    </select>
                  </div>
                </div>
              </div>

              <SectionErrorBoundary sectionName="CandidatesTable" fallbackTitle="Candidates table couldn't load">
                {/* Bulk Action Bar */}
                {selectedIds.length > 0 && (
                  <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto z-50 md:z-auto bg-tertiary border-t md:border border-border-default md:rounded-xl px-6 py-4 md:px-4 md:py-3 shadow-lg md:shadow-none flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {selectedIds.length} candidate{selectedIds.length > 1 ? "s" : ""} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={handleBulkShortlist}
                        className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg bg-success hover:bg-success/85 text-text-primary transition-smooth cursor-pointer"
                      >
                        Shortlist All
                      </button>
                      <button
                        onClick={handleBulkReject}
                        className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg bg-error hover:bg-error/85 text-text-primary transition-smooth cursor-pointer"
                      >
                        Reject All
                      </button>
                      <button
                        onClick={handleBulkExport}
                        className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg bg-secondary border border-border-default hover:bg-tertiary text-text-primary transition-smooth cursor-pointer"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                )}

                {/* Candidates Table / Empty Search State */}
                {processedCandidates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary border border-border-default rounded-xl">
                    <p className="text-text-tertiary text-base font-medium">No candidates match your search or filter</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border-default bg-secondary">
                    <table className="w-full border-collapse">
                      <thead className="bg-secondary text-left text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-default">
                        <tr>
                          <th className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer rounded border-border-default bg-primary text-accent focus:ring-accent"
                              checked={isAllVisibleSelected}
                              onChange={handleHeaderCheckboxChange}
                              aria-label="Select all visible candidates"
                            />
                          </th>
                          <th className="px-4 py-3 w-16">#</th>
                          <th className="px-4 py-3">Candidate</th>
                          <th className="px-4 py-3">Score</th>
                          <th className="px-4 py-3">Result</th>
                          <th className="px-4 py-3">Confidence</th>
                          <th className="px-4 py-3 w-16">Flag</th>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {processedCandidates.map((candidate) => (
                          <CandidateRow
                            key={candidate.id}
                            candidate={candidate}
                            selected={selectedIds.includes(candidate.id)}
                            onSelect={handleSelect}
                            onShortlist={handleShortlist}
                            onReject={handleReject}
                            onRetryEvaluation={handleRetryEvaluation}
                            skeleton={false}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionErrorBoundary>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default JobDetail;
