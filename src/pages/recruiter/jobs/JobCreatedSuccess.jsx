import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

const JobCreatedSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

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

  const assessmentLink = `https://skill-gate-b.vercel.app/assess/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(assessmentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

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
        <p className="text-text-secondary text-sm mt-2">
          Share the link below with candidates to start screening.
        </p>

        {/* Job Title Display */}
        <div className="text-accent font-semibold text-base mt-4 font-sans">
          {jobTitle}
        </div>

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
          <div className="bg-white p-3 rounded-lg inline-block">
            <QRCodeSVG value={assessmentLink} size={160} />
          </div>
        </div>

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
