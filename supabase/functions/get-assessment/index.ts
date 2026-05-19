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
  started_at: string | null;
  submitted_at: string | null;
  time_limit_minutes: number;
};

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  order_index: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
  }

  const requestId = generateRequestId();
  const logger = createLogger("get-assessment", requestId);

  try {
    const body = await readBody(req);
    const missingFields = validateRequiredFields(body, [
      "assessmentId",
      "sessionToken",
    ]);

    if (missingFields.includes("sessionToken")) {
      logger.warn("validation_missing_session");
      return formatError("TOKEN_INVALID", "Session token is required", 401);
    }

    if (missingFields.includes("assessmentId")) {
      logger.warn("validation_missing_assessment");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    }

    const assessmentId = normalizeUuid(body?.assessmentId);
    const sessionToken = normalizeSessionToken(body?.sessionToken);

    if (!sessionToken) {
      logger.warn("validation_invalid_session");
      return formatError("TOKEN_INVALID", "Invalid session token", 401);
    }

    if (!assessmentId) {
      logger.warn("validation_invalid_assessment");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
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
      .select("id,candidate_id,status,started_at,submitted_at,time_limit_minutes")
      .eq("id", assessmentId)
      .eq("candidate_id", token.candidateId)
      .maybeSingle<AssessmentRow>();

    if (assessmentError) throw assessmentError;

    if (!assessment) {
      logger.warn("assessment_not_found");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    }

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id,question_text,question_type,options,order_index")
      .eq("assessment_id", assessmentId)
      .order("order_index", { ascending: true })
      .returns<QuestionRow[]>();

    if (questionsError) throw questionsError;

    logger.info("questions_fetched", { questionCount: questions?.length ?? 0 });

    return formatSuccess({
      assessment: {
        id: assessment.id,
        status: assessment.status,
        started_at: assessment.started_at,
        submitted_at: assessment.submitted_at,
        time_limit_minutes: assessment.time_limit_minutes,
      },
      questions: (questions ?? []).map((question: QuestionRow) => ({
        id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        options: question.options,
        order_index: question.order_index,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError("INTERNAL_ERROR", "Unable to fetch assessment", 500);
  }
});
