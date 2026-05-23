import { useLocation, useNavigate } from 'react-router-dom'

export default function AssessmentAlreadyTaken() {
  const location = useLocation()
  const navigate = useNavigate()

  // Safely extract potential variables with generic fallbacks
  const {
    passed,
    score,
    jobTitle,
    company,
    submittedAt,
    assessmentId,
  } = location.state || {}

  const showScore = score !== null && score !== undefined

  // Format submittedAt date
  const formattedSubmittedAt = submittedAt
    ? new Date(submittedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-lg mx-auto w-full">
        {/* Entrance Animation Wrapper */}
        <div className="animate-fade-in-up w-full">
          {/* Top Icon Circular Container */}
          <div className="w-16 h-16 rounded-full bg-secondary border border-border-default flex items-center justify-center mx-auto mb-6">
            {passed === true ? (
              /* Shield-check SVG */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8 text-success"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 11 2 2 4-4" />
              </svg>
            ) : (
              /* Clipboard-x SVG */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8 text-text-tertiary"
                aria-hidden="true"
              >
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="m15 11-6 6" />
                <path d="m9 11 6 6" />
              </svg>
            )}
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
            You have already completed this assessment.
          </h1>

          {/* Subtext */}
          <p className="text-text-secondary text-base max-w-sm mx-auto mb-8 leading-relaxed">
            {passed === true
              ? 'Congratulations! You met the score threshold for this role. The recruiter has been notified and will be in touch.'
              : "You've already submitted your responses for this role. Unfortunately you didn't meet the threshold this time, but every attempt is a step forward."}
          </p>

          {/* Score Card */}
          {showScore && (
            <div className="bg-secondary border border-border-default rounded-xl p-6 w-full mb-8 flex flex-col items-center">
              <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
                YOUR SCORE
              </span>

              {/* Score Display */}
              <div className="flex items-end justify-center gap-1">
                <span
                  className={`text-5xl font-bold ${
                    passed === true ? 'text-success' : 'text-error'
                  }`}
                >
                  {score}
                </span>
                <span className="text-2xl text-text-tertiary font-mono">/100</span>
              </div>

              {/* Badge below score */}
              <div className="mt-3">
                {passed === true ? (
                  <span className="bg-success/15 text-success font-mono text-xs uppercase px-3 py-1 rounded-full font-semibold">
                    PASSED
                  </span>
                ) : (
                  <span className="bg-error/15 text-error font-mono text-xs uppercase px-3 py-1 rounded-full font-semibold">
                    DID NOT PASS
                  </span>
                )}
              </div>

              {/* Job info */}
              <p className="text-text-secondary text-sm mt-4 font-medium">
                {jobTitle && company ? `${jobTitle} at ${company}` : '—'}
              </p>

              {/* Submitted on */}
              <span className="text-text-tertiary text-xs font-mono mt-1">
                Submitted on {formattedSubmittedAt}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {passed === true && assessmentId && (
              <button
                type="button"
                onClick={() => navigate('/assess/result/' + assessmentId)}
                className="bg-accent text-white rounded-lg px-5 py-2.5 font-semibold hover:bg-accent-hover transition-colors w-full sm:w-auto focus:outline-none"
              >
                View Your Results
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-secondary border border-border-default text-text-primary rounded-lg px-5 py-2.5 font-semibold hover:bg-tertiary transition-colors w-full sm:w-auto focus:outline-none"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-secondary border-t border-border-default px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-primary text-sm">SkillGate</span>
          <span className="font-mono text-xs text-text-tertiary ml-2">
            AI POWERED HIRING
          </span>
        </div>

        {/* Center Section Links */}
        <div className="flex gap-4 flex-wrap justify-center">
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Privacy Policy
          </span>
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Terms of Service
          </span>
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Trust Center
          </span>
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Cookie Policy
          </span>
        </div>

        {/* Right Section */}
        <div className="text-xs text-text-tertiary">
          © 2024 SkillGate AI. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
