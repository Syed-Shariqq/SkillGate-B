import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAI, normalizeAIResponse, parseJSON } from '../_shared/ai.js'
import { getCached, hashKey, setCache } from '../_shared/cache.js'
import { checkRateLimit, getLimit } from '../_shared/rateLimit.js'

console.log('[generate-questions] invoked')

type JsonRecord = Record<string, unknown>

type Job = {
  title: string
  description: string
  skills: unknown
  time_limit_minutes: number
  recruiter_id: string
}

type AIQuestion = {
  question_text: string
  question_type: 'mcq' | 'text'
  skill: string
  difficulty: 'easy' | 'medium' | 'hard'
  points: 10 | 20 | 30
  options: string[] | null
  correct_answer: string | null
  ideal_answer: string | null
}

type DBQuestion = AIQuestion & {
  job_id: string
  recruiter_id: string
  order_index: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  })
}

function errorResponse(error: string, status: number, code?: string): Response {
  const body: JsonRecord = { error }

  if (code) {
    body.code = code
  }

  return jsonResponse(body, status)
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readRequestBody(req: Request): Promise<JsonRecord | null> {
  try {
    const body: unknown = await req.json()

    return isRecord(body) ? body : null
  } catch (_error) {
    return null
  }
}

function normalizeSkills(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((skill) => {
        if (typeof skill === 'string') return skill.trim()
        if (typeof skill === 'object' && skill !== null && typeof (skill as Record<string, unknown>).name === 'string') {
          return ((skill as Record<string, unknown>).name as string).trim()
        }
        return null
      })
      .filter((skill): skill is string => typeof skill === 'string' && skill.length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0)
  }

  return []
}

function getStringField(
  source: JsonRecord,
  snakeKey: string,
  camelKey?: string,
): string | null {
  const snakeValue = source[snakeKey]
  const camelValue = camelKey ? source[camelKey] : null
  const value = typeof snakeValue === 'string' ? snakeValue : camelValue

  return typeof value === 'string' ? value.trim() : null
}

function getNullableStringField(
  source: JsonRecord,
  snakeKey: string,
  camelKey?: string,
): string | null {
  const snakeValue = source[snakeKey]
  const camelValue = camelKey ? source[camelKey] : null
  const value =
    typeof snakeValue === 'string' || snakeValue === null
      ? snakeValue
      : camelValue

  if (value === null || value === undefined) {
    return null
  }

  return typeof value === 'string' ? value.trim() : null
}

function buildPrompt(job: Job, skills: string[], stricter = false): string {
  const warning = stricter
    ? 'CRITICAL: Return ONLY valid JSON. Nothing else. No markdown, no trailing commas, no extra fields.'
    : 'Return strict JSON only. No markdown. No explanation. No extra fields.'

  const shortDescription = job.description.slice(0, 500)

  return `${warning}

Job: ${job.title}
Skills: ${skills.join(', ')}
Description: ${shortDescription}

Return exactly this JSON structure with 8 questions:
{"questions": [...]}

5 MCQ: 4 options each, correct_answer matches one option exactly, 3 easy (points=10) + 2 medium (points=20)
3 text: ideal_answer required non-empty, 1 medium (points=20) + 2 hard (points=30)
Every question must have: question_text, question_type ('mcq'/'text'), skill (must match one of: ${skills.join(', ')}), difficulty ('easy'/'medium'/'hard'), points (10/20/30), options (array or null), correct_answer (string or null), ideal_answer (string or null)`
}

