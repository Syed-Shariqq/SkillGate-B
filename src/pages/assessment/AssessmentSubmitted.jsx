import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessionFromStorage } from '@/services/assessment/assessmentService'
import { pollForResult } from '@/services/assessment/resultService'

export default function AssessmentSubmitted() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [pollStatus, setPollStatus] = useState('polling')
  const [completedStages, setCompletedStages] = useState(0)
  const [headerStatus, setHeaderStatus] = useState('Processing...')

  // Purely initialize state values to avoid synchronous setState inside useEffect
  const [assessmentId] = useState(() => {
    const session = getSessionFromStorage()?.data
    return session?.assessmentId || null
  })

  const [sessionToken] = useState(() => {
    const session = getSessionFromStorage()?.data
    return session?.sessionToken || ''
  })

  const mountedRef = useRef(true)
  const timeoutsRef = useRef([])

  useEffect(() => {
    // Read session on mount
    const sessionData = getSessionFromStorage()
    const session = sessionData?.data

    if (!session) {
      navigate('/assess/' + token, { replace: true })
      return
    }

    // Start stage animation independently of polling
    const setStageTimeout = (stagesCount, delay) => {
      const id = setTimeout(() => {
        if (mountedRef.current) {
          setCompletedStages((prev) => Math.max(prev, stagesCount))
        }
      }, delay)
      timeoutsRef.current.push(id)
    }

    setStageTimeout(1, 3000)
    setStageTimeout(2, 8000)
    setStageTimeout(3, 14000)
    setStageTimeout(4, 20000)

    // Start pollForResult with AbortController
    const abortController = new AbortController()

    pollForResult(session.assessmentId, {
      maxAttempts: 15,
      initialDelayMs: 2000,
      signal: abortController.signal,
    })
      .then((res) => {
        if (!mountedRef.current) return

        if (res.error) {
          const err = res.error
          if (err.code === 'POLL_TIMEOUT') {
            setPollStatus('timeout')
          } else if (err.code === 'EVALUATION_FAILED') {
            setPollStatus('error')
          } else if (err.code === 'EVALUATION_DELAYED') {
            setPollStatus('delayed')
          } else if (
            err.code === 'TOKEN_EXPIRED' ||
            err.code === 'TOKEN_INVALID' ||
            err.code === 'VALIDATION_ERROR' ||
            err.code === 'SESSION_NOT_FOUND'
          ) {
            navigate('/assess/' + token, { replace: true })
          } else {
            setPollStatus('error')
          }
          return
        }

        // Success!
        setCompletedStages(4)
        setPollStatus('complete')
        setHeaderStatus('Complete')

        const navigateId = setTimeout(() => {
          if (mountedRef.current) {
            navigate('/assess/' + token + '/result/' + session.assessmentId)
          }
        }, 1000)
        timeoutsRef.current.push(navigateId)
      })
      .catch(() => {
        if (!mountedRef.current) return
        setPollStatus('error')
      })

    const timeouts = timeoutsRef.current

    return () => {
      mountedRef.current = false
      abortController.abort()
      timeouts.forEach((id) => clearTimeout(id))
    }
  }, [token, navigate])

  const stages = [
    { index: 1, name: 'Analyzing responses', subtext: null },
    { index: 2, name: 'Evaluating technical reasoning', subtext: 'Processing code complexity and logic trees...' },
    { index: 3, name: 'Verifying skill signals', subtext: null },
    { index: 4, name: 'Generating recruiter insights', subtext: null },
  ]

  const firstTwelveChars = sessionToken ? sessionToken.substring(0, 12) : ''

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-10 bg-secondary border-b border-border-default px-4 md:px-6 py-3 flex items-center justify-between">
        <span className="font-mono text-sm text-text-tertiary">
          AI Assessment Engine
        </span>

        {/* Right Status */}
        <div className="flex items-center gap-2">
          {pollStatus !== 'complete' ? (
            <>
              {/* Clock inline SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-text-tertiary shrink-0"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-text-secondary text-sm font-mono">
                {headerStatus}
              </span>
            </>
          ) : (
            <>
              {/* Check-circle inline SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-success shrink-0"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-success text-sm font-mono">
                {headerStatus}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 pb-20 text-center max-w-lg mx-auto w-full">
        {/* Entrance Animation Wrapper */}
        <div className="animate-fade-in-up w-full flex flex-col items-center">
          {/* Top Circular Container */}
          <div className="w-16 h-16 rounded-full bg-secondary border border-border-default flex items-center justify-center mx-auto mb-6">
            {/* Check-circle inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-accent"
              aria-hidden="true"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
            Submission Received
          </h1>

          {/* Subtext */}
          <p className="text-text-secondary text-sm max-w-sm mx-auto mb-8 leading-relaxed">
            Your assessment data has been securely transmitted. Our AI intelligence engine is now processing your responses.
          </p>

          {/* Intelligence Engine Card */}
          <div className="bg-secondary border border-border-default rounded-xl p-5 md:p-6 w-full mb-4 text-left">
            {/* Card Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center">
                {/* CPU inline SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-text-tertiary shrink-0"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" />
                  <line x1="20" y1="15" x2="23" y2="15" />
                  <line x1="1" y1="9" x2="4" y2="9" />
                  <line x1="1" y1="15" x2="4" y2="15" />
                </svg>
                <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary ml-2 font-bold">
                  INTELLIGENCE ENGINE
                </span>
              </div>

              {/* Right badge */}
              {pollStatus !== 'complete' ? (
                <span className="bg-warning/15 text-warning font-mono text-xs px-2 py-1 rounded-full font-semibold">
                  Evaluating
                </span>
              ) : (
                <span className="bg-success/15 text-success font-mono text-xs px-2 py-1 rounded-full font-semibold">
                  Complete
                </span>
              )}
            </div>

            {/* 4 Processing Stages */}
            <div className="flex flex-col gap-4">
              {stages.map((stage) => {
                const isComplete = completedStages >= stage.index
                const isActive =
                  completedStages === stage.index - 1 && pollStatus === 'polling'

                let rowClass = 'flex items-start gap-3'
                let iconElement = null
                let textClass = 'text-sm font-medium'
                let subtextElement = null

                if (isComplete) {
                  iconElement = (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5 shrink-0 mt-0.5 text-success"
                      aria-hidden="true"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )
                  textClass += ' text-text-primary'
                  subtextElement = (
                    <span className="text-success text-xs font-mono mt-0.5 block">
                      Complete
                    </span>
                  )
                } else if (isActive) {
                  iconElement = (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5 shrink-0 mt-0.5 text-accent animate-pulse"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" fill="currentColor" />
                    </svg>
                  )
                  textClass += ' text-text-primary'
                  if (stage.subtext) {
                    subtextElement = (
                      <span className="text-text-secondary text-xs mt-0.5 block leading-relaxed">
                        {stage.subtext}
                      </span>
                    )
                  }
                } else {
                  // Pending
                  iconElement = (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5 shrink-0 mt-0.5 text-text-tertiary"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  )
                  textClass += ' text-text-tertiary'
                  subtextElement = (
                    <span className="text-text-tertiary text-xs font-mono mt-0.5 block">
                      Pending
                    </span>
                  )
                }

                return (
                  <div key={stage.index} className={rowClass}>
                    {iconElement}
                    <div className="flex-1">
                      <span className={textClass}>{stage.name}</span>
                      {subtextElement}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* What Happens Next Card */}
          <div className="bg-secondary border border-border-default rounded-xl p-4 w-full mb-6 flex items-start gap-3 text-left">
            {/* Info inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-text-tertiary shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <h4 className="text-text-primary text-sm font-semibold mb-1">
                What happens next?
              </h4>
              <p className="text-text-secondary text-xs leading-relaxed">
                Your detailed evaluation report is currently being compiled. This process typically takes a few moments. If you need to step away, you will be notified via email once your results are ready for review.
              </p>
            </div>
          </div>

          {/* View Results Button or Long-polling Error states */}
          {pollStatus === 'polling' && (
            <button
              type="button"
              disabled
              className="w-full bg-secondary border border-border-default text-text-secondary rounded-lg py-3 font-semibold cursor-not-allowed opacity-60 flex items-center justify-center focus:outline-none"
            >
              {/* Spinner inline SVG */}
              <svg
                className="animate-spin h-4 w-4 mr-2 text-text-secondary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              View Results
            </button>
          )}

          {pollStatus === 'complete' && (
            <button
              type="button"
              onClick={() =>
                navigate('/assess/' + token + '/result/' + assessmentId)
              }
              className="w-full bg-accent text-white rounded-lg py-3 font-semibold hover:bg-accent-hover transition-colors focus:outline-none"
            >
              &rarr; View Results
            </button>
          )}

          {(pollStatus === 'timeout' || pollStatus === 'error') && (
            <div className="w-full flex flex-col items-center">
              <p className="text-warning text-sm text-center leading-relaxed">
                Processing is taking longer than expected. We'll email you when your results are ready.
              </p>
              {pollStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-3 bg-secondary border border-border-default text-text-primary rounded-lg px-4 py-2 font-semibold hover:bg-tertiary transition-colors focus:outline-none text-sm"
                >
                  Refresh
                </button>
              )}
            </div>
          )}

          {pollStatus === 'delayed' && (
            <div className="w-full flex flex-col items-center">
              <p className="text-warning text-sm text-center font-semibold mb-2">
                Results delayed
              </p>
              <p className="text-text-secondary text-sm text-center leading-relaxed">
                Your results are taking a bit longer than expected — we'll email you as soon as they're ready.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Fixed Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-border-default px-4 md:px-6 py-2 flex items-center justify-between z-10">
        <span className="font-mono text-xs text-text-tertiary">
          Assessment in Progress &bull; Confidential
        </span>
        <span className="font-mono text-xs text-text-tertiary">
          Session ID: {firstTwelveChars}
        </span>
      </footer>
    </div>
  )
}
