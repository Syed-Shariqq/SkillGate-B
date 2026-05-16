import { supabase } from '../../config/supabase'
import { apiClient } from '../apiClient'

const SESSION_KEY = 'skillgate_assessment_session'
const ACTIVE_ASSESSMENT_STATUSES = ['pending', 'ready', 'in_progress']
const TAKEN_ASSESSMENT_STATUSES = ['submitted', 'completed', 'in_progress', 'ready', 'pending']
const SUBMISSION_LOCKED_STATUSES = ['submitted', 'completed', 'evaluating']
const RESUMABLE_ASSESSMENT_STATUSES = ['pending', 'ready', 'in_progress']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const JOB_TOKEN_FIELDS = `
  id,
  title,
  company_name,
  description,
  skills,
  min_score_threshold,
  time_limit_minutes,
  is_active,
  link_expires_at,
  link_max_uses,
  link_use_count,
  allow_retakes
`

const ASSESSMENT_FIELDS = `
  id,
  job_id,
  candidate_id,
  recruiter_id,
  attempt_number,
  status,
  started_at,
  submitted_at,
  completed_at,
  time_limit_minutes,
  generation_attempts,
  evaluation_attempts,
  tab_switches,
  paste_attempts,
  is_flagged,
  created_at,
  updated_at
`

const QUESTION_FIELDS = `
  id,
  assessment_id,
  job_id,
  recruiter_id,
  question_text,
  question_type,
  skill,
  difficulty,
  options,
  correct_answer,
  ideal_answer,
  points,
  order_index,
  is_custom,
  created_at
`

/**
 * Returns a normalized invalid-input response.
 *
 * @param {string} message
 * @returns {{ data: null, error: { message: string } }}
 */
const invalidInput = (message) => ({ data: null, error: { message } })

/**
 * Returns whether a timestamp has passed.
 *
 * @param {string | null | undefined} date
 * @returns {boolean}
 */
const isExpired = (date) => {
  if (!date) return false

  const expiresAt = new Date(date).getTime()
  if (!Number.isFinite(expiresAt)) return false

  return expiresAt <= Date.now()
}

/**
 * Validates an email address after trimming and lowercasing it.
 *
 * @param {string} email
 * @returns {string | null}
 */
const validateEmail = (email) => {
  if (typeof email !== 'string') return null

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) return null

  return normalizedEmail
}

/**
 * Validates a candidate name after trimming it.
 *
 * @param {string} name
 * @returns {string | null}
 */
const validateName = (name) => {
  if (typeof name !== 'string') return null

  const trimmedName = name.trim()
  if (trimmedName.length < 2 || trimmedName.length > 100) return null

  return trimmedName
}

/**
 * Validates a UUID string.
 *
 * @param {string} value
 * @returns {boolean}
 */
const isValidUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value.trim())

/**
 * Safely reads browser sessionStorage.
 *
 * @returns {Storage | null}
 */
const getSessionStorage = () => {
  if (typeof sessionStorage === 'undefined') return null

  return sessionStorage
}

/**
 * Returns whether a parsed value is a valid stored assessment session.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
const isValidSession = (value) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && value.version === 1
  && isValidUuid(value.assessmentId)
  && isValidUuid(value.candidateId)
  && typeof value.sessionToken === 'string'
  && value.sessionToken.trim().length > 0
  && typeof value.createdAt === 'string'
)

/**
 * Fetches the candidate row for an email and job pair.
 *
 * @param {string} email
 * @param {string} jobId
 * @returns {Promise<{ data: object | null, error: null | object }>}
 */
const getCandidateByEmailAndJob = async (email, jobId) => (
  apiClient(
    (supabase) =>
      supabase
        .from('candidates')
        .select('id,job_id,recruiter_id,full_name,email,status,created_at,updated_at')
        .eq('email', email)
        .eq('job_id', jobId)
        .maybeSingle(),
    { functionName: 'getCandidateByEmailAndJob', params: { email, jobId } },
  )
)

/**
 * Fetches the latest assessment for a candidate and job.
 *
 * @param {string} candidateId
 * @param {string} jobId
 * @param {Array<string>} statuses
 * @returns {Promise<{ data: object | null, error: null | object }>}
 */
const getLatestAssessmentByStatus = async (candidateId, jobId, statuses) => (
  apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .select('id,candidate_id,job_id,status,attempt_number,created_at,updated_at')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    { functionName: 'getLatestAssessmentByStatus', params: { candidateId, jobId, statuses } },
  )
)

/**
 * Saves the active assessment session in sessionStorage.
 *
 * @param {{ assessmentId: string, candidateId: string, sessionToken: string }} session
 * @param {string} session.assessmentId Active assessment id.
 * @param {string} session.candidateId Candidate id.
 * @param {string} session.sessionToken Signed assessment session token.
 * @returns {{ data: object | null, error: null | { message: string } }}
 */
