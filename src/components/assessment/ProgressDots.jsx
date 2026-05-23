export default function ProgressDots({
  title,
  questions = [],
  answers = {},
  currentIndex,
  onNavigate,
  disabled,
}) {
  const total = questions.length

  // Calculate the answered questions based on the trimmed content length
  const answeredCount = questions.reduce((count, q) => {
    const isAnswered = String(answers[q.id] ?? '').trim().length > 0
    return isAnswered ? count + 1 : count
  }, 0)

  // Avoid divide-by-zero errors
  const progressPercentage = total === 0 ? 0 : (answeredCount / total) * 100

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Progress Bar */}
      <div className="w-full h-1 bg-tertiary rounded-full overflow-hidden">
        <div
          style={{ width: `${progressPercentage}%` }}
          className="h-full bg-accent rounded-full transition-[width] duration-300"
        />
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-border-default flex flex-col">
        <h1 className="text-text-primary text-sm font-semibold truncate">
          {title}
        </h1>
        <span className="text-text-secondary text-xs mt-0.5">
          {answeredCount} of {total} Completed
        </span>
      </div>

      {/* Question List */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {questions.map((q, i) => {
            const isCurrent = currentIndex === i
            const isFlagged = q.flagged === true && !isCurrent
            const isAnswered = String(answers[q.id] ?? '').trim().length > 0
            const isAnsweredState = isAnswered && !isCurrent && !isFlagged

            // Default State
            let btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 transition-colors duration-150 bg-transparent hover:bg-tertiary text-text-secondary'
            let iconElement = (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-text-tertiary"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="6" />
              </svg>
            )

            // Current State
            if (isCurrent) {
              btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 transition-colors duration-150 bg-accent/15 text-accent font-medium'
              iconElement = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="shrink-0 text-accent"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6" fill="currentColor" />
                </svg>
              )
            } else if (isFlagged) { // Flagged State
              btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 transition-colors duration-150 bg-transparent hover:bg-tertiary text-warning'
              iconElement = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="shrink-0 text-warning"
                  aria-hidden="true"
                >
                  <path d="M3 2v12M3 3h9l-2 3 2 3H3" />
                </svg>
              )
            } else if (isAnsweredState) { // Answered State
              btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 transition-colors duration-150 bg-transparent hover:bg-tertiary text-text-primary'
              iconElement = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="shrink-0 text-success"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="m5.5 8 1.5 1.5 3.5-3.5" />
                </svg>
              )
            }

            // Disabled state override
            if (disabled) {
              btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 opacity-60 cursor-not-allowed pointer-events-none'
              // Remove hover background colors
              if (isCurrent) {
                btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 opacity-60 cursor-not-allowed pointer-events-none bg-accent/15 text-accent font-medium'
              } else if (isFlagged) {
                btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 opacity-60 cursor-not-allowed pointer-events-none text-warning'
              } else if (isAnsweredState) {
                btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 opacity-60 cursor-not-allowed pointer-events-none text-text-primary'
              } else {
                btnClass = 'w-full h-9 rounded-lg px-3 flex items-center gap-2.5 opacity-60 cursor-not-allowed pointer-events-none text-text-secondary'
              }
            }

            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(i)}
                  disabled={disabled}
                  aria-label={`Navigate to Question ${i + 1}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={btnClass}
                >
                  {iconElement}
                  <span className="text-sm truncate">
                    Question {i + 1}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
