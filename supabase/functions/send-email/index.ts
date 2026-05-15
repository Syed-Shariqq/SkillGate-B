import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;
type EmailType = "candidate_result" | "recruiter_notify" | "both";
type SendTarget = "candidate" | "recruiter";

type RequestPayload = {
  assessmentId: string;
  resultId: string;
  type: EmailType;
};

type ResultRow = {
  id: string;
  overall_score: number | string | null;
  passed: boolean | null;
  skill_scores: unknown;
  feedback_summary: string | null;
  strengths: unknown;
  weaknesses: unknown;
  improvement_resources: unknown;
  pdf_url: string | null;
  email_sent: boolean | null;
  hiring_signal: string | null;
  candidate_id: string | null;
  job_id: string | null;
  assessment_id: string | null;
};

type CandidateRow = {
  full_name: string | null;
  email: string | null;
};

type JobRow = {
  title: string | null;
  min_score_threshold: number | string | null;
  recruiter_id: string | null;
};

type AssessmentLinkRow = {
  candidate_id: string | null;
  job_id: string | null;
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  notify_on_every_completion: boolean | null;
  notify_on_pass_only: boolean | null;
};

type FetchedData = {
  result: ResultRow;
  candidate: CandidateRow;
  job: JobRow;
  profile: ProfileRow;
};

type EmailContent = {
  subject: string;
  html: string;
};

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

type EmailSendResult = {
  success: boolean;
  providerMessageId?: string;
  statusCode?: number;
  error?: string;
};

