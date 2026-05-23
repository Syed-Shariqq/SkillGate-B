import React from 'react'

export default function NavigationControls({
  currentIndex,
  totalQuestions,
  isFirstQuestion,
  isLastQuestion,
  isFlagged,
  isSubmitting,
  onPrevious,
  onNext,
  onFlag,
  onSubmit
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-secondary border-t border-border-default px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
      {/* Left - Previous Button */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstQuestion}
        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border border-border-default bg-transparent text-text-secondary hover:bg-tertiary hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none font-sans text-sm font-medium"
      >
        {/* Left Arrow SVG 16x16 */}
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
          className="shrink-0"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span className="hidden md:inline">Previous</span>
      </button>

      {/* Center - Flag Button */}
      <button
        type="button"
        onClick={onFlag}
        className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border transition-colors select-none font-sans text-sm font-medium ${
          isFlagged
            ? 'border-warning/50 bg-warning/10 text-warning'
            : 'border-border-default bg-transparent text-text-tertiary hover:bg-tertiary hover:text-warning'
        }`}
      >
        {/* Flag SVG 16x16 */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        <span className="hidden md:inline">
          {isFlagged ? 'Flagged' : 'Flag for Review'}
        </span>
      </button>

      {/* Right - Next or Submit Button */}
      {!isLastQuestion ? (
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition-colors select-none font-sans text-sm"
        >
          <span className="hidden md:inline">Next</span>
          {/* Right Arrow SVG 16x16 */}
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
            className="shrink-0"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg bg-success hover:bg-success/80 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none font-sans text-sm"
        >
          {isSubmitting ? (
            <>
              {/* Spinner SVG 16x16 */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                className="animate-spin shrink-0 text-white"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeLinecap="round" />
              </svg>
              <span className="hidden md:inline">Submitting...</span>
            </>
          ) : (
            <>
              <span className="hidden md:inline">Submit Test</span>
              {/* Check SVG 16x16 */}
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
                className="shrink-0"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  )
}
