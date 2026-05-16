import { supabase } from '../../config/supabase'
import { apiClient } from '../apiClient'

const SESSION_KEY = 'sg_assessment_session'
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
 * Resolves after the requested number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms)
})

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
  && typeof value.token === 'string'
  && value.token.trim().length > 0
  && isValidUuid(value.assessmentId)
  && isValidUuid(value.candidateId)
  && typeof value.createdAt === 'string'
)

/**
 * Builds a stable idempotency key for a candidate's first job attempt.
 *
 * @param {string} candidateId
 * @param {string} jobId
 * @returns {string}
 */
const buildAssessmentIdempotencyKey = (candidateId, jobId) => (
  `candidate:${candidateId}:job:${jobId}:attempt:1`
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
 * Checks whether generated questions already exist for an assessment.
 *
 * @param {string} assessmentId
 * @returns {Promise<{ data: boolean | null, error: null | object }>}
 */
const hasQuestions = async (assessmentId) => {
  const response = await apiClient(
    (supabase) =>
      supabase
        .from('questions')
        .select('id')
        .eq('assessment_id', assessmentId)
        .limit(1)
        .maybeSingle(),
    { functionName: 'hasQuestions', params: { assessmentId } },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: Boolean(response.data?.id), error: null }
}

/**
 * Marks question generation as permanently failed.
 *
 * @param {string} assessmentId
 * @returns {Promise<{ data: object | null, error: null | object }>}
 */
const markGenerationFailed = async (assessmentId) => (
  apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .select('id,status,updated_at')
        .maybeSingle(),
    { functionName: 'markGenerationFailed', params: { assessmentId } },
  )
)

/**
 * Atomically increments a job assessment-link usage counter.
 *
 * @param {string} jobId
 * @returns {Promise<{ data: unknown, error: null | object }>}
 */
const incrementJobLinkUseCount = async (jobId) => (
  apiClient(
    (supabase) =>
      supabase.rpc('increment_job_link_use_count', {
        p_job_id: jobId,
      }),
    { functionName: 'incrementJobLinkUseCount', params: { jobId } },
  )
)

/**
 * Invokes question generation with bounded retries.
 *
 * @param {string} assessmentId
 * @param {string} jobId
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
const generateQuestions = async (assessmentId, jobId) => {
  let attempt = 0
  const maxRetries = 2

  while (attempt <= maxRetries) {
    const existingQuestions = await hasQuestions(assessmentId)
    if (existingQuestions.error) return { data: null, error: existingQuestions.error }
    if (existingQuestions.data) return { data: { assessmentId, jobId }, error: null }

    const { data, error } = await supabase.functions.invoke('generate-questions', {
      body: {
        assessmentId,
        jobId,
      },
    })

    if (!error) return { data: data ?? { assessmentId, jobId }, error: null }

    attempt += 1
    if (attempt <= maxRetries) {
      await delay(2000)
    }
  }

  await markGenerationFailed(assessmentId)

  return {
    data: null,
    error: {
      message: 'Assessment generation failed',
      code: 'GENERATION_FAILED',
    },
  }
}

/**
 * Saves the active assessment session in sessionStorage.
 *
 * @param {{ token: string, assessmentId: string, candidateId: string }} session
 * @param {string} session.token Assessment link token.
 * @param {string} session.assessmentId Active assessment id.
 * @param {string} session.candidateId Candidate id.
 * @returns {{ data: object | null, error: null | { message: string } }}
 */
