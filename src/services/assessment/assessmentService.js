import { apiClient } from '../apiClient'

const SESSION_KEY = 'skillgate_assessment_session'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_TRANSITIONS = new Map([
  ['pending', new Set(['ready'])],
  ['ready', new Set(['in_progress'])],
  ['in_progress', new Set(['submitted'])],
  ['submitted', new Set(['evaluating'])],
  ['evaluating', new Set(['completed', 'failed'])],
])

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

  const trimmedName = name.trim().replace(/\s+/g, ' ')
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
 * Normalizes the Edge Function response shape into this service layer shape.
 *
 * @param {string} functionName Supabase Edge Function name.
 * @param {object} body Request body.
 * @param {object} [params] Safe diagnostic params.
 * @returns {Promise<{ data: unknown, error: null | { message: string, code?: string, details?: unknown } }>}
 */
const invokeFunction = async (
  functionName,
  body,
  params = {},
) => {
  const response = await apiClient(
    (supabase) =>
      supabase.functions.invoke(
        functionName,
        { body },
      ),
    { functionName, params },
  )

  if (response.error) {
    return {
      data: null,
      error: response.error,
    }
  }

  const payload =
    response.data?.data ?? response.data

  return {
    data: payload ?? null,
    error: null,
  }
}

/**
 * Saves the active assessment session in sessionStorage.
 *
 * @param {{ assessmentId: string, candidateId: string, sessionToken: string }} session
 * @param {string} session.assessmentId Active assessment id.
 * @param {string} session.candidateId Candidate id.
 * @param {string} session.sessionToken Signed assessment session token.
 * @returns {{ data: object | null, error: null | { message: string, code?: string } }}
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
      error: { message: 'Session storage unavailable', code: 'SESSION_STORAGE_UNAVAILABLE' },
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
      error: { message: 'Unable to save assessment session', code: 'SESSION_SAVE_FAILED' },
    }
  }
}

/**
 * Reads and validates the active assessment session from sessionStorage.
 *
 * @returns {{ data: object | null, error: null }}
 */
export const getSessionFromStorage = () => {
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
 * Backward-compatible session accessor.
 *
 * @returns {{ data: object | null, error: null }}
 */
export const getSession = () => getSessionFromStorage()

/**
 * Clears the active assessment session from sessionStorage.
 *
 * @returns {{ data: { cleared: boolean } | null, error: null | { message: string, code?: string } }}
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
      error: { message: 'Unable to clear assessment session', code: 'SESSION_CLEAR_FAILED' },
    }
  }
}

/**
 * Returns whether a candidate assessment status transition is allowed.
 *
 * @param {string} from Current status.
 * @param {string} to Next status.
 * @returns {boolean}
 */
export const isValidStatusTransition = (from, to) => {
  if (typeof from !== 'string' || typeof to !== 'string') return false

  return STATUS_TRANSITIONS.get(from)?.has(to) === true
}

/**
 * Fetches a public job assessment link by token and returns its availability status.
 *
 * Public job-link preview is served through an Edge Function so the frontend
 * does not need direct anon table reads.
 *
 * @param {string} token Assessment link token.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string }, status?: string }>}
 */
export const getJobByToken = async (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    return { ...invalidInput('Invalid input'), status: null }
  }

  const trimmedToken = token.trim()
  const response = await invokeFunction(
    'get-job-by-token',
    { token: trimmedToken },
    {},
  )

  if (response.error) return { data: null, error: response.error, status: null }

  return {
    data: response.data?.job ?? null,
    error: null,
    status: response.data?.status ?? 'not_found',
  }
}

/**
 * Legacy candidate pre-check. Candidate ownership now lives behind
 * start-assessment, so this function no longer performs database lookups.
 *
 * @param {string} email Candidate email address.
 * @param {string} jobId Job id.
 * @returns {Promise<{ data: { taken: boolean, resumable: boolean, assessmentId?: string, candidateId?: string } | null, error: null | { message: string, code?: string } }>}
 */
export const checkAlreadyTaken = async (email, jobId) => {
  const normalizedEmail = validateEmail(email)
  if (!normalizedEmail || !isValidUuid(jobId)) return invalidInput('Invalid input')

  return {
    data: {
      taken: false,
      resumable: false,
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
 * @returns {Promise<{ data: { assessmentId: string, candidateId: string, assessmentStatus?: string } | null, error: null | { message: string, code?: string } }>}
 */
export const startAssessment = async ({ name, email, token }) => {
  const normalizedName = validateName(name)
  const normalizedEmail = validateEmail(email)
  const trimmedToken = typeof token === 'string' ? token.trim() : ''

  if (!normalizedName || !normalizedEmail || !trimmedToken) {
    return invalidInput('Invalid input')
  }

  const response = await invokeFunction(
    'start-assessment',
    {
      name: normalizedName,
      email: normalizedEmail,
      token: trimmedToken,
    },
    { email: normalizedEmail },
  )

  if (response.error) {
    return {
      data: null,
      error: {
        ...response.error,
        message: response.error.message || 'Unable to start assessment',
      },
    }
  }

  const payload = response.data?.data ?? response.data
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
 * Fetches an assessment and its generated questions through the candidate Edge Function.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: { assessment: object | null, questions: Array<object> } | null, error: null | { message: string, code?: string } }>}
 */
export const getAssessment = async ({
  assessmentId,
  sessionToken,
}) => {
  const trimmedAssessmentId = typeof assessmentId === 'string' ? assessmentId.trim() : ''
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput('Invalid input')

  const response = await invokeFunction(
    'get-assessment',
    {
      assessmentId: trimmedAssessmentId,
      sessionToken: sessionToken,
    },
    { assessmentId: trimmedAssessmentId },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: response.data ?? null, error: null }
}

/**
 * Legacy start marker. The backend now transitions ready -> in_progress when
 * the first response is saved, so this fetches the current assessment DTO.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const markStarted = async (assessmentId) => {
  const response = await getAssessment(assessmentId)

  return {
    data: response.data?.assessment ?? null,
    error: response.error,
  }
}
