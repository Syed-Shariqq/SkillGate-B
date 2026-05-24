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
  completed_at: string | null;
};

type ResultRow = {
  overall_score: number | string | null;
  feedback_summary: string | null;
  pdf_storage_path: string | null;
};

type QuestionRow = {
  id: string;
  question_text: string;
  order_index: number;
};

type ResponseRow = {
  question_id: string;
  score: number | string | null;
  ai_feedback: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POLLING_STATUSES = ["submitted", "evaluating"];

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

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : null;
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
  const logger = createLogger("get-candidate-result", requestId);

  try {
    const body = await readBody(req);
    const missingFields = validateRequiredFields(body, [
      "assessmentId",
      "sessionToken",
    ]);

    if (missingFields.length > 0) {
      logger.warn("validation_missing_fields", { fields: missingFields });
      return formatError(
        "VALIDATION_ERROR",
        "Required fields are missing",
        400,
      );
    }

    const assessmentId = normalizeUuid(body?.assessmentId);
    const sessionToken = normalizeSessionToken(body?.sessionToken);

    if (!assessmentId || !sessionToken) {
      logger.warn("validation_invalid_input", {
        assessmentIdValid: Boolean(assessmentId),
        sessionTokenPresent: Boolean(sessionToken),
      });
      return formatError("VALIDATION_ERROR", "Invalid input", 400);
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
      .select("id,candidate_id,status,completed_at")
      .eq("id", assessmentId)
      .eq("candidate_id", token.candidateId)
      .maybeSingle<AssessmentRow>();

    if (assessmentError) throw assessmentError;

    if (!assessment) {
      logger.warn("assessment_not_found");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    }

    if (POLLING_STATUSES.includes(assessment.status)) {
      logger.info("result_polling_status", { status: assessment.status });
      return formatSuccess({
        status: assessment.status,
      });
    }

    if (assessment.status !== "completed") {
      logger.info("result_not_ready", { status: assessment.status });
      return formatSuccess({
        status: assessment.status,
      });
    }

    const { data: result, error: resultError } = await supabase
      .from("results")
      .select("id,overall_score,feedback_summary,pdf_storage_path")
      .eq("assessment_id", assessmentId)
      .maybeSingle<ResultRow>();

    if (resultError) throw resultError;

    if (!result) {
      logger.error("completed_assessment_result_missing", { assessmentId });
      return formatError("INTERNAL_ERROR", "Result is unavailable", 500);
    }

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id,question_text,order_index")
      .eq("assessment_id", assessmentId)
      .order("order_index", { ascending: true })
      .returns<QuestionRow[]>();

    if (questionsError) throw questionsError;

    const { data: responses, error: responsesError } = await supabase
      .from("responses")
      .select("question_id,score,ai_feedback")
      .eq("assessment_id", assessmentId)
      .returns<ResponseRow[]>();

    if (responsesError) throw responsesError;

    const responseByQuestionId = new Map<string, ResponseRow>(
      (responses ?? []).map((response: ResponseRow): [string, ResponseRow] => [
        response.question_id,
        response,
      ]),
    );

    logger.info("result_fetched", {
      assessmentId,
      questionCount: questions?.length ?? 0,
    });

    return formatSuccess({
      status: assessment.status,
      overallScore: toNumber(result.overall_score),
      feedback: result.feedback_summary,
      completedAt: assessment.completed_at,
      pdfStoragePath: result.pdf_storage_path ?? null,
      id: result.id,
      questionResults: (questions ?? []).map((question: QuestionRow) => {
        const response = responseByQuestionId.get(question.id);

        return {
          questionId: question.id,
          questionText: question.question_text,
          score: toNumber(response?.score),
          feedback: response?.ai_feedback ?? null,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError("INTERNAL_ERROR", "Unable to fetch result", 500);
  }
});