export const saveSession = ({ token, assessmentId, candidateId }) => {
  if (
    typeof token !== 'string'
    || !token.trim()
    || !isValidUuid(assessmentId)
    || !isValidUuid(candidateId)
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
    token: token.trim(),
    assessmentId: assessmentId.trim(),
    candidateId: candidateId.trim(),
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
 * @param {{ name: string, email: string, jobId: string, token: string }} input
 * @param {string} input.name Candidate full name.
 * @param {string} input.email Candidate email address.
 * @param {string} input.jobId Job id.
 * @param {string} input.token Assessment link token.
 * @returns {Promise<{ data: { assessmentId: string, candidateId: string } | null, error: null | { message: string, code?: string } }>}
 */
export const startAssessment = async ({ name, email, jobId, token }) => {
  const normalizedName = validateName(name)
  const normalizedEmail = validateEmail(email)
  const trimmedJobId = typeof jobId === 'string' ? jobId.trim() : ''
  const trimmedToken = typeof token === 'string' ? token.trim() : ''

  if (!normalizedName || !normalizedEmail || !isValidUuid(trimmedJobId) || !trimmedToken) {
    return invalidInput('Invalid input')
  }

  const existingCandidate = await getCandidateByEmailAndJob(normalizedEmail, trimmedJobId)
  if (existingCandidate.error) return { data: null, error: existingCandidate.error }

  if (existingCandidate.data?.id) {
    const activeAssessment = await getLatestAssessmentByStatus(
      existingCandidate.data.id,
      trimmedJobId,
      ACTIVE_ASSESSMENT_STATUSES,
    )

    if (activeAssessment.error) return { data: null, error: activeAssessment.error }

    if (activeAssessment.data?.id) {
      const session = saveSession({
        token: trimmedToken,
        assessmentId: activeAssessment.data.id,
        candidateId: existingCandidate.data.id,
      })

      if (session.error) return { data: null, error: session.error }

      return {
        data: {
          assessmentId: activeAssessment.data.id,
          candidateId: existingCandidate.data.id,
        },
        error: null,
      }
    }
  }

  const job = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .select('id,recruiter_id,time_limit_minutes,assessment_link_token,is_active,link_expires_at,link_max_uses,link_use_count')
        .eq('id', trimmedJobId)
        .eq('assessment_link_token', trimmedToken)
        .maybeSingle(),
    { functionName: 'startAssessment.getJob', params: { jobId: trimmedJobId } },
  )

  if (job.error) return { data: null, error: job.error }
  if (!job.data || !job.data.is_active || isExpired(job.data.link_expires_at)) {
    return {
      data: null,
      error: {
        message: 'Assessment link is unavailable',
        code: 'ASSESSMENT_UNAVAILABLE',
      },
    }
  }

  if (
    Number.isInteger(job.data.link_max_uses)
    && job.data.link_max_uses >= 0
    && job.data.link_use_count >= job.data.link_max_uses
  ) {
    return {
      data: null,
      error: {
        message: 'Assessment link limit reached',
        code: 'LINK_LIMIT_REACHED',
      },
    }
  }

  const candidate = await apiClient(
    (supabase) =>
      supabase
        .from('candidates')
        .upsert(
          {
            job_id: trimmedJobId,
            recruiter_id: job.data.recruiter_id,
            full_name: normalizedName,
            email: normalizedEmail,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email,job_id' },
        )
        .select('id,job_id,recruiter_id,full_name,email,status,created_at,updated_at')
        .maybeSingle(),
    { functionName: 'startAssessment.upsertCandidate', params: { email: normalizedEmail, jobId: trimmedJobId } },
  )

  if (candidate.error || !candidate.data?.id) {
    return {
      data: null,
      error: candidate.error || {
        message: 'Unable to create candidate',
        code: 'CANDIDATE_CREATE_FAILED',
      },
    }
  }

  const idempotencyKey = buildAssessmentIdempotencyKey(candidate.data.id, trimmedJobId)
  const createdAt = new Date().toISOString()
  const assessment = await apiClient(
    (supabase) =>
      supabase
        .from('assessments')
        .insert({
          candidate_id: candidate.data.id,
          job_id: trimmedJobId,
          recruiter_id: job.data.recruiter_id,
          status: 'pending',
          attempt_number: 1,
          time_limit_minutes: job.data.time_limit_minutes,
          idempotency_key: idempotencyKey,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select('id,candidate_id,job_id,status,created_at')
        .maybeSingle(),
    { functionName: 'startAssessment.createAssessment', params: { candidateId: candidate.data.id, jobId: trimmedJobId } },
  )

  let assessmentId = assessment.data?.id

  if (assessment.error || !assessmentId) {
    const activeAssessment = await getLatestAssessmentByStatus(
      candidate.data.id,
      trimmedJobId,
      ACTIVE_ASSESSMENT_STATUSES,
    )

    if (activeAssessment.error) return { data: null, error: activeAssessment.error }

    if (activeAssessment.data?.id) {
      const session = saveSession({
        token: trimmedToken,
        assessmentId: activeAssessment.data.id,
        candidateId: candidate.data.id,
      })

      if (session.error) return { data: null, error: session.error }

      return {
        data: {
          assessmentId: activeAssessment.data.id,
          candidateId: candidate.data.id,
        },
        error: null,
      }
    }

    return {
      data: null,
      error: assessment.error || {
        message: 'Unable to create assessment',
        code: 'ASSESSMENT_CREATE_FAILED',
      },
    }
  }

  const increment = await incrementJobLinkUseCount(trimmedJobId)
  if (increment.error) {
    await markGenerationFailed(assessmentId)

    return { data: null, error: increment.error }
  }

  const generation = await generateQuestions(assessmentId, trimmedJobId)
  if (generation.error) return generation

  const session = saveSession({
    token: trimmedToken,
    assessmentId,
    candidateId: candidate.data.id,
  })

  if (session.error) return { data: null, error: session.error }

  return {
    data: {
      assessmentId,
      candidateId: candidate.data.id,
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
