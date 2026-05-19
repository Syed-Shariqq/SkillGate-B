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
  submitted_at: string | null;
};

type SubmittedAssessmentRow = {
  id: string;
  submitted_at: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBMITTABLE_STATUSES = ["ready", "in_progress"];
const IDEMPOTENT_SUCCESS_STATUSES = ["submitted", "evaluating", "completed"];

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

async function invokeEvaluation(
  assessmentId: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("evaluation_invocation_not_configured");
    return;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/evaluate-responses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({ assessmentId }),
      },
    );

    if (!response.ok) {
      logger.error("evaluation_invocation_failed", {
        assessmentId,
        status: response.status,
      });
      return;
    }

    logger.info("evaluation_invoked", { assessmentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("evaluation_invocation_error", { assessmentId, message });
  }
}

function scheduleEvaluation(
  assessmentId: string,
  logger: ReturnType<typeof createLogger>,
): void {
  const promise = invokeEvaluation(assessmentId, logger);
  const runtime = globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  };

  if (typeof runtime.EdgeRuntime?.waitUntil === "function") {
    runtime.EdgeRuntime.waitUntil(promise);
    return;
  }

  promise.catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("evaluation_schedule_error", { assessmentId, message });
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return formatError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const requestId = generateRequestId();
  const logger = createLogger("submit-assessment", requestId);

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
    const submittedAt = new Date().toISOString();

    const { data: submittedRows, error: submitError } = await supabase
      .from("assessments")
      .update({
        status: "submitted",
        submitted_at: submittedAt,
        updated_at: submittedAt,
      })
      .eq("id", assessmentId)
      .eq("candidate_id", token.candidateId)
      .in("status", SUBMITTABLE_STATUSES)
      .select("id,submitted_at")
      .returns<SubmittedAssessmentRow[]>();

    if (submitError) throw submitError;

    const submittedAssessment = submittedRows?.[0] ?? null;

    if (submittedAssessment) {
      logger.info("assessment_submitted", { assessmentId });
      scheduleEvaluation(assessmentId, logger);

      return formatSuccess({
        submitted: true,
        submittedAt: submittedAssessment.submitted_at,
        assessmentId,
      });
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id,candidate_id,status,submitted_at")
      .eq("id", assessmentId)
      .eq("candidate_id", token.candidateId)
      .maybeSingle<AssessmentRow>();

    if (assessmentError) throw assessmentError;

    if (!assessment) {
      logger.warn("assessment_not_found");
      return formatError("ASSESSMENT_NOT_FOUND", "Assessment not found", 404);
    }

    if (IDEMPOTENT_SUCCESS_STATUSES.includes(assessment.status)) {
      logger.info("submit_idempotent_success", { status: assessment.status });
      return formatSuccess({
        submitted: true,
        submittedAt: assessment.submitted_at,
        assessmentId,
      });
    }

    logger.warn("assessment_not_active", { status: assessment.status });
    return formatError(
      "ASSESSMENT_NOT_ACTIVE",
      "Assessment cannot be submitted",
      409,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError("INTERNAL_ERROR", "Unable to submit assessment", 500);
  }
});
