import {
  corsHeaders,
  createLogger,
  createServiceClient,
  formatError,
  formatSuccess,
  generateRequestId,
  validateRequiredFields,
} from "../_shared/utils.ts";
import { signSessionToken } from "../_shared/sessionToken.ts";

type JsonRecord = Record<string, unknown>;

type JobRow = {
  id: string;
  recruiter_id: string;
  time_limit_minutes: number;
  is_active: boolean;
  link_expires_at: string | null;
  link_max_uses: number | null;
  link_use_count: number;
  allow_retakes: boolean;
};

type CandidateRow = {
  id: string;
  job_id: string;
  recruiter_id: string;
  full_name: string;
  email: string;
  status: string;
};

type AssessmentRow = {
  id: string;
  candidate_id: string;
  job_id: string;
  recruiter_id: string;
  status: string;
  attempt_number: number;
  time_limit_minutes: number;
};

const ACTIVE_ASSESSMENT_STATUSES = ["pending", "ready", "in_progress"];
const TERMINAL_ATTEMPT_STATUSES = ["submitted", "evaluating", "completed"];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readBody(req: Request): Promise<JsonRecord | null> {
  try {
    const value: unknown = await req.json();

    return isRecord(value) ? value : null;
  } catch (_error) {
    return null;
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();

  return emailPattern.test(email) ? email : null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = value.trim().replace(/\s+/g, " ");

  return name.length >= 2 && name.length <= 100 ? name : null;
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const token = value.trim();

  return token.length > 0 && token.length <= 512 ? token : null;
}

function isExpired(value: string | null): boolean {
  if (!value) return false;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function buildIdempotencyKey(
  candidateId: string,
  jobId: string,
  attemptNumber: number,
): string {
  return `candidate:${candidateId}:job:${jobId}:attempt:${attemptNumber}`;
}

function isUniqueViolation(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "23505";
}

function validateUuid(value: string): boolean {
  return uuidPattern.test(value);
}

async function fetchActiveAssessment(
  supabase: ReturnType<typeof createServiceClient>,
  candidateId: string,
  jobId: string,
): Promise<AssessmentRow | null> {
  const { data, error } = await supabase
    .from("assessments")
    .select(
      "id,candidate_id,job_id,recruiter_id,status,attempt_number,time_limit_minutes",
    )
    .eq("candidate_id", candidateId)
    .eq("job_id", jobId)
    .in("status", ACTIVE_ASSESSMENT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssessmentRow>();

  if (error) throw error;

  return data ?? null;
}

async function countQuestions(
  supabase: ReturnType<typeof createServiceClient>,
  assessmentId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);

  if (error) throw error;

  return count ?? 0;
}

async function fetchAssessmentStatus(
  supabase: ReturnType<typeof createServiceClient>,
  assessmentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("assessments")
    .select("status")
    .eq("id", assessmentId)
    .maybeSingle<{ status: string }>();

  if (error) throw error;

  return data?.status ?? null;
}

async function markAssessmentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  assessmentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("assessments")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId)
    .in("status", ["pending", "ready"]);

  if (error) throw error;
}

