import { apiClient } from '../apiClient'
import { getSessionFromStorage } from './assessmentService'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
const MAX_ANSWER_LENGTH = 10000
const MAX_TIME_TAKEN_SECONDS = 86400

/**
 * Returns a normalized invalid-input response.
 *
 * @param {string} message
 * @param {string} [code]
 * @returns {{ data: null, error: { message: string, code?: string } }}
 */
const invalidInput = (message, code = 'VALIDATION_ERROR') => ({
  data: null,
  error: { message, code },
})

/**
 * Validates a UUID string.
 *
 * @param {string} value
 * @returns {boolean}
 */
const isValidUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value.trim())

/**
 * Validates a bounded non-negative integer.
 *
 * @param {unknown} value
 * @param {number} max
 * @returns {boolean}
 */
const isBoundedInteger = (value, max) => Number.isInteger(value) && value >= 0 && value <= max

/**
 * Returns the stored candidate session for an assessment.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {{ data: object | null, error: null | { message: string, code?: string } }}
 */
const getSessionForAssessment = (assessmentId) => {
  const session = getSessionFromStorage().data

  if (!session || session.assessmentId !== assessmentId) {
    return invalidInput('Assessment session not found', 'SESSION_NOT_FOUND')
  }

  return { data: session, error: null }
}

/**
 * Invokes a candidate Edge Function through the shared apiClient normalization.
 *
 * @param {string} functionName Supabase Edge Function name.
 * @param {object} body Request body.
 * @param {object} params Safe diagnostic params.
 * @returns {Promise<{ data: unknown, error: null | { message: string, code?: string, details?: unknown } }>}
 */
const invokeFunction = async (functionName, body, params) => {
  const response = await apiClient(
    (supabase) => supabase.functions.invoke(functionName, { body }),
    { functionName, params },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Saves or updates a candidate response for a question.
 *
 * @param {{ assessmentId: string, questionId: string, answer: string, timeTaken: number }} input
 * @param {string} input.assessmentId Assessment id.
 * @param {string} input.questionId Question id.
 * @param {string} input.answer Candidate answer text.
 * @param {number} input.timeTaken Time taken in seconds.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const saveResponse = async ({
  assessmentId,
  questionId,
  answer,
  timeTaken,
}) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  const trimmedQuestionId = typeof questionId === 'string' ? questionId.trim() : ''

  if (
    !isValidUuid(trimmedAssessmentId)
    || !isValidUuid(trimmedQuestionId)
    || typeof answer !== 'string'
    || answer.length > MAX_ANSWER_LENGTH
    || !isBoundedInteger(timeTaken, MAX_TIME_TAKEN_SECONDS)
  ) {
    return invalidInput('Invalid input')
  }

  const session = getSessionForAssessment(trimmedAssessmentId)
  if (session.error) return session

  const response = await invokeFunction(
    'save-response',
    {
      assessmentId: trimmedAssessmentId,
      questionId: trimmedQuestionId,
      answer,
      timeTaken,
      sessionToken: session.data.sessionToken,
    },
    {
      assessmentId: trimmedAssessmentId,
      questionId: trimmedQuestionId,
    },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Submits an assessment through the candidate Edge Function.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: { submitted: boolean, assessmentId: string, submittedAt?: string | null } | null, error: null | { message: string, code?: string } }>}
 */
export const submitAssessment = async (assessmentId) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  const session = getSessionForAssessment(trimmedAssessmentId)
  if (session.error) return session

  const response = await invokeFunction(
    'submit-assessment',
    {
      assessmentId: trimmedAssessmentId,
      sessionToken: session.data.sessionToken,
    },
    { assessmentId: trimmedAssessmentId },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Records a candidate assessment telemetry event.
 *
 * @param {string} assessmentId Assessment id.
 * @param {'tab_switch' | 'paste_attempt'} eventType Event type.
 * @param {object} [metadata] Structured event metadata.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
const recordAssessmentEvent = async (assessmentId, eventType, metadata = {}) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  const session = getSessionForAssessment(trimmedAssessmentId)
  if (session.error) return session

  const response = await invokeFunction(
    'record-assessment-event',
    {
      assessmentId: trimmedAssessmentId,
      sessionToken: session.data.sessionToken,
      eventType,
      metadata,
    },
    { assessmentId: trimmedAssessmentId, eventType },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Records a tab-switch telemetry event.
 *
 * @param {string} assessmentId Assessment id.
 * @param {number} count Client-observed tab-switch count.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const recordTabSwitch = async (assessmentId, count) => {
  if (!isBoundedInteger(count, MAX_TIME_TAKEN_SECONDS)) {
    return invalidInput('Invalid input')
  }

  return recordAssessmentEvent(assessmentId, 'tab_switch', { count })
}

/**
 * Records a paste-attempt telemetry event.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const recordPasteAttempt = async (assessmentId) => (
  recordAssessmentEvent(assessmentId, 'paste_attempt')
)
