import {
  corsHeaders,
  createLogger,
  createServiceClient,
  formatError,
  formatSuccess,
  generateRequestId,
  validateRequiredFields,
} from "../_shared/utils.ts";

type JsonRecord = Record<string, unknown>;

type JobRow = {
  id: string;
  title: string;
  company_name: string;
  description: string;
  skills: unknown;
  min_score_threshold: number;
  time_limit_minutes: number;
  is_active: boolean;
  link_expires_at: string | null;
  link_max_uses: number | null;
  link_use_count: number;
  allow_retakes: boolean;
};

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

function isLimitReached(job: JobRow): boolean {
  return (
    Number.isInteger(job.link_max_uses) &&
    job.link_max_uses !== null &&
    job.link_max_uses >= 0 &&
    job.link_use_count >= job.link_max_uses
  );
}

function buildJobDto(job: JobRow): JsonRecord {
  return {
    id: job.id,
    title: job.title,
    company_name: job.company_name,
    description: job.description,
    skills: job.skills,
    min_score_threshold: job.min_score_threshold,
    time_limit_minutes: job.time_limit_minutes,
    is_active: job.is_active,
    link_expires_at: job.link_expires_at,
    link_max_uses: job.link_max_uses,
    link_use_count: job.link_use_count,
    allow_retakes: job.allow_retakes,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return formatError("VALIDATION_ERROR", "Method not allowed", 405);
  }

  const requestId = generateRequestId();
  const logger = createLogger("get-job-by-token", requestId);

  try {
    const body = await readBody(req);
    const missingFields = validateRequiredFields(body, ["token"]);

    if (missingFields.length > 0) {
      logger.warn("validation_missing_fields", { fields: missingFields });
      return formatError(
        "VALIDATION_ERROR",
        "Required fields are missing",
        400,
      );
    }

    const token = normalizeToken(body?.token);

    if (!token) {
      logger.warn("validation_invalid_token");
      return formatError("VALIDATION_ERROR", "Invalid input", 400);
    }

    const supabase = createServiceClient();
    const { data: job, error } = await supabase
      .from("jobs")
      .select(
        "id,title,company_name,description,skills,min_score_threshold,time_limit_minutes,is_active,link_expires_at,link_max_uses,link_use_count,allow_retakes",
      )
      .eq("assessment_link_token", token)
      .maybeSingle<JobRow>();

    if (error) throw error;

    if (!job) {
      logger.warn("job_not_found");
      return formatSuccess({ job: null, status: "not_found" });
    }

    if (!job.is_active) {
      logger.info("job_inactive", { jobId: job.id });
      return formatSuccess({ job: buildJobDto(job), status: "inactive" });
    }

    if (isExpired(job.link_expires_at)) {
      logger.info("job_expired", { jobId: job.id });
      return formatSuccess({ job: buildJobDto(job), status: "expired" });
    }

    if (isLimitReached(job)) {
      logger.info("job_limit_reached", { jobId: job.id });
      return formatSuccess({ job: buildJobDto(job), status: "limit_reached" });
    }

    logger.info("job_link_valid", { jobId: job.id });
    return formatSuccess({ job: buildJobDto(job), status: "valid" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    logger.error("unhandled_error", { message });

    return formatError("INTERNAL_ERROR", "Unable to fetch job", 500);
  }
});
