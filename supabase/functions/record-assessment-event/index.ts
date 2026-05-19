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
  tab_switches: number;
  paste_attempts: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_ASSESSMENT_STATUSES = ["ready", "in_progress"];
const SUPPORTED_EVENTS = ["tab_switch", "paste_attempt"];
const MAX_EVENT_COUNT = 86400;

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

function normalizeEventType(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const eventType = value.trim();

  return SUPPORTED_EVENTS.includes(eventType) ? eventType : null;
}

function normalizeMetadata(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function normalizeTabSwitchCount(metadata: JsonRecord): number | null {
  const count = metadata.count;

  if (!Number.isInteger(count)) return null;
  if (count < 0 || count > MAX_EVENT_COUNT) return null;

  return count;
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

async function recordTabSwitch(
  supabase: ReturnType<typeof createServiceClient>,
  assessment: AssessmentRow,
  count: number,
): Promise<void> {
  const nextCount = Math.max(assessment.tab_switches ?? 0, count);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("assessments")
    .update({
      tab_switches: nextCount,
      is_flagged: nextCount >= 3,
      updated_at: now,
    })
    .eq("id", assessment.id)
    .eq("status", assessment.status);

  if (error) throw error;
}

async function recordPasteAttempt(
  supabase: ReturnType<typeof createServiceClient>,
  assessment: AssessmentRow,
): Promise<void> {
  let currentCount = assessment.paste_attempts ?? 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("assessments")
      .update({
        paste_attempts: currentCount + 1,
        updated_at: now,
      })
      .eq("id", assessment.id)
      .eq("paste_attempts", currentCount)
      .in("status", ACTIVE_ASSESSMENT_STATUSES)
      .select("paste_attempts")
      .maybeSingle<{ paste_attempts: number }>();

    if (error) throw error;
    if (data) return;

    const { data: latest, error: latestError } = await supabase
      .from("assessments")
      .select("paste_attempts,status")
      .eq("id", assessment.id)
      .maybeSingle<{ paste_attempts: number; status: string }>();

    if (latestError) throw latestError;
    if (!latest || !ACTIVE_ASSESSMENT_STATUSES.includes(latest.status)) {
      throw new Error("Assessment is no longer active");
    }

    currentCount = latest.paste_attempts ?? currentCount;
  }

  throw new Error("Unable to record paste attempt");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return formatError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const requestId = generateRequestId();
  const logger = createLogger("record-assessment-event", requestId);

  try {
    const body = await readBody(req);
    const missingFields = validateRequiredFields(body, [
      "assessmentId",
      "sessionToken",
      "eventType",
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
    const eventType = normalizeEventType(body?.eventType);
    const metadata = normalizeMetadata(body?.metadata);

    if (!assessmentId || !sessionToken || !eventType) {
      logger.warn("validation_invalid_input", {
        assessmentIdValid: Boolean(assessmentId),
        sessionTokenPresent: Boolean(sessionToken),
        eventTypeValid: Boolean(eventType),
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
      .select("id,candidate_id,status,tab_switches,paste_attempts")
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

    if (eventType === "tab_switch") {
      const count = normalizeTabSwitchCount(metadata);

      if (count === null) {
        logger.warn("validation_invalid_tab_switch");
        return formatError("VALIDATION_ERROR", "Invalid event metadata", 400);
      }

      await recordTabSwitch(supabase, assessment, count);
    } else {
      await recordPasteAttempt(supabase, assessment);
    }

    const recordedAt = new Date().toISOString();
    logger.info("assessment_event_recorded", {
      assessmentId,
      eventType,
      recordedAt,
    });

    return formatSuccess({
      recorded: true,
      eventType,
      recordedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError(
      "INTERNAL_ERROR",
      "Unable to record assessment event",
      500,
    );
  }
});