type NotificationKind = "success" | "failure";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_EMAIL = "syedshariq0824@gmail.com";
const DASHBOARD_URL = "https://skill-gate-b.vercel.app/dashboard";
const VALID_EMAIL_TYPES: EmailType[] = [
  "candidate_result",
  "recruiter_notify",
  "both",
];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logStep(step: string, message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[send-email][${step}] ${message}`);
    return;
  }

  console.log(`[send-email][${step}] ${message}`, details);
}

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidEmailType(value: unknown): value is EmailType {
  return (
    typeof value === "string" && VALID_EMAIL_TYPES.includes(value as EmailType)
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isValidEmail(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function safeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPercent(value: unknown): number {
  const numeric = toNumber(value, 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getSkillScores(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function canFallbackToAssessmentLinks(message: string): boolean {
  const normalized = message.toLowerCase();
  return (normalized.includes("candidate_id") || normalized.includes("job_id")) &&
    (normalized.includes("results") || normalized.includes("schema cache") ||
      normalized.includes("column"));
}

function buildSkillRows(skillScores: unknown): string {
  const entries = Object.entries(getSkillScores(skillScores));

  if (entries.length === 0) {
    return `<tr><td colspan="3" style="padding:14px 12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;">No skill breakdown available.</td></tr>`;
  }

  return entries
    .map(([skill, rawValue]) => {
      const scoreData = isRecord(rawValue) ? rawValue : {};
      const score = toPercent(scoreData.score);
      const verified = scoreData.verified === true;
      const status = verified ? "Verified &#10003;" : "Needs Work";
      const statusColor = verified ? "#14B8A6" : "#64748B";

      return `<tr>
        <td style="padding:14px 12px;color:#F1F5F9;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;">${escapeHtml(skill)}</td>
        <td style="padding:14px 12px;color:#F1F5F9;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;text-align:center;">${score}%</td>
        <td style="padding:14px 12px;color:${statusColor};border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;text-align:right;font-weight:700;">${status}</td>
      </tr>`;
    })
    .join("");
}

function buildEmailShell(content: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0B0F14;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#0B0F14;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#141920;border-radius:8px;border:1px solid #253041;overflow:hidden;">
            ${content}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildHeader(): string {
  return `<tr>
    <td style="padding:28px 28px 18px 28px;border-bottom:1px solid #253041;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;line-height:1.2;font-weight:800;color:#F1F5F9;">Skill<span style="color:#6366F1;">Gate</span></div>
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:13px;line-height:1.6;color:#64748B;margin-top:4px;">AI-Powered Hiring</div>
    </td>
  </tr>`;
}

function buildFooter(): string {
  return `<tr>
    <td style="padding:22px 28px 28px 28px;border-top:1px solid #253041;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;line-height:1.6;color:#64748B;text-align:center;">Sent by SkillGate &middot; AI-Powered Pre-Screening</div>
    </td>
  </tr>`;
}

function validateFetchedData(data: FetchedData, payload: RequestPayload): void {
  if (!data.result.candidate_id || !isValidUuid(data.result.candidate_id)) {
    throw new Error("Result is missing a valid candidate_id");
  }

  if (!data.result.job_id || !isValidUuid(data.result.job_id)) {
    throw new Error("Result is missing a valid job_id");
  }

  if (!data.result.assessment_id || !isValidUuid(data.result.assessment_id)) {
    throw new Error("Result is missing a valid assessment_id");
  }

  if (data.result.assessment_id !== payload.assessmentId) {
    throw new Error("Result does not belong to the requested assessment");
  }

  if (!data.job.recruiter_id || !isValidUuid(data.job.recruiter_id)) {
    throw new Error("Job is missing a valid recruiter_id");
  }
}

async function validateRequest(req: Request): Promise<RequestPayload> {
  logStep("validate", "validating request payload");

  let body: unknown;
  try {
    body = await req.json();
  } catch (_error) {
    throw new Error("Malformed JSON request body");
  }

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object");
  }

  if (!("assessmentId" in body)) {
    throw new Error("assessmentId is required");
  }

  if (!("resultId" in body)) {
    throw new Error("resultId is required");
  }

  if (!("type" in body)) {
    throw new Error("type is required");
  }

  if (!isValidUuid(body.assessmentId)) {
    throw new Error("assessmentId must be a valid UUID");
  }

  if (!isValidUuid(body.resultId)) {
    throw new Error("resultId must be a valid UUID");
  }

  if (!isValidEmailType(body.type)) {
    throw new Error(
      "type must be candidate_result, recruiter_notify, or both",
    );
  }

  return {
    assessmentId: body.assessmentId,
    resultId: body.resultId,
    type: body.type,
  };
}

async function fetchData(
  supabase: SupabaseClient,
  payload: RequestPayload,
): Promise<FetchedData> {
  logStep("fetch", "fetching result row", { resultId: payload.resultId });

  let result: ResultRow | null = null;
  const { data: fullResult, error: resultError } = await supabase
    .from("results")
    .select(
      [
        "id",
        "overall_score",
        "passed",
        "skill_scores",
        "feedback_summary",
        "strengths",
        "weaknesses",
        "improvement_resources",
        "pdf_url",
        "email_sent",
        "hiring_signal",
        "candidate_id",
        "job_id",
        "assessment_id",
      ].join(","),
    )
    .eq("id", payload.resultId)
    .maybeSingle<ResultRow>();

  if (resultError) {
    if (!canFallbackToAssessmentLinks(resultError.message)) {
      throw new Error(resultError.message);
    }

    logStep(
      "fetch",
      "result link columns unavailable, falling back to assessment links",
    );

    const { data: fallbackResult, error: fallbackError } = await supabase
      .from("results")
      .select(
        [
          "id",
          "overall_score",
          "passed",
          "skill_scores",
          "feedback_summary",
          "strengths",
          "weaknesses",
          "improvement_resources",
          "pdf_url",
          "email_sent",
          "hiring_signal",
          "assessment_id",
        ].join(","),
      )
      .eq("id", payload.resultId)
      .maybeSingle<Omit<ResultRow, "candidate_id" | "job_id">>();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    result = fallbackResult
      ? { ...fallbackResult, candidate_id: null, job_id: null }
      : null;
  } else {
    result = fullResult;
  }

  if (!result) {
    throw new Error("Result not found");
  }

  if (result.email_sent === true) {
    logStep("idempotency", "result email already sent");
    return {
      result,
      candidate: { full_name: null, email: null },
      job: {
        title: null,
        min_score_threshold: null,
        recruiter_id: null,
      },
      profile: {
        full_name: null,
        email: null,
        company_name: null,
        notify_on_every_completion: null,
        notify_on_pass_only: null,
      },
    };
  }

  if (!result.candidate_id || !result.job_id) {
    const assessmentId = safeText(result.assessment_id, payload.assessmentId);
    logStep("fetch", "hydrating candidate/job ids from assessment", {
      assessmentId,
    });

    const { data: assessmentLink, error: assessmentLinkError } = await supabase
      .from("assessments")
      .select("candidate_id,job_id")
      .eq("id", assessmentId)
      .maybeSingle<AssessmentLinkRow>();

    if (assessmentLinkError) {
      throw new Error(assessmentLinkError.message);
    }

    if (!assessmentLink?.candidate_id || !assessmentLink.job_id) {
      throw new Error("Result is missing candidate_id or job_id");
    }

    result = {
      ...result,
      assessment_id: assessmentId,
      candidate_id: assessmentLink.candidate_id,
      job_id: assessmentLink.job_id,
    };
  }

  logStep("fetch", "fetching candidate row", {
    candidateId: result.candidate_id,
  });

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("full_name,email")
    .eq("id", result.candidate_id)
    .maybeSingle<CandidateRow>();

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  if (!candidate) {
    throw new Error("Candidate not found");
  }

  logStep("fetch", "fetching job row", { jobId: result.job_id });

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("title,min_score_threshold,recruiter_id")
    .eq("id", result.job_id)
    .maybeSingle<JobRow>();

  if (jobError) {
    throw new Error(jobError.message);
  }

  if (!job) {
    throw new Error("Job not found");
  }

  if (!job.recruiter_id) {
    throw new Error("Job is missing recruiter_id");
  }

  logStep("fetch", "fetching recruiter profile row", {
    recruiterId: job.recruiter_id,
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "full_name,email,company_name,notify_on_every_completion,notify_on_pass_only",
    )
    .eq("id", job.recruiter_id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("Recruiter profile not found");
  }

  const fetchedData = { result, candidate, job, profile };
  validateFetchedData(fetchedData, payload);

  return fetchedData;
}

function buildCandidateEmail(data: FetchedData): EmailContent {
  logStep("build-candidate", "building candidate email");

  const candidateName = safeText(data.candidate.full_name, "there");
  const jobTitle = safeText(data.job.title, "your role");
  const passed = data.result.passed === true;
  const overallScore = toPercent(data.result.overall_score);
  const subject = passed
    ? `You passed the ${jobTitle} assessment — SkillGate`
    : `Your ${jobTitle} assessment results — SkillGate`;
  const bannerColor = passed ? "#14B8A6" : "#EF4444";
  const bannerTitle = passed
    ? "Congratulations — You Passed"
    : "Assessment Complete";
  const finalMessage = passed
    ? "Our team will be in touch if your profile matches the next steps."
    : "Keep building — every assessment is a step forward.<br>Review the skill breakdown above and focus on your weakest areas.";
  const feedback = safeText(
    data.result.feedback_summary,
    "Thank you for completing the assessment.",
  );
  const pdfUrl = safeText(data.result.pdf_url);
  const pdfSection = pdfUrl.length > 0
    ? `<tr>
        <td style="padding:0 28px 24px 28px;">
          <a href="${escapeAttr(pdfUrl)}" style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#14B8A6;font-size:15px;line-height:1.6;font-weight:700;text-decoration:none;">Download your full report &rarr;</a>
        </td>
      </tr>`
    : "";

  const content = `${buildHeader()}
  <tr>
    <td style="padding:28px 28px 16px 28px;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;line-height:1.6;color:#F1F5F9;">Hi ${escapeHtml(candidateName)},</div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <div style="border-left:4px solid ${bannerColor};background:#0B0F14;border-radius:8px;padding:18px 18px;">
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;line-height:1.4;font-weight:800;color:#F1F5F9;">${bannerTitle}</div>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:4px 28px 28px 28px;text-align:center;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:56px;line-height:1;font-weight:800;color:${passed ? "#22C55E" : "#EF4444"};">${overallScore}%</div>
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:13px;line-height:1.8;color:#64748B;margin-top:8px;">Overall Score</div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#0B0F14;border-radius:8px;overflow:hidden;">
        <tr>
          <th align="left" style="padding:12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;text-transform:uppercase;">Skill</th>
          <th align="center" style="padding:12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;text-transform:uppercase;">Score</th>
          <th align="right" style="padding:12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;text-transform:uppercase;">Status</th>
        </tr>
        ${buildSkillRows(data.result.skill_scores)}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1.7;color:#F1F5F9;background:#0B0F14;border-radius:8px;padding:18px;">${escapeHtml(feedback)}</div>
    </td>
  </tr>
  ${pdfSection}
  <tr>
    <td style="padding:0 28px 28px 28px;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1.7;color:#F1F5F9;">${finalMessage}</div>
    </td>
  </tr>
  ${buildFooter()}`;

  return {
    subject,
    html: buildEmailShell(content),
  };
}

function buildRecruiterEmail(data: FetchedData): EmailContent {
  logStep("build-recruiter", "building recruiter email");

  const candidateName = safeText(data.candidate.full_name, "Candidate");
  const jobTitle = safeText(data.job.title, "the role");
  const overallScore = toPercent(data.result.overall_score);
  const threshold = toPercent(data.job.min_score_threshold);
  const hiringSignal = safeText(data.result.hiring_signal, "Not available");
  const subject = `New qualified candidate for ${jobTitle} — SkillGate`;

  const content = `${buildHeader()}
  <tr>
    <td style="padding:28px 28px 20px 28px;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;line-height:1.6;color:#F1F5F9;">A candidate has passed the pre-screening for ${escapeHtml(jobTitle)}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <div style="background:#0B0F14;border-radius:8px;border-left:4px solid #14B8A6;padding:18px;">
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:13px;line-height:1.6;color:#64748B;">Name</div>
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;line-height:1.4;color:#F1F5F9;font-weight:800;margin-bottom:12px;">${escapeHtml(candidateName)}</div>
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:13px;line-height:1.6;color:#64748B;">Score</div>
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;line-height:1.2;color:#22C55E;font-weight:800;margin-bottom:12px;">${overallScore}%</div>
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1.7;color:#F1F5F9;"><strong>Hiring Signal:</strong> ${escapeHtml(hiringSignal)}</div>
        <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1.7;color:#F1F5F9;">Above ${threshold}% threshold</div>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#0B0F14;border-radius:8px;overflow:hidden;">
        <tr>
          <th align="left" style="padding:12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;text-transform:uppercase;">Skill</th>
          <th align="center" style="padding:12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;text-transform:uppercase;">Score</th>
          <th align="right" style="padding:12px;color:#64748B;border-bottom:1px solid #253041;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;text-transform:uppercase;">Status</th>
        </tr>
        ${buildSkillRows(data.result.skill_scores)}
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:2px 28px 30px 28px;">
      <a href="${DASHBOARD_URL}" style="display:inline-block;background:#6366F1;color:#FFFFFF;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1;font-weight:800;text-decoration:none;border-radius:8px;padding:15px 22px;">View in Dashboard &rarr;</a>
    </td>
  </tr>
  ${buildFooter()}`;

  return {
    subject,
    html: buildEmailShell(content),
  };
}

async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  logStep("send", "sending email", { to: payload.to, subject: payload.subject });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return {
      success: false,
      error: "RESEND_API_KEY is not configured",
    };
  }

  if (!isValidEmail(payload.to)) {
    return {
      success: false,
      statusCode: 400,
      error: "Invalid recipient email",
    };
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to.trim(),
        subject: payload.subject,
        html: payload.html,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let responseBody: unknown = null;
    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      responseBody = null;
    }

    if (response.ok) {
      const providerMessageId = isRecord(responseBody) &&
          typeof responseBody.id === "string"
        ? responseBody.id
        : undefined;

      return {
        success: true,
        providerMessageId,
        statusCode: response.status,
      };
    }

    const errorMessage = isRecord(responseBody) &&
        typeof responseBody.message === "string"
      ? responseBody.message
      : responseText || `Resend returned HTTP ${response.status}`;

    return {
      success: false,
      statusCode: response.status,
      error: errorMessage,
    };
  } catch (error) {
    return {
      success: false,
      error: didTimeout
        ? "timeout"
        : `network_error: ${
          error instanceof Error ? error.message : String(error)
        }`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetryableSendResult(result: EmailSendResult): boolean {
  if (result.success) {
    return false;
  }

  if (result.statusCode === 429) {
    return true;
  }

  if (
    typeof result.statusCode === "number" &&
    result.statusCode >= 500 &&
    result.statusCode <= 599
  ) {
    return true;
  }

  return result.error === "timeout" ||
    (typeof result.error === "string" &&
      result.error.startsWith("network_error:"));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retrySend(
  sendFn: () => Promise<EmailSendResult>,
): Promise<EmailSendResult> {
  const firstResult = await sendFn();

  if (!isRetryableSendResult(firstResult)) {
    return firstResult;
  }

  logStep("retry", "retryable email failure, waiting 2000ms before one retry", {
    statusCode: firstResult.statusCode,
    error: firstResult.error,
  });

  await delay(2000);
  return await sendFn();
}

async function insertNotification(
  supabase: SupabaseClient,
  data: FetchedData,
  kind: NotificationKind,
): Promise<void> {
  logStep("notification", `inserting ${kind} notification`);

  const candidateName = safeText(data.candidate.full_name, "Candidate");
  const isSuccess = kind === "success";
  const { error } = await supabase
    .from("notifications")
    .insert({
      recruiter_id: data.job.recruiter_id,
      candidate_id: data.result.candidate_id,
      job_id: data.result.job_id,
      assessment_id: data.result.assessment_id,
      type: isSuccess ? "email_sent" : "email_failed",
      title: isSuccess
        ? "Email sent successfully"
        : "Email delivery failed",
      message: isSuccess
        ? `${candidateName}'s assessment email was delivered.`
        : `Failed to send results email to ${candidateName}. Manual action may be needed.`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[send-email][notification] insert failed", error);
  }
}

