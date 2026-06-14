import React from "react";
import { useNavigate } from "react-router-dom";

export const UpgradeBanner = ({ assessmentsUsed, assessmentsLimit, subscriptionTier }) => {
  const navigate = useNavigate();

  const used = Number(assessmentsUsed) || 0;
  const limit = Number(assessmentsLimit) || 0;
  const tier = subscriptionTier || "starter";

  if (used >= limit) {
    return (
      <div className="bg-secondary border border-error rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 w-full my-4">
        <div className="flex items-center gap-3">
          <div className="text-error shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-text-primary text-sm text-left">
            You've reached your <span className="capitalize font-semibold">{tier}</span> plan limit of <span className="font-semibold">{limit}</span> assessments this month.
          </p>
        </div>
        <button
          onClick={() => navigate("/billing")}
          className="bg-error hover:bg-error/85 text-text-primary text-sm font-semibold px-4 py-2 rounded-lg transition-smooth whitespace-nowrap cursor-pointer"
        >
          Upgrade Plan
        </button>
      </div>
    );
  }

  if (used < limit && used >= limit - 2) {
    return (
      <div className="bg-secondary border border-warning/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 w-full my-4">
        <div className="flex items-center gap-3">
          <div className="text-warning shrink-0">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-text-primary text-sm text-left">
            You're almost at your limit ({used}/{limit} used).
          </p>
        </div>
        <button
          onClick={() => navigate("/billing")}
          className="bg-warning hover:bg-warning/85 text-primary text-sm font-semibold px-4 py-2 rounded-lg transition-smooth whitespace-nowrap cursor-pointer"
        >
          Upgrade Plan
        </button>
      </div>
    );
  }

  return null;
};

export default UpgradeBanner;