async function markAssessmentReadyIfQuestionsExist(
  supabase: ReturnType<typeof createServiceClient>,
  assessmentId: string,
): Promise<void> {
  const questionCount = await countQuestions(supabase, assessmentId);

  if (questionCount === 0) return;

  const { error } = await supabase
    .from("assessments")
    .update({
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId)
    .eq("status", "pending");

  if (error) throw error;
}

async function waitForGeneration(
  supabase: ReturnType<typeof createServiceClient>,
  assessmentId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await fetchAssessmentStatus(supabase, assessmentId);
    const questionCount = await countQuestions(supabase, assessmentId);

    if (status === "ready" && questionCount > 0) return "ready";
    if (status === "failed") return "failed";

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return (await fetchAssessmentStatus(supabase, assessmentId)) ?? "pending";
}

async function ensureQuestionsReady(
  supabase: ReturnType<typeof createServiceClient>,
  assessment: AssessmentRow,
  logger: ReturnType<typeof createLogger>,
): Promise<string> {
  if (assessment.status === "in_progress") {
    return assessment.status;
  }

  const existingQuestionCount = await countQuestions(supabase, assessment.id);

  if (assessment.status === "ready" && existingQuestionCount > 0) {
    return "ready";
  }

  if (existingQuestionCount > 0) {
    await markAssessmentReadyIfQuestionsExist(supabase, assessment.id);
    return "ready";
  }

  logger.info("question_generation_started", {
    assessmentId: assessment.id,
    jobId: assessment.job_id,
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Use service role key for internal service-to-service invocation.
  // The anon key is a JWT the Supabase gateway validates — it can cause a 401
  // even when verify_jwt is disabled in the dashboard (dashboard toggle is
  // overwritten on every CLI deploy). The service role key bypasses platform
  // JWT auth entirely and is safe here because this call is server-side only.
  const genResponse = await fetch(
    `${supabaseUrl}/functions/v1/generate-questions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey ?? "",
      },
      body: JSON.stringify({
        assessmentId: assessment.id,
        jobId: assessment.job_id,
      }),
    },
  );

  const genData = await genResponse.json();

  if (!genResponse.ok) {
    logger.error("question_generation_invocation_failed", {
      assessmentId: assessment.id,
      status: genResponse.status,
      message: genData?.error || "Generation failed",
    });
    await markAssessmentFailed(supabase, assessment.id);
    return "failed";
  }

  const generationStatus =
    isRecord(genData) && typeof genData.status === "string"
      ? genData.status
      : "success";

  if (generationStatus === "in_progress") {
    return await waitForGeneration(supabase, assessment.id);
  }

  const status = await waitForGeneration(supabase, assessment.id);

  if (status !== "ready") {
    await markAssessmentFailed(supabase, assessment.id);
    return "failed";
  }

  return status;
}

async function incrementLinkUseCount(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("increment_job_link_use_count", {
    p_job_id: jobId,
  });

  if (error) throw error;

  return data === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return formatError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const requestId = generateRequestId();
  const logger = createLogger("start-assessment", requestId);

  try {
    const body = await readBody(req);
    const missingFields = validateRequiredFields(body, [
      "name",
      "email",
      "token",
    ]);

    if (missingFields.length > 0) {
      logger.warn("validation_missing_fields", { fields: missingFields });
      return formatError(
        "VALIDATION_ERROR",
        "Required fields are missing",
        400,
      );
    }

    const name = normalizeName(body?.name);
    const email = normalizeEmail(body?.email);
    const token = normalizeToken(body?.token);

    if (!name || !email || !token) {
      logger.warn("validation_invalid_input", {
        nameValid: Boolean(name),
        emailValid: Boolean(email),
        tokenPresent: Boolean(token),
      });
      return formatError("VALIDATION_ERROR", "Invalid input", 400);
    }

    const supabase = createServiceClient();

    logger.info("job_lookup_started");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "id,recruiter_id,time_limit_minutes,is_active,link_expires_at,link_max_uses,link_use_count,allow_retakes",
      )
      .eq("assessment_link_token", token)
      .maybeSingle<JobRow>();

    if (jobError) throw jobError;

    if (!job) {
      logger.warn("token_invalid");
      return formatError("TOKEN_INVALID", "Assessment link is invalid", 401);
    }

    if (!validateUuid(job.id) || !validateUuid(job.recruiter_id)) {
      logger.error("job_identity_invalid", { jobId: job.id });
      return formatError(
        "INTERNAL_ERROR",
        "Assessment link is unavailable",
        500,
      );
    }

    if (!job.is_active) {
      logger.warn("job_inactive", { jobId: job.id });
      return formatError("JOB_INACTIVE", "Assessment link is inactive", 403);
    }

    if (isExpired(job.link_expires_at)) {
      logger.warn("token_expired", { jobId: job.id });
      return formatError("TOKEN_EXPIRED", "Assessment link has expired", 401);
    }

    if (
      Number.isInteger(job.link_max_uses) &&
      job.link_max_uses !== null &&
      job.link_max_uses >= 0 &&
      job.link_use_count >= job.link_max_uses
    ) {
      logger.warn("link_exhausted", { jobId: job.id });
      return formatError(
        "LINK_EXHAUSTED",
        "Assessment link limit reached",
        409,
      );
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .upsert(
        {
          job_id: job.id,
          recruiter_id: job.recruiter_id,
          full_name: name,
          email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,job_id" },
      )
      .select("id,job_id,recruiter_id,full_name,email,status")
      .maybeSingle<CandidateRow>();

    if (candidateError) throw candidateError;
    if (!candidate?.id) {
      logger.error("candidate_upsert_empty", { jobId: job.id });
      return formatError("INTERNAL_ERROR", "Unable to create candidate", 500);
    }

    let assessment = await fetchActiveAssessment(
      supabase,
      candidate.id,
      job.id,
    );
    let createdNewAssessment = false;

    if (!assessment) {
      const { data: latestAssessment, error: latestAssessmentError } =
        await supabase
          .from("assessments")
          .select("status,attempt_number")
          .eq("candidate_id", candidate.id)
          .eq("job_id", job.id)
          .order("attempt_number", { ascending: false })
          .limit(1)
          .maybeSingle<{ status: string; attempt_number: number }>();

      if (latestAssessmentError) throw latestAssessmentError;

      if (
        latestAssessment &&
        TERMINAL_ATTEMPT_STATUSES.includes(latestAssessment.status) &&
        !job.allow_retakes
      ) {
        logger.warn("retake_blocked", {
          candidateId: candidate.id,
          jobId: job.id,
        });
        return formatError("LINK_EXHAUSTED", "Assessment already taken", 409);
      }

      const attemptNumber = latestAssessment?.attempt_number
        ? latestAssessment.attempt_number + 1
        : 1;
      const now = new Date().toISOString();

      const { data: createdAssessment, error: createAssessmentError } =
        await supabase
          .from("assessments")
          .insert({
            candidate_id: candidate.id,
            job_id: job.id,
            recruiter_id: job.recruiter_id,
            status: "pending",
            attempt_number: attemptNumber,
            time_limit_minutes: job.time_limit_minutes,
            idempotency_key: buildIdempotencyKey(
              candidate.id,
              job.id,
              attemptNumber,
            ),
            created_at: now,
            updated_at: now,
          })
          .select(
            "id,candidate_id,job_id,recruiter_id,status,attempt_number,time_limit_minutes",
          )
          .maybeSingle<AssessmentRow>();

      if (createAssessmentError) {
        if (!isUniqueViolation(createAssessmentError))
          throw createAssessmentError;

        assessment = await fetchActiveAssessment(
          supabase,
          candidate.id,
          job.id,
        );
      } else {
        assessment = createdAssessment ?? null;
        createdNewAssessment = Boolean(createdAssessment);
      }
    }

    if (!assessment?.id) {
      logger.error("assessment_create_empty", {
        candidateId: candidate.id,
        jobId: job.id,
      });
      return formatError("INTERNAL_ERROR", "Unable to create assessment", 500);
    }

    const assessmentStatus = await ensureQuestionsReady(
      supabase,
      assessment,
      logger,
    );

    if (assessmentStatus === "failed") {
      logger.error("question_generation_failed", {
        assessmentId: assessment.id,
        jobId: job.id,
      });
      return formatError(
        "QUESTION_GENERATION_FAILED",
        "Unable to generate assessment questions",
        500,
      );
    }

    if (createdNewAssessment) {
      const incremented = await incrementLinkUseCount(supabase, job.id);

      if (!incremented) {
        await markAssessmentFailed(supabase, assessment.id);
        logger.warn("link_exhausted_after_create", {
          assessmentId: assessment.id,
          jobId: job.id,
        });
        return formatError(
          "LINK_EXHAUSTED",
          "Assessment link limit reached",
          409,
        );
      }
    }

    const sessionToken = await signSessionToken({
      assessmentId: assessment.id,
      candidateId: candidate.id,
    });

    logger.info("assessment_started", {
      assessmentId: assessment.id,
      candidateId: candidate.id,
      jobId: job.id,
      assessmentStatus,
      reused: !createdNewAssessment,
    });

    return formatSuccess({
      assessmentId: assessment.id,
      candidateId: candidate.id,
      sessionToken,
      assessmentStatus,
      requestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError("INTERNAL_ERROR", "Unable to start assessment", 500);
  }
});