function validateQuestions(rawQuestions: unknown, skills: string[]): AIQuestion[] | null {
  if (!Array.isArray(rawQuestions) || rawQuestions.length < 5) {
      console.error(
        '[generate-questions] validation failure: expected at least 5 questions',
      )
    return null
  }

  if (rawQuestions.length !== 8) {
    console.error('[generate-questions] validation failure: expected exactly 8 questions')
    return null
  }

  const allowedSkills = new Set(skills)
  const seenQuestionText = new Set<string>()
  const questions: AIQuestion[] = []

  for (const item of rawQuestions) {
    if (!isRecord(item)) {
      console.error('[generate-questions] validation failure: question is not an object')
      return null
    }

    const questionText = getStringField(item, 'question_text')
    const questionType = getStringField(item, 'question_type')
    const skill = getStringField(item, 'skill')
    const difficulty = getStringField(item, 'difficulty')
    const correctAnswer = getNullableStringField(
      item,
      'correct_answer',
      'correctAnswer',
    )
    const idealAnswer = getNullableStringField(item, 'ideal_answer', 'idealAnswer')
    const points = item.points
    const options = item.options

    if (
      !questionText ||
      !questionType ||
      !skill ||
      !difficulty ||
      questionText.length > 2000 ||
      skill.length > 2000
    ) {
      console.error('[generate-questions] validation failure: missing or oversized string')
      return null
    }

    if (seenQuestionText.has(questionText)) {
      console.error('[generate-questions] validation failure: duplicate question_text')
      return null
    }

    seenQuestionText.add(questionText)

    if (!allowedSkills.has(skill)) {
      console.error('[generate-questions] validation failure: skill not in input skills')
      return null
    }

    if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
      console.error('[generate-questions] validation failure: invalid difficulty')
      return null
    }

    if (points !== 10 && points !== 20 && points !== 30) {
      console.error('[generate-questions] validation failure: invalid points')
      return null
    }

    if (questionType === 'mcq') {
      if (
        !Array.isArray(options) ||
        options.length !== 4 ||
        options.some(
          (option) =>
            typeof option !== 'string' ||
            option.trim().length === 0 ||
            option.length > 2000,
        ) ||
        !correctAnswer ||
        !options.includes(correctAnswer)
      ) {
        console.error('[generate-questions] validation failure: invalid MCQ')
        return null
      }

      questions.push({
        question_text: questionText,
        question_type: 'mcq',
        skill,
        difficulty,
        points,
        options: options.map((option) => option.trim()),
        correct_answer: correctAnswer,
        ideal_answer: null,
      })
      continue
    }

    if (questionType === 'text') {
      if (
        options !== null ||
        !idealAnswer ||
        idealAnswer.length > 2000 ||
        (correctAnswer !== null && correctAnswer.length > 2000)
      ) {
        console.error('[generate-questions] validation failure: invalid text question')
        return null
      }

      questions.push({
        question_text: questionText,
        question_type: 'text',
        skill,
        difficulty,
        points,
        options: null,
        correct_answer: null,
        ideal_answer: idealAnswer,
      })
      continue
    }

    console.error('[generate-questions] validation failure: invalid question_type')
    return null
  }

  const mcqQuestions = questions.filter(
    (question) => question.question_type === 'mcq',
  )
  const textQuestions = questions.filter(
    (question) => question.question_type === 'text',
  )
  const easyMcqCount = mcqQuestions.filter(
    (question) => question.difficulty === 'easy',
  ).length
  const mediumMcqCount = mcqQuestions.filter(
    (question) => question.difficulty === 'medium',
  ).length
  const mediumTextCount = textQuestions.filter(
    (question) => question.difficulty === 'medium',
  ).length
  const hardTextCount = textQuestions.filter(
    (question) => question.difficulty === 'hard',
  ).length

  if (
    mcqQuestions.length !== 5 ||
    textQuestions.length !== 3 ||
    easyMcqCount !== 3 ||
    mediumMcqCount !== 2 ||
    mediumTextCount !== 1 ||
    hardTextCount !== 2
  ) {
    console.error('[generate-questions] validation failure: invalid question mix')
    return null
  }

  return questions
}

async function generateQuestions(
  prompt: string,
  skills: string[],
): Promise<AIQuestion[] | null> {
  const aiResult = await callAI(prompt, 8000)

  if (aiResult.error || !aiResult.data) {
    console.error('[generate-questions] AI failure', aiResult.error)
    return null
  }

  const parsed = parseJSON(aiResult.data)

  if (parsed.error || !parsed.data) {
    console.error('[generate-questions] parse failure', parsed.error)
    return null
  }

  const normalized = normalizeAIResponse(parsed.data)

  if (normalized.error || !normalized.data) {
    console.error('[generate-questions] normalize failure', normalized.error)
    return null
  }

  return validateQuestions(normalized.data.questions, skills)
}

