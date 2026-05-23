import { useState, useEffect, useRef } from 'react'

export default function TextQuestion({
  question,
  currentAnswer,
  onChange,
  disablePaste,
  lastSavedAt,
  disabled,
}) {
  const [hoveredButtonIndex, setHoveredButtonIndex] = useState(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [relativeTime, setRelativeTime] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const calculateRelativeTime = () => {
      if (!lastSavedAt) {
        setRelativeTime('')
        return
      }

      const ms = Date.now() - new Date(lastSavedAt).getTime()
      if (ms < 10000) {
        setRelativeTime('just now')
      } else {
        const n = Math.floor(ms / 60000)
        setRelativeTime(`${n}m ago`)
      }
    }

    calculateRelativeTime()

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(calculateRelativeTime, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [lastSavedAt])

  if (!question) return null

  const { question_text: questionText, points, difficulty } = question

  const getDifficultyStyles = (diff) => {
    let colorVar = 'var(--color-success)'
    if (diff === 'medium') colorVar = 'var(--color-warning)'
    if (diff === 'hard') colorVar = 'var(--color-error)'

    return {
      color: colorVar,
      backgroundColor: `color-mix(in srgb, ${colorVar} 15%, transparent)`,
    }
  }

  // 6 buttons in order: B, I, <>, {}, bullet-list, numbered-list
  const toolbarButtons = [
    { label: 'B', className: 'font-bold font-mono text-sm' },
    { label: 'I', className: 'italic font-mono text-sm' },
    { label: '<>', className: 'font-mono text-sm' },
    { label: '{}', className: 'font-mono text-sm' },
    { label: '•', className: 'text-lg font-mono' },
    { label: '1.', className: 'text-sm font-mono' },
  ]

  const text = (currentAnswer ?? '').trim()
  const wordCount = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length

  return (
    <div
      style={{ fontFamily: 'var(--font-sans)' }}
      className="w-full mx-auto px-4 md:px-0"
    >
      <style>{`
        .xs-hidden {
          display: none;
        }
        @media (min-width: 480px) {
          .xs-hidden {
            display: block;
          }
        }
      `}</style>

      {/* Difficulty + Points Badges (flex-wrap, gap-2, mb-4 md:mb-6) */}
      <div className="flex flex-row items-center flex-wrap gap-2 mb-4 md:mb-6">
        <span
          style={getDifficultyStyles(difficulty)}
          className="font-mono text-xs uppercase px-3 py-1 rounded-full font-semibold"
        >
          {difficulty}
        </span>
        <span
          style={{
            backgroundColor: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
          className="font-mono text-xs px-3 py-1 rounded-full font-semibold"
        >
          {points} pts
        </span>
      </div>

      {/* Question Text */}
      <h2
        style={{ color: 'var(--color-text-primary)' }}
        className="text-xl md:text-2xl font-bold leading-snug mb-4 md:mb-6"
      >
        {questionText}
      </h2>

      {/* Textarea Container */}
      <div className="w-full flex flex-col">
        {/* Toolbar (connected flush to textarea top) */}
        <div
          style={{
            backgroundColor: 'var(--color-secondary)',
            borderColor: 'var(--color-border-default)',
            borderStyle: 'solid',
            borderWidth: '1px',
          }}
          className="rounded-t-xl px-2 md:px-3 py-2 flex items-center flex-wrap gap-1"
        >
          {toolbarButtons.map((btn, index) => {
            const isHovered = hoveredButtonIndex === index
            return (
              <button
                key={index}
                type="button"
                onMouseEnter={() => setHoveredButtonIndex(index)}
                onMouseLeave={() => setHoveredButtonIndex(null)}
                style={{
                  minWidth: '28px',
                  minHeight: '28px',
                  width: '28px',
                  height: '28px',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: isHovered ? 'var(--color-tertiary)' : 'transparent',
                  transition: 'background-color 0.2s ease',
                }}
                className={`rounded flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-accent ${btn.className}`}
              >
                {btn.label}
              </button>
            )
          })}

          {/* Markdown hint on the right */}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-tertiary)',
            }}
            className="ml-auto text-xs xs-hidden"
          >
            Markdown supported
          </span>
        </div>

        {/* Textarea */}
        <textarea
          style={{
            backgroundColor: 'var(--color-secondary)',
            borderColor: isFocused ? 'var(--color-accent)' : 'var(--color-border-default)',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderTop: 'none',
            minHeight: isMobile ? '200px' : '280px',
            resize: 'vertical',
            color: 'var(--color-text-primary)',
            lineHeight: 1.7,
            outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
          className="rounded-b-xl px-3 md:px-4 py-3 md:py-4 w-full text-base font-normal"
          placeholder="Begin typing your response here..."
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          spellCheck={true}
          disabled={disabled}
          onChange={(e) => onChange(question.id, e.target.value)}
          value={currentAnswer ?? ''}
          {...(disablePaste ?? {})}
        />
      </div>

      {/* Footer Bar */}
      <div className="flex justify-between items-center mt-2 flex-wrap gap-2 w-full">
        {/* Left: relative time */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-tertiary)',
          }}
          className="text-xs"
        >
          {relativeTime ? relativeTime : ''}
        </span>

        {/* Right: word count */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-tertiary)',
          }}
          className="text-xs"
        >
          {wordCount} words
        </span>
      </div>
    </div>
  )
}
