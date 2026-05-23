import React from 'react'
import MCQQuestion from '../../../components/assessment/MCQQuestion'
import TextQuestion from '../../../components/assessment/TextQuestion'

export default function QuestionContainer({
  question,
  currentIndex,
  totalQuestions,
  selectedAnswer,
  onAnswer,
  disablePaste,
  lastSavedAt,
  disabled
}) {
  if (!question) return null

  return (
    <div
      key={question.id}
      className="w-full flex flex-col px-4 md:px-8 py-6 md:py-8 animate-fade-in-up"
    >
      {/* Question Badge (top, mb-6) */}
      <div className="flex flex-wrap items-center mb-6">
        <span className="bg-secondary border border-border-default rounded-full px-3 py-1 font-mono text-xs text-text-tertiary">
          Question {currentIndex + 1}
        </span>
        <span className="text-text-tertiary mx-2">·</span>
        <span className="text-xs text-text-tertiary">
          {totalQuestions} Questions Total
        </span>
      </div>

      {/* Question Render */}
      {question.question_type === 'mcq' && (
        <MCQQuestion
          question={question}
          selectedAnswer={selectedAnswer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      )}

      {question.question_type === 'text' && (
        <TextQuestion
          question={question}
          currentAnswer={selectedAnswer ?? ''}
          onChange={onAnswer}
          disablePaste={disablePaste}
          lastSavedAt={lastSavedAt}
          disabled={disabled}
        />
      )}
    </div>
  )
}
