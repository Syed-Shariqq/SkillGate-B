import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts'

import {
  getSessionFromStorage
} from '../../services/assessment/assessmentService'

import {
  getResult
} from '../../services/assessment/resultService'

import toast from 'react-hot-toast'

export default function AssessmentResult() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()

  // State
  const [result, setResult] = useState(null)
  const [pageStatus, setPageStatus] = useState('loading')
  const [expandedQuestions, setExpandedQuestions] = useState(new Set())
  const [retryCount, setRetryCount] = useState(0)

  // Initialize session directly during useState setup to avoid cascading render warnings in useEffect
  const [session] = useState(() => {
    const { data } = getSessionFromStorage()
    return data
  })

  // Refs
  const mountedRef = useRef(true)

  // Mount Flow & Data Fetching (driven by assessmentId, session, and retryCount to satisfy set-state-in-effect linter analysis)
  useEffect(() => {
    mountedRef.current = true

    const loadData = async () => {
      setPageStatus('loading')
      try {
        const res = await getResult({
          assessmentId,
          sessionToken: session?.sessionToken
        })

        if (!mountedRef.current) return

        if (res.error || !res.data) {
          setPageStatus('error')
        } else {
          setResult(res.data)
          setPageStatus('ready')
        }
      } catch {
        if (!mountedRef.current) return
        setPageStatus('error')
      }
    }

    loadData()

    return () => {
      mountedRef.current = false
    }
  }, [assessmentId, session, retryCount])

  // Recharts Theme Colors State
  const [chartColors, setChartColors] = useState({
    stroke: '#5b6df6',
    fill: '#5b6df6',
    grid: '#e2e8f0',
    text: '#64748b'
  })

  // Dynamically resolve colors from computed CSS variables asynchronously for theme accuracy
  useEffect(() => {
    if (pageStatus === 'ready') {
      const timerId = setTimeout(() => {
        if (!mountedRef.current) return
        const style = getComputedStyle(document.documentElement)
        const accent = style.getPropertyValue('--color-accent').trim() || '#5b6df6'
        const border = style.getPropertyValue('--color-border-default').trim() || '#e2e8f0'
        const text = style.getPropertyValue('--color-text-secondary').trim() || '#64748b'

        setChartColors({
          stroke: accent,
          fill: accent,
          grid: border,
          text: text
        })
      }, 0)

      return () => clearTimeout(timerId)
    }
  }, [pageStatus])

  // Radar Competency Mapping useMemo Heuristics
  const radarData = useMemo(() => {
    const qResults = result?.questionResults || []
    if (qResults.length === 0) return []

    const fallbackCategories = [
      'API Design',
      'Frontend Development',
      'Problem Solving',
      'Data Structures',
      'Database Systems',
      'System Architecture'
    ]

    const grouped = {}

    qResults.forEach((q, idx) => {
      let skill = fallbackCategories[idx % fallbackCategories.length]
      const text = (q.questionText || '').toLowerCase()

      // Basic semantic skill grouping
      if (text.includes('react') || text.includes('frontend') || text.includes('html') || text.includes('css') || text.includes('ui') || text.includes('component')) {
        skill = 'Frontend Development'
      } else if (text.includes('sql') || text.includes('database') || text.includes('query') || text.includes('mongodb') || text.includes('postgres')) {
        skill = 'Database Systems'
      } else if (text.includes('api') || text.includes('rest') || text.includes('http') || text.includes('endpoint')) {
        skill = 'API Design'
      } else if (text.includes('algorithm') || text.includes('complexity') || text.includes('tree') || text.includes('array') || text.includes('string')) {
        skill = 'Problem Solving'
      }

      // Convert score to percentage safely (0 - 100)
      let scoreVal = q.score ?? 0
      if (scoreVal <= 1 && scoreVal > 0) {
        scoreVal = scoreVal * 100
      }
      const finalScore = Math.min(Math.max(0, Math.round(scoreVal)), 100)

      if (!grouped[skill]) {
        grouped[skill] = { sum: 0, count: 0 }
      }
      grouped[skill].sum += finalScore
      grouped[skill].count += 1
    })

    return Object.entries(grouped).map(([skill, data]) => ({
      skill,
      score: Math.round(data.sum / data.count)
    }))
  }, [result])

  // Textual skill summary for screen readers & accessible comprehension
  const compactSkillsText = useMemo(() => {
    return radarData.map((item) => `${item.skill}: ${item.score}`).join(' · ')
  }, [radarData])

  // Date Completed Formatting
  const completedDateText = useMemo(() => {
    if (!result?.completedAt) return null
    try {
      const dateStr = new Date(result.completedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      return `Completed on ${dateStr}`
    } catch {
      return null
    }
  }, [result])

  // Score Clamping and Color Logic
  const scoreVal = useMemo(() => {
    if (result?.overallScore === null || result?.overallScore === undefined) return null
    return Math.min(Math.max(0, Math.round(result.overallScore)), 100)
  }, [result])

  const scoreColorClass = useMemo(() => {
    if (scoreVal === null) return 'text-text-tertiary'
    if (scoreVal >= 70) return 'text-success'
    if (scoreVal >= 50) return 'text-warning'
    return 'text-error'
  }, [scoreVal])

  const isPassed = useMemo(() => {
    return scoreVal !== null && scoreVal >= 70
  }, [scoreVal])

  // Processing Fallback state
  const isStillProcessing = useMemo(() => {
    return (
      result?.overallScore === null &&
      !result?.feedback &&
      (!result?.questionResults || result.questionResults.length === 0)
    )
  }, [result])

  // Accordion Toggle
  const toggleQuestion = useCallback((qId) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(qId)) {
        next.delete(qId)
      } else {
        next.add(qId)
      }
      return next
    })
  }, [])

  // Dynamic share text & LinkedIn Action
  const handleShareLinkedIn = useCallback(() => {
    const baseUrl = 'https://www.linkedin.com/sharing/share-offsite/'
    const shareUrl = 'https://skillgate.app'
    const fullUrl = `${baseUrl}?url=${encodeURIComponent(shareUrl)}`
    window.open(fullUrl, '_blank', 'noopener,noreferrer')
  }, [])

  // Loading State
  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4">
        {/* Spinner SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="w-8 h-8 animate-spin text-accent"
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
        <p className="text-text-secondary text-sm mt-4 font-medium select-none animate-pulse">
          Loading your results...
        </p>
      </div>
    )
  }

  // Error State
  if (pageStatus === 'error') {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-secondary border border-border-default rounded-xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-error font-semibold text-xl mb-2">Unable to load results</h2>
          <p className="text-text-secondary text-sm mb-6">
            Please try again or check your email for results
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => setRetryCount((prev) => prev + 1)}
              className="bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors font-medium text-sm select-none"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="border border-border-default hover:bg-tertiary text-text-primary rounded-lg px-4 py-2 transition-colors font-medium text-sm select-none"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Top Sticky Navigation */}
      <header className="sticky top-0 z-20 bg-secondary border-b border-border-default px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left Section */}
        <div className="text-sm select-none">
          <span className="font-bold text-text-primary">SkillGate</span>
          <span className="text-text-tertiary font-normal"> · Results</span>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => toast('PDF export coming soon')}
            className="border border-border-default rounded-lg px-3 py-1.5 text-xs text-text-primary hover:bg-tertiary transition-colors font-medium select-none"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleShareLinkedIn}
            className="bg-accent text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-colors select-none"
          >
            Share Result
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow py-8 md:py-12">
        {/* Hero Section */}
        <section className="px-4 text-center max-w-3xl mx-auto mb-10 select-none">
          <span className="font-mono text-xs uppercase tracking-widest text-text-tertiary mb-2 block">
            OVERALL SCORE
          </span>

          {/* Score display */}
          <div className="flex items-end justify-center">
            <span className={`text-6xl md:text-7xl font-bold leading-none ${scoreColorClass}`}>
              {scoreVal !== null ? scoreVal : '—'}
            </span>
            {scoreVal !== null && <span className="text-2xl text-text-tertiary font-mono ml-1">/100</span>}
          </div>

          {/* Pass/Fail Badge */}
          {scoreVal !== null && (
            <span
              className={`font-mono text-xs uppercase px-4 py-1.5 rounded-full font-semibold mt-3 mb-4 inline-block ${
                isPassed ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
              }`}
            >
              {isPassed ? 'Passed' : 'Failed'}
            </span>
          )}

          {/* Feedback Section */}
          <div className="mt-4 max-w-xl mx-auto">
            {isStillProcessing ? (
              <p className="text-text-secondary text-sm italic">
                Your assessment is still being processed. Results will appear shortly.
              </p>
            ) : (
              <p className="text-text-secondary text-base leading-relaxed">
                {result?.feedback || 'Your assessment has been completed and results recorded.'}
              </p>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => toast('Report export coming soon')}
              className="border border-border-default text-text-primary rounded-lg px-4 py-2 hover:bg-tertiary transition-colors font-medium text-xs select-none"
            >
              ↓ Download Report
            </button>
            <button
              type="button"
              onClick={handleShareLinkedIn}
              className="bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors font-semibold text-xs select-none"
            >
              ↗ Share on LinkedIn
            </button>
          </div>

          {/* Completed Timestamp */}
          {completedDateText && (
            <p className="text-text-tertiary text-xs font-mono mt-4 block">{completedDateText}</p>
          )}
        </section>

        {/* Competency Passport Radar Chart */}
        {radarData.length > 0 && (
          <section className="max-w-2xl mx-auto px-4 mb-8">
            <div className="bg-secondary border border-border-default rounded-2xl p-6 shadow-sm">
              <div className="mb-6 select-none">
                <h2 className="text-text-primary font-semibold text-lg mb-1">AI Skill Passport</h2>
                <p className="text-text-secondary text-xs">
                  Competency mapping across assessed areas
                </p>
              </div>

              {/* Radar Chart responsive container */}
              <div className="w-full flex justify-center">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke={chartColors.grid} />
                    <PolarAngleAxis
                      dataKey="skill"
                      tick={{ fill: chartColors.text, fontSize: 11, fontWeight: 500 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke={chartColors.stroke}
                      fill={chartColors.fill}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-secondary, #1c1c1f)',
                        borderColor: 'var(--color-border-default, #2d2d30)',
                        color: 'var(--color-text-primary, #ffffff)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Textual Accessibility Summary */}
              <p className="text-center text-text-tertiary text-xs mt-4 font-medium select-none leading-relaxed">
                {compactSkillsText}
              </p>
            </div>
          </section>
        )}

        {/* Detailed Breakdown Accordions */}
        {result?.questionResults && result.questionResults.length > 0 && (
          <section className="max-w-2xl mx-auto px-4 mb-8">
            <h2 className="text-text-primary font-semibold text-lg mb-4 select-none">
              Question Breakdown
            </h2>

            {result.questionResults.map((q, idx) => {
              const isExpanded = expandedQuestions.has(q.questionId)
              const scoreBadge = q.score !== null ? `${q.score}/1` : '—'

              return (
                <div
                  key={q.questionId || idx}
                  className="bg-secondary border border-border-default rounded-xl mb-3 overflow-hidden shadow-sm"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`faq-content-${q.questionId}`}
                    onClick={() => toggleQuestion(q.questionId)}
                    className="flex items-center justify-between p-4 w-full text-left focus:outline-none hover:bg-tertiary transition-colors"
                  >
                    {/* Left Info */}
                    <div className="flex items-center min-w-0 mr-3">
                      <span className="bg-tertiary text-text-tertiary font-mono text-xs px-2 py-0.5 rounded mr-3 flex-shrink-0 select-none">
                        Q{idx + 1}
                      </span>
                      <span className="text-text-primary text-sm font-medium truncate">
                        {q.questionText || 'Assessed Question'}
                      </span>
                    </div>

                    {/* Right Badges & Chevron */}
                    <div className="flex items-center gap-3 flex-shrink-0 select-none">
                      <span className="bg-accent/15 text-accent font-mono text-xs px-2 py-0.5 rounded">
                        {scoreBadge}
                      </span>

                      {/* Rotating Chevron inline SVG */}
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
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded AI feedback panel */}
                  {isExpanded && (
                    <div
                      id={`faq-content-${q.questionId}`}
                      className="px-4 pb-4 pt-4 border-t border-border-default bg-tertiary/10 animate-fade-in-up"
                    >
                      <h4 className="font-mono text-xs uppercase tracking-wider text-text-tertiary mb-2 font-semibold select-none">
                        AI Feedback
                      </h4>
                      {q.feedback ? (
                        <p className="text-text-secondary text-sm leading-relaxed">{q.feedback}</p>
                      ) : (
                        <p className="text-text-tertiary italic text-sm">
                          Feedback is being generated...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {/* Completion Card Receipts */}
        <section className="max-w-2xl mx-auto px-4 mb-8">
          <div className="bg-secondary border border-border-default rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Left Side */}
              <div className="flex gap-3 items-start sm:items-center">
                {/* Check Circle SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success shrink-0 w-8 h-8"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>

                <div>
                  <h3 className="text-text-primary font-semibold text-base leading-none">
                    Assessment Complete
                  </h3>
                  <p className="text-text-secondary text-sm mt-1">
                    Your responses have been securely recorded and shared with the hiring team.
                  </p>
                </div>
              </div>

              {/* Right Side Buttons */}
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => toast('Coming soon')}
                  className="border border-border-default text-text-primary rounded-lg px-3 py-2 text-xs font-semibold hover:bg-tertiary transition-colors w-full select-none"
                >
                  Download PDF Receipt
                </button>
                <button
                  type="button"
                  onClick={() => toast('Coming soon')}
                  className="border border-border-default text-text-primary rounded-lg px-3 py-2 text-xs font-semibold hover:bg-tertiary transition-colors w-full select-none"
                >
                  Explore Growth Roadmap
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-secondary border-t border-border-default px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto select-none">
        {/* Left */}
        <div className="text-xs text-text-tertiary flex items-center gap-1.5">
          <span className="font-bold text-text-primary text-sm">SkillGate</span>
          <span className="text-[10px] bg-tertiary border border-border-default px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">
            AI Powered Hiring
          </span>
        </div>

        {/* Center */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-text-tertiary">
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Privacy Policy
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Terms of Service
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Security Compliance
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            API Documentation
          </span>
          <span className="hover:text-text-secondary transition-colors cursor-pointer">
            Support
          </span>
        </div>

        {/* Right */}
        <div className="text-xs text-text-tertiary text-center sm:text-right">
          &copy; 2024 SkillGate AI. Precision Engineering for Talent.
        </div>
      </footer>
    </div>
  )
}
