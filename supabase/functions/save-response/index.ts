import {
  corsHeaders,
  createLogger,
  createServiceClient,
  formatError,
  formatSuccess,
  generateRequestId,
  validateRequiredFields,
} from "../_shared/utils.ts";
import {
  SessionTokenError,
  verifySessionToken,
} from "../_shared/sessionToken.ts";

type JsonRecord = Record<string, unknown>;

type AssessmentRow = {
  id: string;
  candidate_id: string;
  status: string;
};

type QuestionRow = {
  id: string;
  assessment_id: string | null;
};

type ResponseRow = {
  id: string;
  updated_at: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_ASSESSMENT_STATUSES = ["ready", "in_progress"];
const MAX_ANSWER_LENGTH = 10000;
const MAX_TIME_TAKEN_SECONDS = 86400;

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

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const id = value.trim();

  return uuidPattern.test(id) ? id : null;
}

function normalizeSessionToken(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const token = value.trim();

  return token.length > 0 ? token : null;
}

function normalizeAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length > MAX_ANSWER_LENGTH) return null;

  return value;
}

function normalizeTimeTaken(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > MAX_TIME_TAKEN_SECONDS) return null;

  return value; 
}

function tokenErrorResponse(error: SessionTokenError): Response {
  if (error.code === "TOKEN_EXPIRED") {
    return formatError("TOKEN_EXPIRED", "Session token expired", 401);
  }

  if (error.code === "TOKEN_CONFIG_ERROR") {
    return formatError("INTERNAL_ERROR", "Unable to verify session", 500);
  }

  return formatError("TOKEN_INVALID", "Invalid session token", 401);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return formatError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const requestId = generateRequestId();
  const logger = createLogger("save-response", requestId);

  try {
    const body = await readBody(req);
    const missingFields = validateRequiredFields(body, [
      "assessmentId",
      "questionId",
      "timeTaken",
      "sessionToken",
    ]);

    const answerMissing = !body ||
      !Object.prototype.hasOwnProperty.call(body, "answer") ||
      body.answer === null ||
      body.answer === undefined;

    if (missingFields.length > 0 || answerMissing) {
      logger.warn("validation_missing_fields", {
        fields: answerMissing ? [...missingFields, "answer"] : missingFields,
      });
      return formatError(
        "VALIDATION_ERROR",
        "Required fields are missing",
        400,
      );
    }

    const assessmentId = normalizeUuid(body?.assessmentId);
    const questionId = normalizeUuid(body?.questionId);
    const sessionToken = normalizeSessionToken(body?.sessionToken);
    const answer = normalizeAnswer(body?.answer);
    const timeTaken = normalizeTimeTaken(body?.timeTaken);

    if (!assessmentId || !questionId || !sessionToken) {
      logger.warn("validation_invalid_identity", {
        assessmentIdValid: Boolean(assessmentId),
        questionIdValid: Boolean(questionId),
        sessionTokenPresent: Boolean(sessionToken),
      });
      return formatError("VALIDATION_ERROR", "Invalid input", 400);
    }

    if (answer === null || timeTaken === null) {
      logger.warn("validation_invalid_response", {
        answerValid: answer !== null,
        timeTakenValid: timeTaken !== null,
      });
      return formatError("VALIDATION_ERROR", "Invalid response", 400);
    }

    let token;

    try {
      token = await verifySessionToken(sessionToken);
    } catch (error) {
      if (error instanceof SessionTokenError) {
        logger.warn("session_verification_failed", { code: error.code });
        return tokenErrorResponse(error);
      }

      throw error;
    }

    if (token.assessmentId !== assessmentId) {
      logger.warn("ownership_mismatch");
      return formatError(
        "OWNERSHIP_MISMATCH",
        "Session does not match assessment",
        403,
      );
    }

    const supabase = createServiceClient();

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id,candidate_id,status")
      .eq("id", assessmentId)
      .eq("candidate_id", token.candidateId)
      .maybeSingle<AssessmentRow>();

    if (assessmentError) throw assessmentError;

    if (!assessment) {
      logger.warn("assessment_not_found");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    }

    if (!ACTIVE_ASSESSMENT_STATUSES.includes(assessment.status)) {
      logger.warn("assessment_not_active", { status: assessment.status });
      return formatError(
        "ASSESSMENT_NOT_ACTIVE",
        "Assessment is not active",
        409,
      );
    }

    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id,assessment_id")
      .eq("id", questionId)
      .maybeSingle<QuestionRow>();

    if (questionError) throw questionError;

    if (!question || question.assessment_id !== assessmentId) {
      logger.warn("question_mismatch");
      return formatError(
        "QUESTION_MISMATCH",
        "Question does not belong to assessment",
        400,
      );
    }

    const now = new Date().toISOString();
    const { data: response, error: responseError } = await supabase
      .from("responses")
      .upsert(
        {
          assessment_id: assessmentId,
          question_id: questionId,
          candidate_id: token.candidateId,
          answer_given: answer,
          time_taken_seconds: timeTaken,
          updated_at: now,
        },
        { onConflict: "assessment_id,question_id" },
      )
      .select("id,updated_at")
      .single<ResponseRow>();

    if (responseError) throw responseError;

    if (assessment.status === "ready") {
      const startedAt = new Date().toISOString();
      const { error: transitionError } = await supabase
        .from("assessments")
        .update({
          status: "in_progress",
          started_at: startedAt,
          updated_at: startedAt,
        })
        .eq("id", assessmentId)
        .eq("candidate_id", token.candidateId)
        .eq("status", "ready");

      if (transitionError) throw transitionError;
    }

    logger.info("response_saved", {
      assessmentId,
      questionId,
      responseId: response.id,
    });

    return formatSuccess({
      responseId: response.id,
      savedAt: response.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError("INTERNAL_ERROR", "Unable to save response", 500);
  }
});
