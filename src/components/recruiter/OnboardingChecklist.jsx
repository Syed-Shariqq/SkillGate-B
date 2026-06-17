import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "@/context/AuthContext";
import {
  getOnboardingStatus,
  markOnboardingComplete,
} from "@/services/recruiter/dashboardService";
import SkeletonCard from "../ui/SkeletonCard";

const STEP_COUNT = 3;

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className="h-3.5 w-3.5"
    fill="none"
    viewBox="0 0 16 16"
  >
    <path
      d="M13.5 4.5 6.5 11.5 3 8"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const StepStatusIcon = ({ complete }) => {
  if (complete) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <CheckIcon />
      </span>
    );
  }

  return (
    <span className="h-5 w-5 shrink-0 rounded-full border border-border-default" />
  );
};

const ChecklistStep = ({ actionLabel, complete, label, onAction, showSeparator }) => (
  <div
    className={`flex min-h-13 items-center gap-3 py-3 ${
      showSeparator ? "border-b border-border-default" : ""
    }`}
  >
    <StepStatusIcon complete={complete} />
    <span
      className={`min-w-0 flex-1 text-sm ${
        complete
          ? "text-text-secondary line-through"
          : "text-text-primary"
      }`}
    >
      {label}
    </span>
    {!complete && actionLabel && (
      <button
        className="shrink-0 text-sm font-medium text-accent transition-colors hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent-soft"
        type="button"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    )}
  </div>
);

const OnboardingChecklist = () => {
  const { profile, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const recruiterId = profile?.id || user?.id;
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [companyDetailsComplete, setCompanyDetailsComplete] = useState(false);
  const [firstJobComplete, setFirstJobComplete] = useState(false);

  useEffect(() => {
    if (!recruiterId) {
      return undefined;
    }

    let isMounted = true;

    const loadCompletionState = async () => {
      setLoading(true);

      const onboardingStatusResult = await getOnboardingStatus(recruiterId);

      if (!isMounted) return;

      if (onboardingStatusResult.error) {
        console.error("Onboarding status fetch error:", onboardingStatusResult.error);
        setLoading(false);
        return;
      }

      const { onboardingResult, profileResult, jobsResult } = onboardingStatusResult.data || {};

      if (onboardingResult.error) {
        console.error("Onboarding status fetch error:", onboardingResult.error);
      }

      if (onboardingResult.data?.onboarding_complete) {
        setHidden(true);
        setLoading(false);
        return;
      }

      if (profileResult.error) {
        console.error("Company details fetch error:", profileResult.error);
      }

      if (jobsResult.error) {
        console.error("First job fetch error:", jobsResult.error);
      }

      const hasCompanyDetails =
        Boolean(profileResult.data?.company_name) &&
        Boolean(profileResult.data?.company_website);
      const hasFirstJob = (jobsResult.count || 0) > 0;

      setCompanyDetailsComplete(hasCompanyDetails);
      setFirstJobComplete(hasFirstJob);

      if (hasCompanyDetails && hasFirstJob) {
        const { error } = await markOnboardingComplete(recruiterId);

        if (error) {
          console.error("Onboarding completion update error:", error);
        } else if (isMounted) {
          setHidden(true);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    loadCompletionState();

    return () => {
      isMounted = false;
    };
  }, [recruiterId]);

  const steps = useMemo(
    () => [
      {
        actionLabel: null,
        complete: true,
        label: "Create your account",
      },
      {
        actionLabel: "Go to Settings \u2192",
        complete: companyDetailsComplete,
        label: "Add your company details",
        onAction: () => navigate("/settings"),
      },
      {
        actionLabel: "Post a Job \u2192",
        complete: firstJobComplete,
        label: "Post your first job",
        onAction: () => navigate("/jobs/create"),
      },
    ],
    [companyDetailsComplete, firstJobComplete, navigate],
  );

  const completedCount = steps.filter((step) => step.complete).length;
  const progressPercent = (completedCount / STEP_COUNT) * 100;

  if (hidden) {
    return null;
  }

  if (!recruiterId) {
    return null;
  }

  if (loading) {
    return <SkeletonCard rows={4} className="min-h-48 rounded-lg" />;
  }

  return (
    <section className="rounded-lg border border-border-default bg-secondary p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-text-primary sm:text-base">
          Get started with SkillGate
        </h2>
        <p className="shrink-0 text-sm text-text-secondary">
          {completedCount} of {STEP_COUNT} complete
        </p>
      </div>

      <div className="mt-4 h-1 w-full overflow-hidden rounded bg-tertiary">
        <div
          className="h-full rounded bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-3">
        {steps.map((step, index) => (
          <ChecklistStep
            key={step.label}
            actionLabel={step.actionLabel}
            complete={step.complete}
            label={step.label}
            onAction={step.onAction}
            showSeparator={index < steps.length - 1}
          />
        ))}
      </div>
    </section>
  );
};

export default OnboardingChecklist;
