import React from 'react'
import AssessmentTimer from '@/components/assessment/AssessmentTimer'

export default function AssessmentHeader({
  isAutosaving,
  saveStatus,
  pendingCount = 0,
  formatted,
  urgency,
  isExpired,
  showWarningModal,
  onWarningModalClose
}) {
  return (
    <header className="sticky top-0 z-20 bg-secondary border-b border-border-default px-4 md:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left Side */}
      <div className="flex items-center gap-3">
        {/* Small CPU icon SVG 16x16 */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-tertiary shrink-0"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 1v3" />
          <path d="M15 1v3" />
          <path d="M9 20v3" />
          <path d="M15 20v3" />
          <path d="M20 9h3" />
          <path d="M20 15h3" />
          <path d="M1 9h3" />
          <path d="M1 15h3" />
        </svg>

        <span className="font-mono text-sm text-text-tertiary select-none">
          AI Assessment Engine
        </span>

        {/* Separator */}
        <div className="hidden md:block w-px h-4 bg-border-default" />

        {/* Autosave indicator */}
        <div className="hidden md:flex items-center gap-1.5 select-none">
          {saveStatus === "saving" ? (
            <>
              {/* Spinner SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                className="animate-spin w-3 h-3 text-text-tertiary shrink-0"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-xs text-text-tertiary">Saving...</span>
            </>
          ) : saveStatus === "saved" ? (
            <>
              {/* Check SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 text-success shrink-0"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="font-mono text-xs text-text-tertiary">Saved</span>
            </>
          ) : saveStatus === "offline" ? (
            <>
              {/* Warning Icon SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 text-warning shrink-0"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="font-mono text-xs text-warning">
                Offline — {pendingCount} pending
              </span>
            </>
          ) : (
            <>
              {/* Check SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 text-success shrink-0"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="font-mono text-xs text-text-tertiary">Auto-saving</span>
            </>
          )}
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Distraction-free mode toggle (visual only) */}
        <div className="hidden md:flex items-center gap-2 select-none">
          {/* Eye SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-tertiary shrink-0"
          >
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-xs text-text-tertiary">Distraction-free mode</span>
          {/* Toggle pill UI */}
          <div className="w-7 h-4 bg-tertiary border border-border-default rounded-full relative flex items-center p-0.5 cursor-not-allowed">
            <div className="w-2.5 h-2.5 bg-accent rounded-full translate-x-3 transition-transform" />
          </div>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-4 bg-border-default" />

        {/* Assessment Timer Component */}
        <AssessmentTimer
          formatted={formatted}
          urgency={urgency}
          isExpired={isExpired}
          showWarningModal={showWarningModal}
          onWarningModalClose={onWarningModalClose}
        />
      </div>
    </header>
  )
}
