import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type JsonRecord = Record<string, unknown>;

const sensitiveKeyPattern =
  /(^|_|\b)(answer|answers|answer_given|correct_answer|ideal_answer|sessiontoken|session_token|token|authorization|secret|apikey|api_key|password)(_|$|\b)/i;

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service client is not configured");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function formatSuccess(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

export function formatError(
  code: string,
  message: string,
  status: number,
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
      },
    }),
    {
      status,
      headers: jsonHeaders,
    },
  );
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[MaxDepth]";

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const output: JsonRecord = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (sensitiveKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }

      output[key] = sanitizeForLog(nestedValue, depth + 1);
    }

    return output;
  }

  return value;
}

function emitLog(
  level: "info" | "warn" | "error",
  functionName: string,
  requestId: string,
  event: string,
  metadata?: JsonRecord,
): void {
  const entry = {
    level,
    functionName,
    requestId,
    event,
    timestamp: new Date().toISOString(),
    ...(metadata ? { metadata: sanitizeForLog(metadata) } : {}),
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function createLogger(functionName: string, requestId: string) {
  return {
    info: (event: string, metadata?: JsonRecord) =>
      emitLog("info", functionName, requestId, event, metadata),
    warn: (event: string, metadata?: JsonRecord) =>
      emitLog("warn", functionName, requestId, event, metadata),
    error: (event: string, metadata?: JsonRecord) =>
      emitLog("error", functionName, requestId, event, metadata),
  };
}

export function validateRequiredFields(
  body: JsonRecord | null,
  fields: string[],
): string[] {
  if (!body) return fields;

  return fields.filter((field) => {
    const value = body[field];

    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim().length === 0)
    );
  });
}
