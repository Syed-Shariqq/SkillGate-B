import { apiClient } from '../apiClient'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

/**
 * Returns a normalized invalid-input response.
 *
 * @param {string} message
 * @returns {{ data: null, error: { message: string } }}
 */
const invalidInput = (message) => ({ data: null, error: { message } })

/**
 * Resolves after the requested number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms)
})

/**
 * Validates a UUID string.
 *
 * @param {string} value
 * @returns {boolean}
 */
const isValidUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value.trim())

/**
 * Validates a non-negative integer.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

/**
 * Saves or updates a candidate response for a question.
 *
 * @param {{ assessmentId: string, questionId: string, candidateId: string, answer: string, timeTaken: number }} input
 * @param {string} input.assessmentId Assessment id.
 * @param {string} input.questionId Question id.
 * @param {string} input.candidateId Candidate id.
 * @param {string} input.answer Candidate answer text.
 * @param {number} input.timeTaken Time taken in seconds.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const saveResponse = async ({
  assessmentId,
  questionId,
  candidateId,
  answer,
  timeTaken,
}) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  const trimmedQuestionId = typeof questionId === 'string' ? questionId.trim() : ''
  const trimmedCandidateId = typeof candidateId === 'string' ? candidateId.trim() : ''
  const trimmedAnswer = typeof answer === 'string' ? answer.trim() : ''

  if (
    !isValidUuid(trimmedAssessmentId)
    || !isValidUuid(trimmedQuestionId)
    || !isValidUuid(trimmedCandidateId)
    || !trimmedAnswer
    || !isNonNegativeInteger(timeTaken)
  ) {
    return invalidInput('Invalid input')
  }

  const timestamp = new Date().toISOString()
  const response = await apiClient(
    (supabase) =>
      supabase
        .from('responses')
        .upsert(
          {
            assessment_id: trimmedAssessmentId,
            question_id: trimmedQuestionId,
            candidate_id: trimmedCandidateId,
            answer_given: trimmedAnswer,
            time_taken_seconds: timeTaken,
            updated_at: timestamp,
          },
          { onConflict: 'assessment_id,question_id' },
        )
        .select('*')
        .maybeSingle(),
    {
      functionName: 'saveResponse',
      params: {
        assessmentId: trimmedAssessmentId,
        questionId: trimmedQuestionId,
        candidateId: trimmedCandidateId,
      },
    },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Records tab-switch count and flags an assessment after three switches.
 *
 * @param {string} assessmentId Assessment id.
 * @param {number} count Tab-switch count.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const recordTabSwitch = async (assessmentId, count) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId) || !isNonNegativeInteger(count)) {
    return invalidInput('Invalid input')
  }

  const timestamp = new Date().toISOString()
  const response = await apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .update({
          tab_switches: count,
          is_flagged: count >= 3,
          updated_at: timestamp,
        })
        .eq('id', trimmedAssessmentId)
        .select('id,tab_switches,is_flagged,updated_at')
        .maybeSingle(),
    { functionName: 'recordTabSwitch', params: { assessmentId: trimmedAssessmentId, count } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Records a paste attempt using a compare-and-swap retry loop to avoid lost updates.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const recordPasteAttempt = async (assessmentId) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  let attempt = 0

  while (attempt < 3) {
    const current = await apiClient(
      (supabase) =>
        supabase
          .from('assessments')
          .select('id,paste_attempts')
          .eq('id', trimmedAssessmentId)
          .maybeSingle(),
      { functionName: 'recordPasteAttempt.getCurrent', params: { assessmentId: trimmedAssessmentId } },
    )

    if (current.error) return { data: null, error: current.error }
    if (!current.data) {
      return {
        data: null,
        error: {
          message: 'Assessment not found',
          code: 'ASSESSMENT_NOT_FOUND',
        },
      }
    }

    const currentCount = Number.isInteger(current.data.paste_attempts)
      ? current.data.paste_attempts
      : 0
    const timestamp = new Date().toISOString()
    const updated = await apiClient(
      (supabase) =>
        supabase
          .from('assessments')
          .update({
            paste_attempts: currentCount + 1,
            updated_at: timestamp,
          })
          .eq('id', trimmedAssessmentId)
          .eq('paste_attempts', currentCount)
          .select('id,paste_attempts,updated_at')
          .maybeSingle(),
      {
        functionName: 'recordPasteAttempt.update',
        params: {
          assessmentId: trimmedAssessmentId,
          currentCount,
        },
      },
    )

    if (updated.error) return { data: null, error: updated.error }
    if (updated.data) return { data: updated.data, error: null }

    attempt += 1
    await delay(50)
  }

  return {
    data: null,
    error: {
      message: 'Unable to record paste attempt',
      code: 'PASTE_ATTEMPT_CONFLICT',
    },
  }
}
