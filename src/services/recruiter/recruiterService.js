import { apiClient } from '../apiClient'

const ALLOWED_CANDIDATE_STATUSES = ['pending', 'shortlisted', 'rejected', 'under_review']

const DEFAULT_DASHBOARD_STATS = {
  totalJobs: 0,
  activeJobs: 0,
  totalCandidates: 0,
  shortlisted: 0,
  rejected: 0,
  pending: 0,
}

const DEFAULT_ANALYTICS = {
  totalAttempts: 0,
  avgScore: 0,
  completionRate: 0,
  shortlistedRate: 0,
  timeline: [],
}

const JOB_DETAIL_FIELDS = `
  id,
  recruiter_id,
  title,
  company_name,
  description,
  skills,
  min_score_threshold,
  time_limit_minutes,
  is_active,
  allow_retakes,
  show_score_to_candidate,
  assessment_link_token,
  link_expires_at,
  link_max_uses,
  link_use_count,
  created_at,
  updated_at
`

const CANDIDATE_PROFILE_FIELDS = `
  id,
  job_id,
  recruiter_id,
  full_name,
  email,
  status,
  created_at,
  updated_at,
  jobs!inner (
    id,
    title,
    recruiter_id
  ),
  assessments (
    id,
    status,
    attempt_number,
    started_at,
    submitted_at,
    completed_at,
    tab_switches,
    paste_attempts,
    is_flagged,
    created_at,
    results (
      id,
      overall_score,
      passed,
      confidence_score,
      confidence_label,
      hiring_signal,
      feedback_summary,
      executive_summary,
      strengths,
      weaknesses,
      created_at
    )
  )
`

const JOB_SETTINGS_FIELDS = [
  'title',
  'company_name',
  'description',
  'skills',
  'min_score_threshold',
  'time_limit_minutes',
  'is_active',
  'allow_retakes',
  'show_score_to_candidate',
  'assessment_link_token',
  'link_expires_at',
  'link_max_uses',
]

/**
 * Returns a normalized invalid-input response.
 *
 * @param {string} message
 * @returns {{ data: null, error: string }}
 */
const invalidInput = (message) => ({ data: null, error: message })

/**
 * Converts count values into safe numbers.
 *
 * @param {number | null | undefined} value
 * @returns {number}
 */
const toCount = (value) => (Number.isFinite(value) ? value : 0)

/**
 * Converts a numeric aggregate into a safe number.
 *
 * @param {unknown} value
 * @returns {number}
 */
const toNumber = (value) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

/**
 * Rounds a numeric percentage or score to two decimal places.
 *
 * @param {number} value
 * @returns {number}
 */
const roundTwo = (value) => Math.round(value * 100) / 100

/**
 * Normalizes pagination inputs.
 *
 * @param {number} page
 * @param {number} limit
 * @returns {{ from: number, to: number, limit: number }}
 */
const getPaginationRange = (page = 1, limit = 20) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20))
  const from = (safePage - 1) * safeLimit

  return {
    from,
    to: from + safeLimit - 1,
    limit: safeLimit,
  }
}

/**
 * Keeps only columns the recruiter is allowed to update on a job.
 *
 * @param {Record<string, unknown>} settings
 * @returns {Record<string, unknown>}
 */
const sanitizeJobSettings = (settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {}

  return JOB_SETTINGS_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(settings, field)) {
      payload[field] = settings[field]
    }

    return payload
  }, {})
}

/**
 * Groups attempts by YYYY-MM-DD date.
 *
 * @param {Array<{ created_at?: string | null }>} attempts
 * @returns {Array<{ date: string, count: number }>}
 */
const buildTimeline = (attempts) => {
  const grouped = (Array.isArray(attempts) ? attempts : []).reduce((dates, attempt) => {
    if (!attempt?.created_at) return dates

    const date = attempt.created_at.slice(0, 10)
    dates[date] = (dates[date] || 0) + 1

    return dates
  }, {})

  return Object.entries(grouped)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, count]) => ({ date, count }))
}

/**
 * Inserts a recruiter-owned job and returns the created row.
 *
 * @param {string} recruiterId
 * @param {Record<string, unknown>} jobData
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const createJob = async (recruiterId, jobData) => {
  if (!recruiterId || !jobData || typeof jobData !== 'object' || Array.isArray(jobData)) {
    return invalidInput('Invalid input')
  }

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .insert({ ...jobData, recruiter_id: recruiterId })
        .select(JOB_DETAIL_FIELDS)
        .maybeSingle(),
    { functionName: 'createJob', params: { recruiterId } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Fetches recruiter jobs ordered by newest first.
 *
 * @param {string} recruiterId
 * @param {{ page?: number, limit?: number }} [options]
 * @returns {Promise<{ data: Array<{ id: string, title: string, is_active: boolean, created_at: string }>, error: null | object | string }>}
 */
