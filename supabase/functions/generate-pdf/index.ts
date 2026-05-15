import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface RequestPayload {
  assessmentId: string;
  resultId: string;
}

interface ResultRow {
  id: string;
  assessment_id: string;
  overall_score: number;
  passed: boolean;
  confidence_score: number | null;
  confidence_label: string | null;
  skill_scores: Record<string, unknown> | null;
  feedback_summary: string | null;
  improvement_resources: unknown[] | null;
  strengths: unknown[] | null;
  weaknesses: unknown[] | null;
  training_plan: unknown | null;
  pdf_status: string | null;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  pdf_error: string | null;
  hiring_signal: string | null;
  executive_summary: string | null;
}

interface CandidateRow {
  full_name: string | null;
  email: string | null;
}

interface JobRow {
  title: string | null;
  company_name: string | null;
  min_score_threshold: number | null;
}

interface AssessmentRow {
  submitted_at: string | null;
  time_taken_seconds: number | null;
  candidate_id: string;
  job_id: string;
}

interface FetchedData {
  result: ResultRow;
  candidate: CandidateRow;
  job: JobRow;
  assessment: AssessmentRow;
}

type SupabaseClient = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;
type ResultQueryRow = ResultRow & {
  time_taken_seconds: number | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const PDFSHIFT_ENDPOINT = "https://api.pdfshift.io/v3/convert/pdf";
const STORAGE_BUCKET = "reports";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logStep(step: string, message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[generate-pdf][${step}] ${message}`);
    return;
  }

  console.log(`[generate-pdf][${step}] ${message}`, details);
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

function toNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPercent(value: unknown): number {
  return Math.max(0, Math.min(100, Math.round(toNumber(value, 0))));
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function normalizeTextItems(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) {
    return [fallback];
  }

  const items = value
    .map((item: unknown): string => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (isRecord(item)) {
        const parts = [
          safeText(item.skill),
          safeText(item.topic),
          safeText(item.suggestion),
          safeText(item.description),
          safeText(item.title),
        ].filter((part: string) => part.length > 0);

        return parts.join(" - ");
      }

      return "";
    })
    .filter((item: string) => item.length > 0)
    .slice(0, 6);

  return items.length > 0 ? items : [fallback];
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: unknown): string {
  const totalSeconds = Math.max(0, Math.round(toNumber(seconds, 0)));
  if (totalSeconds === 0) {
    return "Not available";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  if (minutes === 0) {
    return `${remainder}s`;
  }

  return `${minutes}m ${remainder}s`;
}

async function validateRequest(req: Request): Promise<RequestPayload> {
  if (req.method !== "POST") {
    throw new Error("Method not allowed");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_error) {
    throw new Error("Malformed JSON request body");
  }

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object");
  }

  if (!isValidUuid(body.assessmentId)) {
    throw new Error("assessmentId must be a valid UUID");
  }

  if (!isValidUuid(body.resultId)) {
    throw new Error("resultId must be a valid UUID");
  }

  return {
    assessmentId: body.assessmentId,
    resultId: body.resultId,
  };
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

async function acquireGenerationLock(
  supabase: SupabaseClient,
  payload: RequestPayload,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("results")
    .update({
      pdf_status: "generating",
      pdf_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.resultId)
    .or("pdf_status.is.null,pdf_status.in.(pending,failed)")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    logStep("start", "PDF generation already in progress", {
      resultId: payload.resultId,
      assessmentId: payload.assessmentId,
    });
    return false;
  }

  return true;
}

async function fetchData(
  supabase: SupabaseClient,
  payload: RequestPayload,
): Promise<FetchedData> {
  logStep("fetch", "fetching result", {
    resultId: payload.resultId,
    assessmentId: payload.assessmentId,
  });

  const { data: result, error: resultError } = await supabase
    .from("results")
    .select(
      [
        "id",
        "assessment_id",
        "overall_score",
        "passed",
        "confidence_score",
        "confidence_label",
        "skill_scores",
        "feedback_summary",
        "improvement_resources",
        "strengths",
        "weaknesses",
        "training_plan",
        "pdf_status",
        "pdf_storage_path",
        "pdf_generated_at",
        "pdf_error",
        "hiring_signal",
        "executive_summary",
        "time_taken_seconds",
      ].join(","),
    )
    .eq("id", payload.resultId)
    .maybeSingle<ResultQueryRow>();

  if (resultError) {
    throw new Error(resultError.message);
  }

  if (!result) {
    throw new Error("Result not found");
  }

  if (result.assessment_id !== payload.assessmentId) {
    throw new Error("Result does not belong to the requested assessment");
  }

  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select("submitted_at,candidate_id,job_id")
    .eq("id", payload.assessmentId)
    .maybeSingle<Omit<AssessmentRow, "time_taken_seconds">>();

  if (assessmentError) {
    throw new Error(assessmentError.message);
  }

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("full_name,email")
    .eq("id", assessment.candidate_id)
    .maybeSingle<CandidateRow>();

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  if (!candidate) {
    throw new Error("Candidate not found");
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("title,company_name,min_score_threshold")
    .eq("id", assessment.job_id)
    .maybeSingle<JobRow>();

  if (jobError) {
    throw new Error(jobError.message);
  }

  if (!job) {
    throw new Error("Job not found");
  }

  return {
    result,
    candidate,
    job,
    assessment: {
      ...assessment,
      time_taken_seconds: result.time_taken_seconds,
    },
  };
}

function buildSkillRows(skillScores: unknown): string {
  const entries = isRecord(skillScores) ? Object.entries(skillScores) : [];

  if (entries.length === 0) {
    return `<tr><td colspan="4" class="empty">No skill breakdown available.</td></tr>`;
  }

  return entries
    .map(([skill, rawValue]: [string, unknown]) => {
      const scoreData = isRecord(rawValue) ? rawValue : {};
      const score = toPercent(scoreData.score);
      const earned = toNumber(scoreData.earned, 0);
      const possible = toNumber(scoreData.possible, 0);
      const verified = scoreData.verified === true;
      const status = verified ? "Verified" : "Needs practice";

      return `<tr>
        <td>${escapeHtml(skill)}</td>
        <td><strong>${score}%</strong></td>
        <td>${escapeHtml(`${earned}/${possible}`)}</td>
        <td><span class="pill ${verified ? "good" : "muted"}">${status}</span></td>
      </tr>`;
    })
    .join("");
}

function buildList(title: string, items: string[], emptyLabel: string): string {
  const safeItems = items.length > 0 ? items : [emptyLabel];

  return `<section class="section">
    <h2>${escapeHtml(title)}</h2>
    <ul class="clean-list">
      ${safeItems.map((item: string) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  </section>`;
}

function buildTrainingPlanTeaser(value: unknown): string {
  const teaserItems = normalizeTextItems(
    value,
    "A focused training plan will appear here as more assessment data becomes available.",
  ).slice(0, 4);

  return `<section class="section highlight">
    <div>
      <p class="eyebrow">Training Plan</p>
      <h2>Suggested Next Steps</h2>
    </div>
    <ul class="clean-list">
      ${teaserItems.map((item: string) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  </section>`;
}

function buildHtmlReport(data: FetchedData): string {
  logStep("html", "building report html", {
    resultId: data.result.id,
    assessmentId: data.result.assessment_id,
    candidateId: data.assessment.candidate_id,
  });

  const candidateName = safeText(data.candidate.full_name, "Candidate");
  const jobTitle = safeText(data.job.title, "Assessment");
  const companyName = safeText(data.job.company_name, "SkillGate");
  const overallScore = toPercent(data.result.overall_score);
  const threshold = toPercent(data.job.min_score_threshold);
  const confidenceScore = toPercent(data.result.confidence_score);
  const confidenceLabel = safeText(data.result.confidence_label, "Not available");
  const hiringSignal = safeText(data.result.hiring_signal, "Not available");
  const feedback = safeText(
    data.result.feedback_summary,
    "Thank you for completing the assessment. Your results have been recorded.",
  );
  const executiveSummary = safeText(
    data.result.executive_summary,
    "This report summarizes the candidate's assessment performance and skill coverage.",
  );
  const resultLabel = data.result.passed ? "Passed" : "Completed";
  const statusClass = data.result.passed ? "pass" : "review";
  const strengths = normalizeTextItems(
    data.result.strengths,
    "No specific strengths were identified in the generated summary.",
  );
  const weaknesses = normalizeTextItems(
    data.result.weaknesses,
    "No specific improvement areas were identified in the generated summary.",
  );
  const resources = normalizeTextItems(
    data.result.improvement_resources,
    "Review the skills with the lowest scores and practice with targeted exercises.",
  );

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #FFFFFF;
        color: #0F172A;
        font-family: 'Plus Jakarta Sans', Arial, sans-serif;
        font-size: 13px;
        line-height: 1.55;
      }
      .page {
        width: 100%;
        max-width: 760px;
        margin: 0 auto;
      }
      .header {
        display: table;
        width: 100%;
        border-bottom: 1px solid #E2E8F0;
        padding: 0 0 18px 0;
      }
      .brand, .meta {
        display: table-cell;
        vertical-align: top;
      }
      .brand-name {
        font-size: 25px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: 0;
      }
      .brand-name span { color: #6366F1; }
      .subtitle {
        margin-top: 6px;
        color: #475569;
        font-size: 12px;
      }
      .meta {
        text-align: right;
        color: #475569;
        font-family: 'DM Mono', monospace;
        font-size: 11px;
      }
      .hero {
        margin: 24px 0 20px 0;
        padding: 24px;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        background: #F8FAFC;
      }
      .hero h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.18;
        letter-spacing: 0;
      }
      .hero p {
        margin: 8px 0 0 0;
        color: #475569;
        font-size: 14px;
      }
      .metrics {
        display: table;
        width: 100%;
        margin-top: 22px;
        table-layout: fixed;
      }
      .metric {
        display: table-cell;
        padding: 14px;
        border: 1px solid #E2E8F0;
        background: #FFFFFF;
      }
      .metric:first-child { border-radius: 8px 0 0 8px; }
      .metric:last-child { border-radius: 0 8px 8px 0; }
      .metric-label {
        color: #475569;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: .06em;
      }
      .metric-value {
        margin-top: 6px;
        color: #0F172A;
        font-size: 20px;
        font-weight: 800;
      }
      .pass { color: #14B8A6; }
      .review { color: #6366F1; }
      .section {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid #E2E8F0;
        page-break-inside: avoid;
      }
      .section h2 {
        margin: 0 0 10px 0;
        font-size: 17px;
        line-height: 1.3;
        letter-spacing: 0;
      }
      .summary {
        color: #334155;
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 16px;
      }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        overflow: hidden;
      }
      th {
        text-align: left;
        padding: 10px 12px;
        color: #475569;
        background: #F8FAFC;
        border-bottom: 1px solid #E2E8F0;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: .06em;
      }
      td {
        padding: 12px;
        border-bottom: 1px solid #E2E8F0;
        color: #0F172A;
      }
      tr:last-child td { border-bottom: 0; }
      .pill {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
      }
      .pill.good {
        color: #0F766E;
        background: #CCFBF1;
      }
      .pill.muted {
        color: #475569;
        background: #E2E8F0;
      }
      .empty {
        color: #475569;
        text-align: center;
      }
      .clean-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .clean-list li {
        margin: 0 0 8px 0;
        padding: 10px 12px;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        color: #334155;
        background: #FFFFFF;
      }
      .highlight {
        padding: 18px;
        border: 1px solid #C7D2FE;
        border-radius: 8px;
        background: #EEF2FF;
      }
      .highlight .clean-list li {
        border-color: #C7D2FE;
        background: #FFFFFF;
      }
      .eyebrow {
        margin: 0 0 4px 0;
        color: #6366F1;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: .08em;
      }
      .footer {
        margin-top: 24px;
        padding-top: 14px;
        border-top: 1px solid #E2E8F0;
        color: #475569;
        font-size: 11px;
        text-align: center;
      }
      @page {
        size: A4;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <div class="brand">
          <div class="brand-name">Skill<span>Gate</span></div>
          <div class="subtitle">AI-powered hiring assessment report</div>
        </div>
        <div class="meta">
          <div>Assessment: ${escapeHtml(data.result.assessment_id)}</div>
          <div>Submitted: ${escapeHtml(formatDate(data.assessment.submitted_at))}</div>
        </div>
      </header>

      <section class="hero">
        <h1>${escapeHtml(candidateName)} - ${escapeHtml(jobTitle)}</h1>
        <p>${escapeHtml(companyName)} candidate assessment report with score breakdown, feedback, and recommended next steps.</p>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Overall Score</div>
            <div class="metric-value ${statusClass}">${overallScore}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Result</div>
            <div class="metric-value ${statusClass}">${escapeHtml(resultLabel)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Threshold</div>
            <div class="metric-value">${threshold}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Time</div>
            <div class="metric-value">${escapeHtml(formatDuration(data.assessment.time_taken_seconds))}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Skill Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Score</th>
              <th>Points</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${buildSkillRows(data.result.skill_scores)}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Feedback Summary</h2>
        <div class="summary">
          <p>${escapeHtml(feedback)}</p>
          <p><strong>Recruiter summary:</strong> ${escapeHtml(executiveSummary)}</p>
          <p><strong>Hiring signal:</strong> ${escapeHtml(hiringSignal)} &nbsp; <strong>Confidence:</strong> ${confidenceScore}% (${escapeHtml(confidenceLabel)})</p>
        </div>
      </section>

      ${buildList("Strengths", strengths, "No strengths available.")}
      ${buildList("Areas to Improve", weaknesses, "No improvement areas available.")}
      ${buildList("Recommended Resources", resources, "No recommended resources available.")}
      ${buildTrainingPlanTeaser(data.result.training_plan)}

      <footer class="footer">
        Sent by SkillGate. Signed download links are generated dynamically and expire automatically.
      </footer>
    </main>
  </body>
</html>`;
}

async function generatePdf(html: string): Promise<Uint8Array> {
  const pdfshiftApiKey = Deno.env.get("PDFSHIFT_API_KEY");
  if (!pdfshiftApiKey) {
    throw new Error("PDFSHIFT_API_KEY is not configured");
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, 30000);

  try {
    logStep("pdf", "calling PDFShift");

    const response = await fetch(PDFSHIFT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${pdfshiftApiKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: html,
        format: "A4",
        landscape: false,
        use_print: false,
        margin: {
          top: "20mm",
          bottom: "20mm",
          left: "15mm",
          right: "15mm",
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        responseText ||
          `PDFShift returned HTTP ${response.status}`,
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (didTimeout) {
      throw new Error("PDFShift request timed out");
    }

    throw new Error(
      `PDFShift request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function uploadPdf(
  supabase: SupabaseClient,
  data: FetchedData,
  pdfBytes: Uint8Array,
): Promise<string> {
  const storagePath = `${data.assessment.candidate_id}/${data.result.assessment_id}.pdf`;

  logStep("storage", "uploading PDF", {
    resultId: data.result.id,
    assessmentId: data.result.assessment_id,
    candidateId: data.assessment.candidate_id,
    storagePath,
  });

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

async function markPdfGenerated(
  supabase: SupabaseClient,
  resultId: string,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase
    .from("results")
    .update({
      pdf_status: "generated",
      pdf_storage_path: storagePath,
      pdf_generated_at: new Date().toISOString(),
      pdf_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resultId);

  if (error) {
    throw new Error(error.message);
  }
}

async function markPdfFailed(
  supabase: SupabaseClient,
  resultId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  const { error: updateError } = await supabase
    .from("results")
    .update({
      pdf_status: "failed",
      pdf_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resultId);

  if (updateError) {
    console.error("[generate-pdf][error] failed to persist PDF failure", {
      resultId,
      error: updateError.message,
    });
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let supabase: SupabaseClient | null = null;
  let payload: RequestPayload | null = null;
  let lockAcquired = false;

  try {
    payload = await validateRequest(req);
    logStep("start", "request received", payload);

    supabase = createSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from("results")
      .select("id,pdf_status,pdf_storage_path")
      .eq("id", payload.resultId)
      .maybeSingle<{
        id: string;
        pdf_status: string | null;
        pdf_storage_path: string | null;
      }>();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (!existing) {
      throw new Error("Result not found");
    }

    if (existing.pdf_status === "generated" && existing.pdf_storage_path) {
      logStep("complete", "PDF already generated", payload);
      return jsonResponse({ status: "already_generated" }, 200);
    }

    lockAcquired = await acquireGenerationLock(supabase, payload);
    if (!lockAcquired) {
      return jsonResponse({ status: "already_processing" }, 200);
    }

    const data = await fetchData(supabase, payload);
    const html = buildHtmlReport(data);
    const pdf = await generatePdf(html);
    const storagePath = await uploadPdf(supabase, data, pdf);

    await markPdfGenerated(supabase, payload.resultId, storagePath);

    logStep("complete", "PDF generated successfully", {
      resultId: payload.resultId,
      assessmentId: payload.assessmentId,
      candidateId: data.assessment.candidate_id,
      storagePath,
    });

    return jsonResponse({
      status: "generated",
      storagePath,
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-pdf][error]", message);

    if (supabase && payload?.resultId && lockAcquired) {
      await markPdfFailed(supabase, payload.resultId, error);
    }

    const isValidationError =
      message.includes("valid UUID") ||
      message.includes("Malformed JSON") ||
      message.includes("Request body") ||
      message.includes("Method not allowed");

    return jsonResponse(
      { status: "failed", error: message },
      isValidationError ? 400 : 500,
    );
  }
});