async function updateResultStatus(
  supabase: SupabaseClient,
  resultId: string,
): Promise<void> {
  logStep("update-result", "marking result email_sent true", { resultId });

  const { error } = await supabase
    .from("results")
    .update({
      email_sent: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resultId);

  if (error) {
    throw new Error(error.message);
  }
}

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    logStep("start", "request received");

    const payload = await validateRequest(req);
    const supabase = createSupabaseClient();
    const data = await fetchData(supabase, payload);

    if (data.result.email_sent === true) {
      return jsonResponse({ status: "already_sent" }, 200);
    }

    const sendCandidate =
      payload.type === "candidate_result" || payload.type === "both";

    const recruiterAllowsSend =
      data.profile.notify_on_every_completion === true ||
      (data.profile.notify_on_pass_only === true &&
        data.result.passed === true);

    const recruiterEmailExists = safeText(data.profile.email).length > 0;
    const sendRecruiter =
      (payload.type === "recruiter_notify" || payload.type === "both") &&
      recruiterAllowsSend &&
      recruiterEmailExists;

    logStep("decision", "calculated send targets", {
      sendCandidate,
      recruiterAllowsSend,
      recruiterEmailExists,
      sendRecruiter,
    });

    let candidateSent = false;
    let recruiterSent = false;
    const failedTargets: SendTarget[] = [];
    const providerMessageIds: string[] = [];

    if (sendCandidate) {
      const candidateEmail = safeText(data.candidate.email);

      if (!isValidEmail(candidateEmail)) {
        logStep("candidate", "candidate email is missing or invalid");
        failedTargets.push("candidate");
      } else {
        const email = buildCandidateEmail(data);
        const result = await retrySend(() =>
          sendEmail({
            to: candidateEmail,
            subject: email.subject,
            html: email.html,
          })
        );

        candidateSent = result.success;

        if (result.providerMessageId) {
          providerMessageIds.push(result.providerMessageId);
        }

        if (!result.success) {
          failedTargets.push("candidate");
          console.error("[send-email][candidate] send failed", result);
        }
      }
    }

    if (
      (payload.type === "recruiter_notify" || payload.type === "both") &&
      !recruiterAllowsSend
    ) {
      logStep("recruiter", "recruiter preferences do not allow send");
    }

    if (
      (payload.type === "recruiter_notify" || payload.type === "both") &&
      recruiterAllowsSend &&
      !recruiterEmailExists
    ) {
      logStep("recruiter", "recruiter email missing, skipping send");
    }

    if (sendRecruiter) {
      const recruiterEmail = safeText(data.profile.email);

      if (!isValidEmail(recruiterEmail)) {
        logStep("recruiter", "recruiter email is invalid");
        failedTargets.push("recruiter");
      } else {
        const email = buildRecruiterEmail(data);
        const result = await retrySend(() =>
          sendEmail({
            to: recruiterEmail,
            subject: email.subject,
            html: email.html,
          })
        );

        recruiterSent = result.success;

        if (result.providerMessageId) {
          providerMessageIds.push(result.providerMessageId);
        }

        if (!result.success) {
          failedTargets.push("recruiter");
          console.error("[send-email][recruiter] send failed", result);
        }
      }
    }

    logStep("provider", "resend message ids collected for logging only", {
      providerMessageIds,
    });

    if (failedTargets.length === 0) {
      await updateResultStatus(supabase, payload.resultId);
      await insertNotification(supabase, data, "success");
      logStep("complete", "all eligible emails sent successfully");

      return jsonResponse({
        status: "sent",
        candidateSent,
        recruiterSent,
      }, 200);
    }

    await insertNotification(supabase, data, "failure");
    logStep("complete", "email sending completed with failures", {
      failedTargets,
    });

    return jsonResponse({
      status: "partial",
      candidateSent,
      recruiterSent,
      failedTargets,
    }, 207);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-email][error]", message);

    const isValidationError =
      message.includes("required") ||
      message.includes("valid UUID") ||
      message.includes("Malformed JSON") ||
      message.includes("Request body") ||
      message.includes("type must be");

    return jsonResponse(
      { error: message },
      isValidationError ? 400 : 500,
    );
  }
});