export const getJobs = async (recruiterId, options = {}) => {
  if (!recruiterId) return invalidInput('Invalid input')

  const { page = 1, limit = 20 } = options || {}
  const { from, to } = getPaginationRange(page, limit)
  const response = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .select('id,title,is_active,created_at')
        .eq('recruiter_id', recruiterId)
        .order('created_at', { ascending: false })
        .range(from, to),
    { functionName: 'getJobs', params: { recruiterId, page, limit } },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: Array.isArray(response.data) ? response.data : [], error: response.error }
}

/**
 * Fetches a single recruiter-owned job.
 *
 * @param {string} jobId
 * @param {string} recruiterId
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const getJobDetail = async (jobId, recruiterId) => {
  if (!jobId || !recruiterId) return invalidInput('Invalid input')

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .select(JOB_DETAIL_FIELDS)
        .eq('id', jobId)
        .eq('recruiter_id', recruiterId)
        .maybeSingle(),
    { functionName: 'getJobDetail', params: { jobId, recruiterId } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Sets a job active state idempotently.
 *
 * @param {string} jobId
 * @param {boolean} isActive
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const toggleJobActive = async (jobId, isActive) => {
  if (!jobId || typeof isActive !== 'boolean') return invalidInput('Invalid input')

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .update({ is_active: isActive })
        .eq('id', jobId)
        .select('id,is_active,updated_at')
        .maybeSingle(),
    { functionName: 'toggleJobActive', params: { jobId, isActive } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Partially updates allowed job settings.
 *
 * @param {string} jobId
 * @param {Record<string, unknown>} settings
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const updateJobSettings = async (jobId, settings) => {
  if (!jobId) return invalidInput('Invalid input')

  const payload = sanitizeJobSettings(settings)
  if (Object.keys(payload).length === 0) return invalidInput('Invalid settings')

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('jobs')
        .update(payload)
        .eq('id', jobId)
        .select(JOB_DETAIL_FIELDS)
        .maybeSingle(),
    { functionName: 'updateJobSettings', params: { jobId, fields: Object.keys(payload) } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Fetches aggregate dashboard stats for a recruiter.
 *
 * @param {string} recruiterId
 * @returns {Promise<{ data: typeof DEFAULT_DASHBOARD_STATS | null, error: null | object | string }>}
 */
export const getDashboardStats = async (recruiterId) => {
  if (!recruiterId) return invalidInput('Invalid input')

  const response = await apiClient(
    async (supabase) => {
      const [
        totalJobs,
        activeJobs,
        totalCandidates,
        shortlisted,
        rejected,
        pending,
      ] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('recruiter_id', recruiterId),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('recruiter_id', recruiterId).eq('is_active', true),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('recruiter_id', recruiterId),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('recruiter_id', recruiterId).eq('status', 'shortlisted'),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('recruiter_id', recruiterId).eq('status', 'rejected'),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('recruiter_id', recruiterId).eq('status', 'pending'),
      ])

      const error = [totalJobs, activeJobs, totalCandidates, shortlisted, rejected, pending].find((result) => result.error)?.error
      if (error) return { data: null, error }

      return {
        data: {
          totalJobs: toCount(totalJobs.count),
          activeJobs: toCount(activeJobs.count),
          totalCandidates: toCount(totalCandidates.count),
          shortlisted: toCount(shortlisted.count),
          rejected: toCount(rejected.count),
          pending: toCount(pending.count),
        },
        error: null,
      }
    },
    { functionName: 'getDashboardStats', params: { recruiterId } },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: response.data ?? DEFAULT_DASHBOARD_STATS, error: response.error }
}

/**
 * Fetches a candidate profile visible through the recruiter's job ownership.
 *
 * @param {string} candidateId
 * @param {string} recruiterId
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const getCandidateProfile = async (candidateId, recruiterId) => {
  if (!candidateId || !recruiterId) return invalidInput('Invalid input')

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('candidates')
        .select(CANDIDATE_PROFILE_FIELDS)
        .eq('id', candidateId)
        .eq('jobs.recruiter_id', recruiterId)
        .maybeSingle(),
    { functionName: 'getCandidateProfile', params: { candidateId, recruiterId } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Updates a candidate status through its assessment id.
 *
 * @param {string} assessmentId
 * @param {'pending' | 'shortlisted' | 'rejected' | 'under_review'} status
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const updateCandidateStatus = async (assessmentId, status) => {
  if (!ALLOWED_CANDIDATE_STATUSES.includes(status)) {
    return invalidInput('Invalid status')
  }

  if (!assessmentId) return invalidInput('Invalid input')

  const response = await apiClient(
    async (supabase) => {
      const assessment = await supabase
        .from('assessments')
        .select('id,candidate_id')
        .eq('id', assessmentId)
        .maybeSingle()

      if (assessment.error || !assessment.data?.candidate_id) {
        return assessment.error ? assessment : { data: null, error: null }
      }

      return supabase
        .from('candidates')
        .update({ status })
        .eq('id', assessment.data.candidate_id)
        .select('id,job_id,recruiter_id,full_name,email,status,updated_at')
        .maybeSingle()
    },
    { functionName: 'updateCandidateStatus', params: { assessmentId, status } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Fetches unread notifications plus the latest notifications for a recruiter.
 *
 * @param {string} recruiterId
 * @returns {Promise<{ data: Array<{ id: string, type: string, message: string, is_read: boolean, created_at: string }>, error: null | object | string }>}
 */
