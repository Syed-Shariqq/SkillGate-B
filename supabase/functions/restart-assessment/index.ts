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
  attempt_number: number;
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
    return formatError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const requestId = generateRequestId();
  const logger = createLogger("restart-assessment", requestId);

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
      .select("id,candidate_id,status,attempt_number")
      .eq("id", assessmentId)
      .eq("candidate_id", token.candidateId)
      .maybeSingle<AssessmentRow>();

    if (assessmentError) throw assessmentError;

    if (!assessment) {
      logger.warn("assessment_not_found");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    }

    if (assessment.status !== "in_progress") {
      logger.warn("assessment_not_restartable", { status: assessment.status });
      return formatError(
        "ASSESSMENT_NOT_RESTARTABLE",
        "Assessment is not in progress",
        400,
      );
    }

    const currentAttempt = assessment.attempt_number ?? 1;
    if (currentAttempt !== 1) {
      logger.warn("restart_already_used", { attemptNumber: currentAttempt });
      return formatError(
        "RESTART_ALREADY_USED",
        "The one-time restart has already been used",
        409,
      );
    }

    // Delete responses rows
    const { error: deleteError } = await supabase
      .from("responses")
      .delete()
      .eq("assessment_id", assessmentId);

    if (deleteError) {
      logger.error("delete_responses_failed", { error: deleteError.message });
      throw deleteError;
    }

    // Optimistic concurrency compare-and-retry update loop (up to 3 times)
    let updatedAssessment = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const now = new Date().toISOString();
      const { data, error: updateError } = await supabase
        .from("assessments")
        .update({
          attempt_number: 2,
          started_at: now,
          status: "in_progress",
          updated_at: now,
        })
        .eq("id", assessmentId)
        .or("attempt_number.eq.1,attempt_number.is.null")
        .eq("status", "in_progress")
        .select("attempt_number,started_at")
        .maybeSingle<{ attempt_number: number; started_at: string }>();

      if (updateError) throw updateError;
      if (data) {
        updatedAssessment = data;
        break;
      }

      // If data is null, fetch the latest state to see if it failed due to concurrency mismatch
      const { data: latest, error: latestError } = await supabase
        .from("assessments")
        .select("attempt_number,status")
        .eq("id", assessmentId)
        .maybeSingle<{ attempt_number: number | null; status: string }>();

      if (latestError) throw latestError;
      if (!latest) {
        throw new Error("Assessment not found during update retry");
      }

      if (latest.status !== "in_progress") {
        logger.warn("restart_failed_status_changed", { status: latest.status });
        return formatError(
          "ASSESSMENT_NOT_RESTARTABLE",
          "Assessment is no longer in progress",
          400,
        );
      }

      const latestAttempt = latest.attempt_number ?? 1;
      if (latestAttempt !== 1) {
        logger.warn("restart_failed_already_used", { attemptNumber: latestAttempt });
        return formatError(
          "RESTART_ALREADY_USED",
          "The one-time restart has already been used",
          409,
        );
      }
    }

    if (!updatedAssessment) {
      logger.error("restart_failed_concurrency_exhausted");
      throw new Error("Unable to restart assessment after retrying");
    }

    logger.info("assessment_restarted_successfully", {
      assessmentId,
      attemptNumber: updatedAssessment.attempt_number,
      startedAt: updatedAssessment.started_at,
    });

    return formatSuccess({
      restarted: true,
      attemptNumber: updatedAssessment.attempt_number,
      startedAt: updatedAssessment.started_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError(
      "INTERNAL_ERROR",
      "Unable to restart assessment",
      500,
    );
  }
});
