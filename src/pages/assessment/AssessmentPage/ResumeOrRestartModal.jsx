import React from "react";

export default function ResumeOrRestartModal({
  assessment,
  isExpired,
  onResume,
  onRestart,
  isSubmitting = false,
}) {
  const attempt = assessment?.attempt_number ?? 1;

  // Render branches
  let title = "";
  let message = "";
  let icon = null;
  let showResume = false;
  let showRestart = false;
  let note = "";

  if (!isExpired) {
    if (attempt === 1) {
      title = "Resume Assessment";
      message = "We detected a previous session that was in progress. Would you like to resume where you left off or start over from the beginning?";
      icon = (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="w-12 h-12 text-accent mx-auto mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      );
      showResume = true;
      showRestart = true;
    } else {
      title = "Resume Assessment";
      message = "An assessment session is currently in progress. You can resume your test to continue answering the questions.";
      icon = (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="w-12 h-12 text-accent mx-auto mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
          />
        </svg>
      );
      showResume = true;
      showRestart = false;
      note = "Note: The one-time restart for this assessment has already been used.";
    }
  } else {
    // Expired
    if (attempt === 1) {
      title = "Assessment Expired";
      message = "The timer for your assessment has expired. However, you have a one-time restart available to start the assessment over.";
      icon = (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="w-12 h-12 text-warning mx-auto mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
      showResume = false;
      showRestart = true;
      note = "Warning: Starting over will delete all your current responses and begin a fresh timer. This is your only allowed restart.";
    } else {
      title = "Assessment Expired";
      message = "This assessment has expired and the one-time restart has already been used. Please contact the recruiter for next steps.";
      icon = (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          className="w-12 h-12 text-error mx-auto mb-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      );
      showResume = false;
      showRestart = false;
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-secondary border border-border-default rounded-2xl p-6 md:p-8 w-full max-w-md text-center animate-fade-in-up shadow-2xl">
        {/* Dynamic Icon */}
        {icon}

        {/* Heading */}
        <h2 className="text-text-primary text-xl font-bold mb-3 font-sans">
          {title}
        </h2>

        {/* Message */}
        <p className="text-text-secondary text-sm mb-6 leading-relaxed font-sans">
          {message}
        </p>

        {/* Warning / Note Alert */}
        {note && (
          <div className="bg-primary/50 border border-border-default rounded-lg p-3 mb-6 text-left">
            <p className="text-text-secondary text-xs leading-relaxed font-sans font-medium">
              {note}
            </p>
          </div>
        )}

        {/* Button container */}
        <div className="flex flex-col sm:flex-row gap-3">
          {showResume && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onResume}
              className="flex-1 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors select-none font-sans disabled:opacity-50"
            >
              Resume Progress
            </button>
          )}

          {showRestart && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onRestart}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors select-none font-sans disabled:opacity-50 ${
                showResume
                  ? "border border-border-default bg-transparent text-text-primary hover:bg-tertiary"
                  : "bg-accent hover:bg-accent-hover text-white"
              }`}
            >
              {isSubmitting ? "Starting Over..." : "Start Over"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
