export default function AssessmentTimer({
  formatted,
  urgency,
  isExpired,
  showWarningModal,
  onWarningModalClose,
}) {
  // Determine clock icon color based on state and urgency
  let clockColorClass = 'text-text-secondary'
  if (isExpired || urgency === 'critical') {
    clockColorClass = 'text-text-error'
  } else if (urgency === 'warning') {
    clockColorClass = 'text-warning'
  }

  // Determine timer text classes and inline style overrides based on state
  let timerTextClass = 'font-mono text-lg font-medium transition-colors duration-200 text-text-secondary'
  let timerStyle = {}

  if (isExpired) {
    timerTextClass = 'font-mono text-lg font-bold text-error transition-colors duration-200'
  } else if (urgency === 'warning') {
    timerTextClass = 'font-mono text-lg font-medium text-warning animate-pulse transition-colors duration-200'
  } else if (urgency === 'critical') {
    timerTextClass = 'font-mono text-lg font-bold text-error animate-pulse transition-colors duration-200'
    timerStyle = { animationDuration: '0.8s' }
  }

  return (
    <>
      {/* Main Timer Display */}
      <div className="inline-flex items-center gap-2 select-none">
        {/* Clock icon inline SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: '18px', height: '18px' }}
          className={`shrink-0 ${clockColorClass}`}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>

        {/* Semantic time element */}
        <time style={timerStyle} className={timerTextClass}>
          {isExpired ? "Time's Up" : formatted}
        </time>
      </div>

      {/* Warning Modal overlay */}
      {showWarningModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timer-warning-heading"
          aria-describedby="timer-warning-description"
        >
          <div className="bg-secondary border border-border-default rounded-2xl p-6 md:p-8 w-[90%] max-w-sm flex flex-col items-center text-center animate-fade-in-up">
            {/* Warning Triangle icon inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-10 h-10 text-warning"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>

            {/* Modal Heading */}
            <h2
              id="timer-warning-heading"
              className="text-text-primary text-xl font-bold mt-4 mb-2"
            >
              5 Minutes Remaining
            </h2>

            {/* Modal Body */}
            <p
              id="timer-warning-description"
              className="text-text-secondary text-sm leading-relaxed"
            >
              You have 5 minutes left. Please review your answers and submit when ready.
            </p>

            {/* Action Button */}
            <button
              type="button"
              onClick={onWarningModalClose}
              className="w-full mt-6 py-2.5 rounded-lg bg-accent text-white font-semibold transition-colors duration-200 hover:bg-accent-hover focus:outline-none"
            >
              Got it, I'll hurry
            </button>
          </div>
        </div>
      )}
    </>
  )
}
