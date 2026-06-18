import React, { useState, useEffect, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
const JobQrCode = React.lazy(() => import("@/components/recruiter/JobQrCode"));
import { useAuth } from "@/hooks/useAuth";
import UpgradeBanner from "@/components/recruiter/UpgradeBanner";

const JobCreatedSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const { profile, loading: authLoading } = useAuth();

  const state = location.state || {};
  const { token, jobTitle, jobId } = state;

  useEffect(() => {
    if (!token || !jobId) {
      navigate("/jobs", { replace: true });
    }
  }, [token, jobId, navigate]);

  if (!token || !jobId) {
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const assessmentLink = `https://skill-gate-b.vercel.app/r/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(assessmentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const isOverLimit = profile ? profile.assessments_used >= profile.assessments_limit : false;

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6">
      <div className="bg-secondary border border-border-default rounded-2xl p-8 max-w-lg w-full text-center">
        {/* Success checkmark SVG icon */}
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto text-success">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-text-primary text-2xl font-bold mt-4">
          Your job is live! 🎉
        </h1>
        
        {isOverLimit ? (
          <p className="text-error font-medium text-sm mt-2">
            Your assessment link is disabled — upgrade to share this job
          </p>
        ) : (
          <p className="text-text-secondary text-sm mt-2">
            Share the link below with candidates to start screening.
          </p>
        )}

        {/* Job Title Display */}
        <div className="text-accent font-semibold text-base mt-4 font-sans">
          {jobTitle}
        </div>

        {/* Upgrade Banner */}
        {profile && (
          <UpgradeBanner
            assessmentsUsed={profile.assessments_used}
            assessmentsLimit={profile.assessments_limit}
            subscriptionTier={profile.subscription_tier}
          />
        )}

        {/* If under limit, show link, buttons, QR code */}
        {!isOverLimit && (
          <>
            {/* Link Block */}
            <div className="text-left mt-6">
              <label className="text-text-secondary text-xs uppercase tracking-wide mb-2 block font-medium">
                Assessment Link
              </label>
              <div className="flex flex-col gap-2">
                <div className="bg-tertiary border border-border-default rounded-lg px-4 py-3 font-mono text-sm text-text-primary break-all text-left select-all">
                  {assessmentLink}
                </div>
                <button
                  onClick={handleCopy}
                  className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg text-sm transition-smooth cursor-pointer"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Share Buttons Row */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(assessmentLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border border-success text-success hover:bg-success/15 font-semibold py-2 rounded-lg text-sm transition-colors cursor-pointer"
              >
                WhatsApp
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(assessmentLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border border-info text-info hover:bg-info/15 font-semibold py-2 rounded-lg text-sm transition-colors cursor-pointer"
              >
                LinkedIn
              </a>
            </div>

            {/* QR Code */}
            <div className="mt-6 flex flex-col items-center">
              <Suspense
                fallback={
                  <div className="bg-tertiary rounded-lg w-46 h-46" />
                }
              >
                <JobQrCode value={assessmentLink} size={160} />
              </Suspense>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => navigate(`/jobs/${jobId}`)}
            className="w-full bg-accent hover:bg-accent-hover text-text-primary font-semibold py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
          >
            View Job Details
          </button>
          <button
            onClick={() => navigate("/jobs/create")}
            className="w-full border border-accent text-accent hover:bg-accent-soft font-semibold py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Post Another Job
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobCreatedSuccess;