export const saveSession = ({ assessmentId, candidateId, sessionToken }) => {
  if (
    !isValidUuid(assessmentId)
    || !isValidUuid(candidateId)
    || typeof sessionToken !== 'string'
    || !sessionToken.trim()
  ) {
    return invalidInput('Invalid input')
  }

  const storage = getSessionStorage()
  if (!storage) {
    return {
      data: null,
      error: { message: 'Session storage unavailable' },
    }
  }

  const session = {
    version: 1,
    assessmentId: assessmentId.trim(),
    candidateId: candidateId.trim(),
    sessionToken: sessionToken.trim(),
    createdAt: new Date().toISOString(),
  }

  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session))

    return { data: session, error: null }
  } catch {
    return {
      data: null,
      error: { message: 'Unable to save assessment session' },
    }
  }
}

/**
 * Reads and validates the active assessment session from sessionStorage.
 *
 * @returns {{ data: object | null, error: null }}
 */
export const getSession = () => {
  const storage = getSessionStorage()
  if (!storage) return { data: null, error: null }

  try {
    const rawSession = storage.getItem(SESSION_KEY)
    if (!rawSession) return { data: null, error: null }

    const parsedSession = JSON.parse(rawSession)
    if (!isValidSession(parsedSession)) return { data: null, error: null }

    return { data: parsedSession, error: null }
  } catch {
    return { data: null, error: null }
  }
}

/**
 * Clears the active assessment session from sessionStorage.
 *
 * @returns {{ data: { cleared: boolean }, error: null | { message: string } }}
 */
export const clearSession = () => {
  const storage = getSessionStorage()
  if (!storage) return { data: { cleared: true }, error: null }

  try {
    storage.removeItem(SESSION_KEY)

    return { data: { cleared: true }, error: null }
  } catch {
    return {
      data: null,
      error: { message: 'Unable to clear assessment session' },
    }
  }
}

/**
 * Fetches a public job assessment link by token and returns its availability status.
 *
 * @param {string} token Assessment link token.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string }, status?: string }>}
 */
export const getJobByToken = async (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    return { ...invalidInput('Invalid input'), status: null }
  }

  const trimmedToken = token.trim()
  const response = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .select(JOB_TOKEN_FIELDS)
        .eq('assessment_link_token', trimmedToken)
        .maybeSingle(),
    { functionName: 'getJobByToken', params: { token: trimmedToken } },
  )

  if (response.error) return { data: null, error: response.error, status: null }
  if (!response.data) return { data: null, error: null, status: 'not_found' }
  if (!response.data.is_active) return { data: response.data, error: null, status: 'inactive' }
  if (isExpired(response.data.link_expires_at)) return { data: response.data, error: null, status: 'expired' }
  if (
    Number.isInteger(response.data.link_max_uses)
    && response.data.link_max_uses >= 0
    && response.data.link_use_count >= response.data.link_max_uses
  ) {
    return { data: response.data, error: null, status: 'limit_reached' }
  }

  return { data: response.data, error: null, status: 'valid' }
}

/**
 * Checks whether a candidate has already taken or can resume an assessment for a job.
 *
 * @param {string} email Candidate email address.
 * @param {string} jobId Job id.
 * @returns {Promise<{ data: { taken: boolean, resumable: boolean, assessmentId?: string, candidateId?: string } | null, error: null | { message: string, code?: string } }>}
 */
export const checkAlreadyTaken = async (email, jobId) => {
  const normalizedEmail = validateEmail(email)
  if (!normalizedEmail || !isValidUuid(jobId)) return invalidInput('Invalid input')

  const candidate = await getCandidateByEmailAndJob(normalizedEmail, jobId.trim())
  if (candidate.error) return { data: null, error: candidate.error }

  if (!candidate.data) {
    return {
      data: {
        taken: false,
        resumable: false,
      },
      error: null,
    }
  }

  const assessment = await getLatestAssessmentByStatus(
    candidate.data.id,
    jobId.trim(),
    TAKEN_ASSESSMENT_STATUSES,
  )

  if (assessment.error) return { data: null, error: assessment.error }

  if (!assessment.data) {
    return {
      data: {
        taken: false,
        resumable: false,
        candidateId: candidate.data.id,
      },
      error: null,
    }
  }

  const taken = TAKEN_ASSESSMENT_STATUSES.includes(assessment.data.status)
  const resumable = RESUMABLE_ASSESSMENT_STATUSES.includes(assessment.data.status)

  return {
    data: {
      taken,
      resumable,
      assessmentId: assessment.data.id,
      candidateId: candidate.data.id,
    },
    error: null,
  }
}

/**
 * Starts or resumes a candidate assessment for a job token.
 *
 * @param {{ name: string, email: string, token: string }} input
 * @param {string} input.name Candidate full name.
 * @param {string} input.email Candidate email address.
 * @param {string} input.token Assessment link token.
 * @returns {Promise<{ data: { assessmentId: string, candidateId: string } | null, error: null | { message: string, code?: string } }>}
 */
