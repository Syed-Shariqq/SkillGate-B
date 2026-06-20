import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;

type RequestPayload = {
  userId: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  email_verified: boolean | null;
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FROM_EMAIL = "onboarding@resend.dev";
const SITE_URL = Deno.env.get("SITE_URL") || "https://skill-gate-b.vercel.app";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logStep(step: string, message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[send-verification-email][${step}] ${message}`);
    return;
  }

  console.log(`[send-verification-email][${step}] ${message}`, details);
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

async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  logStep("send", "sending email", {
    to: payload.to,
    subject: payload.subject,
  });

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
      const providerMessageId =
        isRecord(responseBody) && typeof responseBody.id === "string"
          ? responseBody.id
          : undefined;

      return {
        success: true,
        providerMessageId,
        statusCode: response.status,
      };
    }

    const errorMessage =
      isRecord(responseBody) && typeof responseBody.message === "string"
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

  return (
    result.error === "timeout" ||
    (typeof result.error === "string" &&
      result.error.startsWith("network_error:"))
  );
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

function buildVerificationEmail(
  fullName: string,
  verificationLink: string,
): { subject: string; html: string } {
  const userGreetingName = safeText(fullName, "there");
  const subject = "Verify your email — SkillGate";

  const content = `${buildHeader()}
  <tr>
    <td style="padding:28px 28px 16px 28px;">
      <div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;line-height:1.6;color:#F1F5F9;">Hi ${escapeHtml(userGreetingName)},</div>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 24px 28px;">
      <div style="background:#0B0F14;border-radius:8px;border-left:4px solid #6366F1;padding:18px;">
        <p style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1.7;color:#E2E8F0;margin:0 0 12px 0;">
          Thank you for joining SkillGate. Please confirm your account email address by clicking the button below.
        </p>
      </div>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:2px 28px 30px 28px;">
      <a href="${escapeAttr(verificationLink)}" style="display:inline-block;background:#6366F1;color:#FFFFFF;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:15px;line-height:1;font-weight:800;text-decoration:none;border-radius:8px;padding:15px 22px;">Verify Email &rarr;</a>
    </td>
  </tr>
  ${buildFooter()}`;

  return {
    subject,
    html: buildEmailShell(content),
  };
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

    // 1. Validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (_error) {
      return jsonResponse({ error: "Malformed JSON request body" }, 400);
    }

    if (!isRecord(body) || !("userId" in body)) {
      return jsonResponse({ error: "userId is required" }, 400);
    }

    const { userId } = body;
    if (!isValidUuid(userId)) {
      return jsonResponse({ error: "userId must be a valid UUID" }, 400);
    }

    // 2. Create Supabase client
    const supabase = createSupabaseClient();

    // 3. Fetch profile
    logStep("fetch-profile", "fetching profile for userId", { userId });
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_verified")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (fetchError) {
      logStep("fetch-profile-error", "error fetching profile", fetchError);
      return jsonResponse(
        { error: "Failed to fetch profile", details: fetchError.message },
        500,
      );
    }

    if (!profile) {
      logStep("fetch-profile-error", "profile not found");
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    // 4. Check if already verified
    if (profile.email_verified === true) {
      logStep("idempotency", "profile email is already verified");
      return jsonResponse({ status: "already_verified" }, 200);
    }

    const userEmail = safeText(profile.email);
    if (!isValidEmail(userEmail)) {
      logStep("validate-email", "invalid or missing profile email address");
      return jsonResponse(
        { error: "Profile email address is invalid or missing" },
        400,
      );
    }

    // 5. Generate token
    const token = crypto.randomUUID();

    // 6. Update profile with verification token and timestamp
    logStep("update-profile", "updating profile with email_verification_token");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        email_verification_token: token,
        email_verification_sent_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      logStep("update-profile-error", "error updating profile", updateError);
      return jsonResponse(
        {
          error: "Failed to update profile verification status",
          details: updateError.message,
        },
        500,
      );
    }

    // 7. Build verification link & email HTML
    const verificationLink = `${SITE_URL}/verify-email/confirm?token=${token}`;
    const emailContent = buildVerificationEmail(
      profile.full_name || "",
      verificationLink,
    );

    // 8. Send verification email via sendEmail() wrapped in retrySend()
    const result = await retrySend(() =>
      sendEmail({
        to: userEmail,
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    );

    if (!result.success) {
      logStep("send-email-error", "email sending failed", result);
      return jsonResponse(
        { error: "Failed to send email", details: result.error },
        500,
      );
    }

    logStep("success", "verification email sent successfully");
    return jsonResponse({ status: "sent" }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-verification-email][error]", message);
    return jsonResponse({ error: message }, 500);
  }
});
