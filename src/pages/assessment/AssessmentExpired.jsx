import { useLocation, useNavigate } from 'react-router-dom'

export default function AssessmentExpired() {
  const location = useLocation()
  const navigate = useNavigate()

  // Safely extract potential variables with generic fallbacks
  const { jobTitle, company, expiredAt } = location.state || {}

  const showCard = Boolean(jobTitle || company || expiredAt)

  // Format expiredAt if present
  const formattedExpiredAt = expiredAt
    ? new Date(expiredAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
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
            {/* Alarm-clock-off inline SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-error"
              aria-hidden="true"
            >
              <path d="M5 2h14" />
              <path d="M12 6H8a4 4 0 0 0-4 4v7c0 .5-.2 1-.5 1.5M16.5 10.5A4 4 0 0 1 18 14v4a2 2 0 0 1-2 2H8c-.5 0-1-.2-1.5-.5" />
              <path d="M12 17v4" />
              <path d="m2 2 20 20" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold text-text-primary mb-3">
            Assessment Expired
          </h1>

          {/* Subtext */}
          <p className="text-text-secondary text-base max-w-sm mx-auto mb-8">
            The deadline for this assessment has passed, or the recruiter has closed submissions for this role.
          </p>

          {/* Assessment Details Card */}
          {showCard && (
            <div className="bg-secondary border border-border-default rounded-xl p-6 w-full mb-8 text-left">
              <h2 className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-4">
                ASSESSMENT DETAILS
              </h2>

              {/* Role Row */}
              <div className="flex justify-between items-center py-2">
                <span className="text-text-tertiary text-sm">Role</span>
                <span className="text-text-primary font-semibold text-sm">
                  {jobTitle || '—'}
                </span>
              </div>

              {/* Company Row */}
              <div className="flex justify-between items-center py-2">
                <span className="text-text-tertiary text-sm">Company</span>
                <span className="text-text-primary font-semibold text-sm">
                  {company || '—'}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-border-default my-2" />

              {/* Expired On Row */}
              <div className="flex justify-between items-center py-2">
                <span className="text-text-tertiary text-sm">Expired On</span>
                <span className="text-error font-mono text-sm">
                  {formattedExpiredAt}
                </span>
              </div>
            </div>
          )}

          {/* What Should I Do Section */}
          <section className="mb-8">
            <h3 className="text-text-primary text-xl font-semibold mb-3">
              What should I do?
            </h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto leading-relaxed">
              If you believe this is a mistake or would like to request an extension, please contact your recruiter directly.
            </p>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-accent text-white rounded-lg px-5 py-2.5 font-semibold hover:bg-accent-hover transition-colors w-full sm:w-auto focus:outline-none"
            >
              Return to Candidate Portal
            </button>
            <button
              type="button"
              onClick={() => window.open('mailto:support@skillgate.app')}
              className="bg-secondary border border-border-default text-text-primary rounded-lg px-5 py-2.5 font-semibold hover:bg-tertiary transition-colors w-full sm:w-auto focus:outline-none"
            >
              Contact Support
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