export const startAssessment = async ({ name, email, token }) => {
  const normalizedName = validateName(name)
  const normalizedEmail = validateEmail(email)
  const trimmedToken = typeof token === 'string' ? token.trim() : ''

  if (!normalizedName || !normalizedEmail || !trimmedToken) {
    return invalidInput('Invalid input')
  }

  const { data, error } = await supabase.functions.invoke('start-assessment', {
    body: {
      name: normalizedName,
      email: normalizedEmail,
      token: trimmedToken,
    },
  })

  if (error) {
    return {
      data: null,
      error: {
        message: error.message || 'Unable to start assessment',
        code: 'START_ASSESSMENT_FAILED',
      },
    }
  }

  const payload = data?.data ?? data
  if (
    !payload
    || !isValidUuid(payload.assessmentId)
    || !isValidUuid(payload.candidateId)
    || typeof payload.sessionToken !== 'string'
  ) {
    return {
      data: null,
      error: {
        message: 'Invalid start assessment response',
        code: 'INVALID_RESPONSE',
      },
    }
  }

  const session = saveSession({
    assessmentId: payload.assessmentId,
    candidateId: payload.candidateId,
    sessionToken: payload.sessionToken,
  })

  if (session.error) return { data: null, error: session.error }

  return {
    data: {
      assessmentId: payload.assessmentId,
      candidateId: payload.candidateId,
      assessmentStatus: payload.assessmentStatus,
    },
    error: null,
  }
}

/**
 * Fetches an assessment and its generated questions.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: { assessment: object | null, questions: Array<object> } | null, error: null | { message: string, code?: string } }>}
 */
export const getAssessment = async (assessmentId) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  const response = await apiClient(
    async (supabase) => {
      const [assessment, questions] = await Promise.all([
        supabase
          .from('assessments')
          .select(ASSESSMENT_FIELDS)
          .eq('id', trimmedAssessmentId)
          .maybeSingle(),
        supabase
          .from('questions')
          .select(QUESTION_FIELDS)
          .eq('assessment_id', trimmedAssessmentId)
          .order('order_index', { ascending: true }),
      ])

      const error = assessment.error || questions.error
      if (error) return { data: null, error }

      return {
        data: {
          assessment: assessment.data ?? null,
          questions: Array.isArray(questions.data) ? questions.data : [],
        },
        error: null,
      }
    },
    { functionName: 'getAssessment', params: { assessmentId: trimmedAssessmentId } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Marks an assessment as started.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const markStarted = async (assessmentId) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  const timestamp = new Date().toISOString()
  const response = await apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .update({
          status: 'in_progress',
          started_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', trimmedAssessmentId)
        .select(ASSESSMENT_FIELDS)
        .maybeSingle(),
    { functionName: 'markStarted', params: { assessmentId: trimmedAssessmentId } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Submits an assessment and starts response evaluation.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: { submitted: boolean, assessmentId: string } | null, error: null | { message: string, code?: string } }>}
 */
export const submitAssessment = async (assessmentId) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  const existingAssessment = await apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .select('id,status')
        .eq('id', trimmedAssessmentId)
        .maybeSingle(),
    { functionName: 'submitAssessment.getExisting', params: { assessmentId: trimmedAssessmentId } },
  )

  if (existingAssessment.error) return { data: null, error: existingAssessment.error }
  if (!existingAssessment.data) {
    return {
      data: null,
      error: {
        message: 'Assessment not found',
        code: 'ASSESSMENT_NOT_FOUND',
      },
    }
  }

  if (SUBMISSION_LOCKED_STATUSES.includes(existingAssessment.data.status)) {
    return {
      data: {
        submitted: true,
        assessmentId: trimmedAssessmentId,
      },
      error: null,
    }
  }

  const timestamp = new Date().toISOString()
  const submittedAssessment = await apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .update({
          status: 'submitted',
          submitted_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', trimmedAssessmentId)
        .not('status', 'in', '("submitted","completed")')
        .select('id,status,submitted_at,updated_at')
        .maybeSingle(),
    { functionName: 'submitAssessment.update', params: { assessmentId: trimmedAssessmentId } },
  )

  if (submittedAssessment.error) return { data: null, error: submittedAssessment.error }

  const { error } = await supabase.functions.invoke('evaluate-responses', {
    body: {
      assessmentId: trimmedAssessmentId,
    },
  })

  if (error) {
    return {
      data: null,
      error: {
        message: error.message || 'Evaluation failed',
        code: 'EVALUATION_FAILED',
      },
    }
  }

  return {
    data: {
      submitted: true,
      assessmentId: trimmedAssessmentId,
    },
    error: null,
  }
}
