import { supabase } from "../../config/supabase";
import { apiClient } from "../apiClient";
import { getSessionFromStorage } from "./assessmentService";

const PDF_STATUS_LABELS = {
  pending: "Your report is being prepared",
  generating: "Report generation is in progress",
  generated: "Your report is ready",
  failed: "Report generation failed. Retrying shortly.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL_RESULT_STATUSES = new Set(["completed", "failed"]);
const RETRYABLE_ERROR_DELAY_MS = 2000;
const MAX_BACKOFF_DELAY_MS = 15000;

export const getPdfStatusLabel = (status) =>
  PDF_STATUS_LABELS[status] || PDF_STATUS_LABELS.pending;

export const getPdfDownloadUrl = async (resultId) => {
  if (!resultId) {
    return {
      data: null,
      error: { message: "resultId is required" },
    };
  }

  const { data, error } = await supabase.functions.invoke("get-pdf-url", {
    body: { resultId },
  });

  if (error) {
    return {
      data: null,
      error: {
        message: error.message || "Unable to fetch report download URL",
      },
    };
  }

  return { data, error: null };
};

/**
 * Returns a normalized invalid-input response.
 *
 * @param {string} message
 * @param {string} [code]
 * @returns {{ data: null, error: { message: string, code?: string } }}
 */
const invalidInput = (message, code = "VALIDATION_ERROR") => ({
  data: null,
  error: { message, code },
});

/**
 * Resolves after the requested number of milliseconds, unless cancelled.
 *
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
const delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Polling cancelled", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException("Polling cancelled", "AbortError"));
      },
      { once: true },
    );
  });

/**
 * Validates a UUID string.
 *
 * @param {string} value
 * @returns {boolean}
 */
const isValidUuid = (value) =>
  typeof value === "string" && UUID_PATTERN.test(value.trim());

/**
 * Returns the stored candidate session for an assessment.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {{ data: object | null, error: null | { message: string, code?: string } }}
 */
const getSessionForAssessment = (assessmentId) => {
  const session = getSessionFromStorage().data;

  if (!session || session.assessmentId !== assessmentId) {
    return invalidInput("Assessment session not found", "SESSION_NOT_FOUND");
  }

  return { data: session, error: null };
};

/**
 * Invokes a candidate Edge Function through the shared apiClient normalization.
 *
 * @param {string} functionName Supabase Edge Function name.
 * @param {object} body Request body.
 * @param {object} params Safe diagnostic params.
 * @returns {Promise<{ data: unknown, error: null | { message: string, code?: string, details?: unknown } }>}
 */
const invokeFunction = async (functionName, body, params) => {
  const response = await apiClient(
    (supabase) => supabase.functions.invoke(functionName, { body }),
    { functionName, params },
  );

  return { data: response.data ?? null, error: response.error };
};

/**
 * Fetches the candidate-safe assessment result.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const getCandidateResult = async ({
  assessmentId,
  sessionToken,
}) => {
  const trimmedAssessmentId =
    typeof assessmentId === "string"
      ? assessmentId.trim()
      : "";

  if (!isValidUuid(trimmedAssessmentId)) {
    return invalidInput("Invalid input");
  }

  if (
    typeof sessionToken !== "string"
    || !sessionToken.trim()
  ) {
    return invalidInput("Invalid session token");
  }

  const response = await invokeFunction(
    "get-candidate-result",
    {
      assessmentId: trimmedAssessmentId,
      sessionToken,
    },
    { assessmentId: trimmedAssessmentId },
  );

  return {
    data: response.data ?? null,
    error: response.error,
  };
};

/**
 * Backward-compatible result accessor.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const getResult = async (assessmentId) => getCandidateResult({ assessmentId });

/**
 * Normalizes legacy and options-object polling arguments.
 *
 * @param {number | { maxAttempts?: number, initialDelayMs?: number, signal?: AbortSignal }} options
 * @returns {{ maxAttempts: number, initialDelayMs: number, signal?: AbortSignal }}
 */
const normalizePollOptions = (options) => {
  if (typeof options === "number") {
    return {
      maxAttempts: options,
      initialDelayMs: RETRYABLE_ERROR_DELAY_MS,
      signal: undefined,
    };
  }

  return {
    maxAttempts: Number.isInteger(options?.maxAttempts) ? options.maxAttempts : 15,
    initialDelayMs: Number.isInteger(options?.initialDelayMs)
      ? options.initialDelayMs
      : RETRYABLE_ERROR_DELAY_MS,
    signal: options?.signal,
  };
};

/**
 * Polls for a completed candidate-safe assessment result.
 *
 * @param {string} assessmentId Assessment id.
 * @param {number | { maxAttempts?: number, initialDelayMs?: number, signal?: AbortSignal }} [options=15] Poll options or legacy max attempts.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const pollForResult = async (assessmentId, options = 15) => {
  const trimmedAssessmentId =
    typeof assessmentId === "string" ? assessmentId.trim() : "";
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput("Invalid input");

  const {
    maxAttempts,
    initialDelayMs,
    signal,
  } = normalizePollOptions(options);

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    return invalidInput("Invalid input");
  }

  let attempt = 0;
  let consecutiveErrors = 0;
  let delayMs = Math.max(250, initialDelayMs);

  while (attempt < maxAttempts) {
    if (signal?.aborted) {
      return invalidInput("Polling cancelled", "POLL_CANCELLED");
    }

    const result = await getCandidateResult(trimmedAssessmentId);

    if (result.error) {
      consecutiveErrors += 1;

      if (
        ["TOKEN_INVALID", "TOKEN_EXPIRED", "SESSION_NOT_FOUND", "VALIDATION_ERROR"]
          .includes(result.error.code)
      ) {
        return result;
      }
    } else if (TERMINAL_RESULT_STATUSES.has(result.data?.status)) {
      if (result.data.status === "failed") {
        return {
          data: null,
          error: {
            message: "Evaluation failed",
            code: "EVALUATION_FAILED",
          },
        };
      }

      return { data: result.data, error: null };
    } else {
      consecutiveErrors = 0;
      delayMs = Math.max(250, initialDelayMs);
    }

    attempt += 1;
    if (attempt >= maxAttempts) break;

    try {
      await delay(delayMs, signal);
    } catch (error) {
      if (error?.name === "AbortError") {
        return invalidInput("Polling cancelled", "POLL_CANCELLED");
      }

      throw error;
    }

    if (consecutiveErrors > 3) {
      delayMs = Math.min(delayMs * 2, MAX_BACKOFF_DELAY_MS);
    }
  }

  return {
    data: null,
    error: {
      message: "timeout",
      code: "POLL_TIMEOUT",
    },
  };
};