function shuffleQuestions(questions: AIQuestion[]): AIQuestion[] {
  const shuffled = [...questions]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

async function markAssessmentFailed(
  supabase: ReturnType<typeof createClient>,
  assessmentId: string,
  recruiterId: string,
  jobId: string,
  jobTitle: string,
) {
  const { error } = await supabase
    .from('assessments')
    .update({ status: 'failed' })
    .eq('id', assessmentId)

  if (error) {
    console.error('[generate-questions] failed to mark assessment failed', error)
  }

  try {
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        recruiter_id: recruiterId,
        type: 'assessment_generation_failed',
        title: 'Assessment generation failed',
        message: `Question generation failed for "${jobTitle}". The candidate can retry from their assessment link.`,
        assessment_id: assessmentId,
        job_id: jobId,
        candidate_id: null,
        is_read: false,
      })

    if (notificationError) {
      console.error('[generate-questions] failed to insert failure notification', notificationError)
    }
  } catch (err) {
    console.error('[generate-questions] exception inserting failure notification', err)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[generate-questions] start')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[generate-questions] missing Supabase environment')
    return errorResponse('Server configuration error', 500, 'CONFIG_ERROR')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const body = await readRequestBody(req)
    const assessmentId =
      typeof body?.assessmentId === 'string' ? body.assessmentId : ''
    const jobId = typeof body?.jobId === 'string' ? body.jobId : ''

    if (!uuidPattern.test(assessmentId) || !uuidPattern.test(jobId)) {
      return errorResponse('Invalid request body', 400, 'INVALID_REQUEST')
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title, description, skills, time_limit_minutes, recruiter_id')
      .eq('id', jobId)
      .maybeSingle<Job>()

    if (jobError) {
      console.error('[generate-questions] job fetch failed', jobError)
      return errorResponse('Failed to fetch job', 500, 'DB_ERROR')
    }

    if (!job) {
      return errorResponse('Job not found', 404, 'JOB_NOT_FOUND')
    }

    const recruiterId = job.recruiter_id

    if (!recruiterId) {
      console.error('[generate-questions] job missing recruiter_id')
      return errorResponse('Server configuration error', 500, 'CONFIG_ERROR')
    }

    const { count: existingQuestionCount, error: existingQuestionsError } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId)
      .eq('recruiter_id', recruiterId)

    if (existingQuestionsError) {
      console.error(
        '[generate-questions] existing questions check failed',
        existingQuestionsError,
      )
      return errorResponse('Failed to check existing questions', 500, 'DB_ERROR')
    }

    if ((existingQuestionCount ?? 0) > 0) {
      return jsonResponse({
        status: 'already_exists',
        questionCount: existingQuestionCount ?? 0,
      })
    }

    const { data: lockAcquired, error: lockError } = await supabase.rpc(
      'lock_assessment_question_generation',
      {
        p_assessment_id: assessmentId,
        p_job_id: jobId,
        p_recruiter_id: recruiterId,
      },
    )

    if (lockError) {
      console.error('[generate-questions] lock failed', lockError)
      return errorResponse('Failed to lock assessment', 500, 'DB_ERROR')
    }

    if (lockAcquired !== true) {
      return jsonResponse({ status: 'in_progress' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', recruiterId)
      .maybeSingle<{ subscription_tier: string | null }>()

    if (profileError) {
      console.error('[generate-questions] profile fetch failed', profileError)
      await markAssessmentFailed(supabase, assessmentId, recruiterId, jobId, job.title)
      return errorResponse('Failed to fetch profile', 500, 'DB_ERROR')
    }

    const subscriptionTier = profile?.subscription_tier ?? 'free'
    const limitTier =
      subscriptionTier === 'growth'
        ? 'pro'
        : subscriptionTier === 'scale'
          ? 'enterprise'
          : subscriptionTier
    const limit = getLimit(limitTier)
    const rateLimit = await checkRateLimit(
      supabase,
      recruiterId,
      'generate-questions',
      limit,
    )

    if (!rateLimit.allowed) {
      console.error('[generate-questions] rate limit exceeded', rateLimit)
      await markAssessmentFailed(supabase, assessmentId, recruiterId, jobId, job.title)
      return jsonResponse(
        { error: 'Rate limit exceeded', count: rateLimit.count },
        429,
      )
    }

    const skills = normalizeSkills(job.skills)

    if (skills.length === 0) {
      console.error('[generate-questions] validation failure: job has no skills')
      await markAssessmentFailed(supabase, assessmentId, recruiterId, jobId, job.title)
      return errorResponse('Job skills are required', 400, 'INVALID_JOB')
    }

    const cacheKey = await hashKey({
      jobId,
      title: job.title,
      description: job.description,
      skills,
      version: 'v1',
      model: 'gemini-2.5-flash',
    })

    let questions = cacheKey ? await getCached(supabase, cacheKey) : null

    if (questions) {
      console.log('[generate-questions] cache hit')
      questions = validateQuestions(questions, skills)
    } else {
      console.log('[generate-questions] cache miss')
    }

    if (!questions) {
      const prompt = buildPrompt(job, skills)
      questions = await generateQuestions(prompt, skills)

      if (!questions) {
        console.log('[generate-questions] retry triggered')
        const retryPrompt = buildPrompt(job, skills, true)
        questions = await generateQuestions(retryPrompt, skills)
      }

      if (!questions) {
        console.error('[generate-questions] failure: AI generation failed after retry')
        await markAssessmentFailed(supabase, assessmentId, recruiterId, jobId, job.title)
        return errorResponse('Failed to generate questions', 500, 'AI_FAILURE')
      }

      if (cacheKey) {
        await setCache(supabase, cacheKey, 'questions', questions, 86400)
      }
    }

    const dbQuestions: DBQuestion[] = shuffleQuestions(questions).map(
      (question, index) => ({
        ...question,
        job_id: jobId,
        recruiter_id: recruiterId,
        order_index: index + 1,
      }),
    )

    const { error: rpcError } = await supabase.rpc(
      'insert_questions_and_mark_ready',
      {
        p_assessment_id: assessmentId,
        p_questions: dbQuestions,
      },
    )

    if (rpcError) {
      console.error('[generate-questions] RPC write failed', rpcError)
      await markAssessmentFailed(supabase, assessmentId, recruiterId, jobId, job.title)
      return errorResponse('Failed to save questions', 500, 'DB_ERROR')
    }

    console.log('[generate-questions] success', {
      assessmentId,
      questionCount: dbQuestions.length,
    })

    return jsonResponse({
      status: 'success',
      questionCount: dbQuestions.length,
      timeLimit: job.time_limit_minutes,
    })
  } catch (error) {
    console.error('[generate-questions] failure', error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
})
