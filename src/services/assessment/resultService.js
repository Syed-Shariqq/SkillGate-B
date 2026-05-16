import { supabase } from "../../config/supabase";
import { apiClient } from "../apiClient";

const PDF_STATUS_LABELS = {
  pending: "Your report is being prepared",
  generating: "Report generation is in progress",
  generated: "Your report is ready",
  failed: "Report generation failed. Retrying shortly.",
};

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

/**
 * Returns a normalized invalid-input response.
 *
 * @param {string} message
 * @returns {{ data: null, error: { message: string } }}
 */
const invalidInput = (message) => ({ data: null, error: { message } });

/**
 * Resolves after the requested number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
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
 * Fetches the assessment status for result polling.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
const getAssessmentStatus = async (assessmentId) =>
  apiClient(
    (supabase) =>
      supabase
        .from("assessments")
        .select("id,status")
        .eq("id", assessmentId)
        .maybeSingle(),
    { functionName: "getAssessmentStatus", params: { assessmentId } },
  );

/**
 * Fetches the result row for an assessment.
 *
 * @param {string} assessmentId Assessment id.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const getResult = async (assessmentId) => {
  const trimmedAssessmentId =
    typeof assessmentId === "string" ? assessmentId.trim() : "";
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput("Invalid input");

  const response = await apiClient(
    (supabase) =>
      supabase
        .from("results")
        .select("*")
        .eq("assessment_id", trimmedAssessmentId)
        .maybeSingle(),
    {
      functionName: "getResult",
      params: { assessmentId: trimmedAssessmentId },
    },
  );

  return { data: response.data ?? null, error: response.error };
};

/**
 * Polls for a completed assessment result.
 *
 * @param {string} assessmentId Assessment id.
 * @param {number} [maxAttempts=15] Maximum poll attempts.
 * @returns {Promise<{ data: object | null, error: null | { message: string, code?: string } }>}
 */
export const pollForResult = async (assessmentId, maxAttempts = 15) => {
  const trimmedAssessmentId =
    typeof assessmentId === "string" ? assessmentId.trim() : "";
  if (!isValidUuid(trimmedAssessmentId)) return invalidInput("Invalid input");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0)
    return invalidInput("Invalid input");

  let attempt = 0;

  while (attempt < maxAttempts) {
    const result = await getResult(trimmedAssessmentId);
    if (result.error) return result;

    if (result.data) {
      return { data: result.data, error: null };
    }

    const assessment = await getAssessmentStatus(trimmedAssessmentId);
    if (assessment.error) return { data: null, error: assessment.error };

    if (assessment.data?.status === "failed") {
      return {
        data: null,
        error: {
          message: "Evaluation failed",
          code: "EVALUATION_FAILED",
        },
      };
    }

    attempt += 1;
    if (attempt < maxAttempts) await delay(2000);
  }

  return {
    data: null,
    error: {
      message: "timeout",
      code: "POLL_TIMEOUT",
    },
  };
};
