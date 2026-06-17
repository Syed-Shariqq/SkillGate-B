export const QUESTION_TYPES = {
  MCQ: 'mcq',
  TEXT: 'text',
}

export const QUESTION_COUNT = {
  MCQ: 5,
  TEXT: 3,
  TOTAL: 8,
}

export const SCORING = {
  MAX_SCORE: 200,
  PASS_THRESHOLD_DEFAULT: 70,   
  TEXT_PASS_SCORE: 0.7,       
}

export const TIMER = {
  DURATION_MINUTES: 45,
  DURATION_SECONDS: 45 * 60,
  WARNING_THRESHOLD_SECONDS: 5 * 60,
}

export const ASSESSMENT_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
}

export const HIRING_SIGNALS = {
  STRONG_YES: 'Strong Yes',
  MAYBE: 'Maybe',
  NO: 'No',
}

export const CONFIDENCE_LABELS = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  HIGH_THRESHOLD: 75,
  MEDIUM_THRESHOLD: 50,
}