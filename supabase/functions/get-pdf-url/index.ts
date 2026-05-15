import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const STORAGE_BUCKET = "reports";
const SIGNED_URL_EXPIRY_SECONDS = 172800;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function validateRequest(req: Request): Promise<{ resultId: string }> {
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

  if (!isValidUuid(body.resultId)) {
    throw new Error("resultId must be a valid UUID");
  }

  return { resultId: body.resultId };
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
    const payload = await validateRequest(req);
    const supabase = createSupabaseClient();

    const { data: result, error: resultError } = await supabase
      .from("results")
      .select("pdf_status,pdf_storage_path")
      .eq("id", payload.resultId)
      .maybeSingle<{
        pdf_status: string | null;
        pdf_storage_path: string | null;
      }>();

    if (resultError) {
      throw new Error(resultError.message);
    }

    if (!result) {
      return jsonResponse({ error: "Result not found" }, 404);
    }

    const status = result.pdf_status ?? "pending";

    if (status !== "generated") {
      return jsonResponse({ status }, 200);
    }

    if (!result.pdf_storage_path) {
      return jsonResponse({
        status: "failed",
        error: "PDF storage path is missing",
      }, 500);
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(
          result.pdf_storage_path,
          SIGNED_URL_EXPIRY_SECONDS,
        );

    if (signedUrlError) {
      throw new Error(signedUrlError.message);
    }

    return jsonResponse({
      status,
      signedUrl: signedUrlData.signedUrl,
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[get-pdf-url][error]", message);

    const isValidationError =
      message.includes("valid UUID") ||
      message.includes("Malformed JSON") ||
      message.includes("Request body") ||
      message.includes("Method not allowed");

    return jsonResponse(
      { error: message },
      isValidationError ? 400 : 500,
    );
  }
});
