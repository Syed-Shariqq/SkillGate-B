import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "@/context/AuthContext";
import JobCard from "@/components/recruiter/JobCard";
import OnboardingChecklist from "@/components/recruiter/OnboardingChecklist";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { useDashboardQuery } from "@/hooks/queries/useDashboardQuery";

const DASH = "\u2014";

const DEFAULT_STATS = {
  activeJobs: 0,
  totalScreened: 0,
  avgScore: null,
  passRate: null,
};

const timeAgo = (date) => {
  if (!date) return "just now";

  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "just now";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
};

const RecruiterDashboard = () => {
  const { user, profile } = useContext(AuthContext);
  const navigate = useNavigate();

  const { data, isLoading, error: queryError, refetch } = useDashboardQuery(user?.id);

  const stats = data?.statsData || DEFAULT_STATS;
  const activity = data?.activityData || [];
  const recentJobs = data?.jobsData || [];
  const loading = isLoading;
  const error = queryError ? "Failed to load dashboard data." : null;

  const statCards = [
    {
      label: "Active Jobs",
      value: stats.activeJobs,
      icon: (
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
          <path
            d="M6.5 6V4.75A1.75 1.75 0 0 1 8.25 3h3.5a1.75 1.75 0 0 1 1.75 1.75V6m-9 0h11A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-7A1.5 1.5 0 0 1 4.5 6Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      ),
    },
    {
      label: "Total Screened",
      value: stats.totalScreened,
      icon: (
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
          <path
            d="M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.5 7a5.5 5.5 0 0 0-11 0m11.25-7.5a2.25 2.25 0 1 0 0-4.5m1 12h3.75a4.75 4.75 0 0 0-3.25-4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      ),
    },
    {
      label: "Avg Score",
      value: stats.avgScore ? stats.avgScore.toFixed(1) : DASH,
      icon: (
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
          <path
            d="M4 16V9.5m6 6.5V4m6 12v-4.5M3 16.5h14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      ),
    },
    {
      label: "Pass Rate",
      value: stats.passRate === null ? DASH : `${Math.round(stats.passRate)}%`,
      icon: (
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
          <path
            d="m16 6-7.5 7.5L4 9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      ),
    },
  ];

  const hasNoJobs = !loading && !error && recentJobs.length === 0;

  return (
    <div className="space-y-6 p-6">
      <OnboardingChecklist profile={profile} /> 

      {hasNoJobs ? (
        <section className="flex min-h-[52vh] items-center justify-center rounded-xl border border-border-default bg-secondary px-6 py-12 text-center">
          <div className="mx-auto max-w-md">
            <svg
              aria-hidden="true"
              className="mx-auto h-16 w-16 text-text-tertiary"
              fill="none"
              viewBox="0 0 64 64"
            >
              <path
                d="M21 20v-4.5A5.5 5.5 0 0 1 26.5 10h11A5.5 5.5 0 0 1 43 15.5V20m-30 0h38a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5V25a5 5 0 0 1 5-5Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              <path
                d="M8 34h48"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
            <h1 className="mt-6 text-2xl font-semibold text-text-primary">
              Start screening smarter
            </h1>
            <p className="mt-2 text-text-secondary">
              Post your first job and let AI pre-screen candidates for you.
            </p>
            <button
              className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-accent-hover"
              type="button"
              onClick={() => navigate("/jobs/create")}
            >
              Post a Job
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonCard key={index} rows={2} className="min-h-32" />
                ))
              : statCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-border-default bg-secondary p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-text-secondary">{card.label}</p>
                      <span className="text-text-tertiary">{card.icon}</span>
                    </div>
                    <p className="mt-5 font-mono text-3xl font-bold text-text-primary">
                      {card.value}
                    </p>
                  </div>
                ))}
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-error/25 bg-error/15 px-4 py-3 text-sm text-error">
              <span>{error}</span>
              <button
                className="font-semibold text-error transition-colors hover:text-text-primary"
                type="button"
                onClick={refetch}
              >
                Retry
              </button>
            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
            <div className="rounded-xl border border-border-default bg-secondary p-5">
              <h2 className="text-base font-semibold text-text-primary">
                Recent Activity
              </h2>

              <div className="mt-4 space-y-2">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border-default bg-primary px-4 py-3"
                    >
                      <div className="h-4 w-2/3 animate-pulse rounded bg-tertiary" />
                      <div className="h-3 w-20 animate-pulse rounded bg-tertiary" />
                    </div>
                  ))
                ) : activity.length > 0 ? (
                  activity.map((entry) => (
                    <button
                      key={entry.id}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left transition-colors hover:bg-tertiary"
                      type="button"
                      onClick={() => navigate(`/candidates/${entry.candidateId}`)}
                    >
                      <span className="min-w-0 text-sm text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {entry.candidateName}
                        </span>
                        <span
                          className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.passed ? "bg-success/15 text-success" : "bg-error/15 text-error"
                          }`}
                        >
                          {entry.passed ? "Passed" : "Failed"}
                        </span>
                        <span> completed </span>
                        <span className="text-text-primary">{entry.jobTitle}</span>
                      </span>
                      <span className="shrink-0 text-xs text-text-tertiary">
                        {timeAgo(entry.completedAt)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-sm text-text-tertiary">
                    No activity yet {DASH} share your first assessment link to get started
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-secondary p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-text-primary">
                  Recent Jobs
                </h2>
                <Link className="text-sm font-medium text-accent hover:text-accent-hover" to="/jobs">
                  View All Jobs &rarr;
                </Link>
              </div>

              <div className="mt-4 grid gap-4">
                {loading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <JobCard key={index} loading skeleton />
                    ))
                  : recentJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        id={job.id}
                        title={job.title}
                        companyName={job.company_name}
                        status={job.is_active ? "active" : "inactive"}
                        candidateCount={job.candidate_count}
                        avgScore={job.avg_score === null ? null : Math.round(job.avg_score)}
                        passRate={job.pass_rate}
                        linkUsageCurrent={job.link_use_count}
                        linkUsageMax={job.link_max_uses}
                        createdAt={job.created_at}
                      />
                    ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default RecruiterDashboard;