export const getNotifications = async (recruiterId) => {
  if (!recruiterId) return invalidInput('Invalid input')

  const response = await apiClient(
    async (supabase) => {
      const [unread, latest] = await Promise.all([
        supabase
          .from('notifications')
          .select('id,type,message,is_read,created_at')
          .eq('recruiter_id', recruiterId)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('notifications')
          .select('id,type,message,is_read,created_at')
          .eq('recruiter_id', recruiterId)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      const error = unread.error || latest.error
      if (error) return { data: null, error }

      const notificationsById = new Map()
      ;[...(unread.data || []), ...(latest.data || [])].forEach((notification) => {
        notificationsById.set(notification.id, notification)
      })

      return {
        data: Array.from(notificationsById.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
        error: null,
      }
    },
    { functionName: 'getNotifications', params: { recruiterId } },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: Array.isArray(response.data) ? response.data : [], error: response.error }
}

/**
 * Marks one notification as read.
 *
 * @param {string} id
 * @returns {Promise<{ data: object | null, error: null | object | string }>}
 */
export const markNotificationRead = async (id) => {
  if (!id) return invalidInput('Invalid input')

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select('id,type,message,is_read,created_at')
        .maybeSingle(),
    { functionName: 'markNotificationRead', params: { id } },
  )

  return { data: response.data ?? null, error: response.error }
}

/**
 * Marks all unread notifications as read for a recruiter.
 *
 * @param {string} recruiterId
 * @returns {Promise<{ data: Array<object>, error: null | object | string }>}
 */
export const markAllRead = async (recruiterId) => {
  if (!recruiterId) return invalidInput('Invalid input')

  const response = await apiClient(
    (supabase) =>
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recruiter_id', recruiterId)
        .eq('is_read', false)
        .select('id,is_read'),
    { functionName: 'markAllRead', params: { recruiterId } },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: Array.isArray(response.data) ? response.data : [], error: response.error }
}

/**
 * Fetches analytics for a job.
 *
 * @param {string} jobId
 * @returns {Promise<{ data: typeof DEFAULT_ANALYTICS | null, error: null | object | string }>}
 */
export const getAnalytics = async (jobId) => {
  if (!jobId) return invalidInput('Invalid input')

  const response = await apiClient(
    async (supabase) => {
      const [
        totalAttempts,
        completedAttempts,
        candidateCount,
        shortlistedCount,
        resultRows,
        timelineRows,
      ] = await Promise.all([
        supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('job_id', jobId),
        supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'completed'),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('job_id', jobId),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'shortlisted'),
        supabase
          .from('results')
          .select('overall_score,assessments!inner(job_id)')
          .eq('assessments.job_id', jobId)
          .limit(5000),
        supabase
          .from('assessments')
          .select('created_at')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(1000),
      ])

      const results = [totalAttempts, completedAttempts, candidateCount, shortlistedCount, resultRows, timelineRows]
      const error = results.find((result) => result.error)?.error
      if (error) return { data: null, error }

      const attempts = toCount(totalAttempts.count)
      if (attempts === 0) return { data: DEFAULT_ANALYTICS, error: null }

      const completed = toCount(completedAttempts.count)
      const candidates = toCount(candidateCount.count)
      const shortlisted = toCount(shortlistedCount.count)
      const scores = Array.isArray(resultRows.data) ? resultRows.data.map((row) => toNumber(row.overall_score)) : []
      const scoreTotal = scores.reduce((sum, score) => sum + score, 0)

      return {
        data: {
          totalAttempts: attempts,
          avgScore: scores.length > 0 ? roundTwo(scoreTotal / scores.length) : 0,
          completionRate: attempts > 0 ? roundTwo((completed / attempts) * 100) : 0,
          shortlistedRate: candidates > 0 ? roundTwo((shortlisted / candidates) * 100) : 0,
          timeline: buildTimeline(timelineRows.data),
        },
        error: null,
      }
    },
    { functionName: 'getAnalytics', params: { jobId } },
  )

  if (response.error) return { data: null, error: response.error }

  return { data: response.data ?? DEFAULT_ANALYTICS, error: response.error }
}
