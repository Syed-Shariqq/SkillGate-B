# 04. Supabase Edge Functions Reference

SkillGate runs 18 Edge Functions on the Supabase Deno Edge Runtime. These functions provide the secure execution boundary for all candidate interactions, third-party integrations, AI model orchestration, and administrative tasks.

---

## 1. Edge Function Inventory Summary

| Function Name | Runtime | Auth Requirement | Primary Caller | Core Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| `start-assessment` | TypeScript | Public (Token validated) | `assessmentService.js` | Registers candidate, launches attempt, signs session JWT |
| `get-job-by-token` | TypeScript | Public | `assessmentService.js` | Candidate preview of job title, company, skills, time limit |
| `redirect-link` | TypeScript | Public | `/r/:token` (Vercel) | Hashes IP/UA, logs traffic in `link_opens`, redirects to test |
| `generate-questions`| TypeScript | Service Role Key | `start-assessment` | Generates & validates 8 questions (5 MCQ + 3 Text) via AI |
| `get-assessment` | TypeScript | Candidate Session JWT | `assessmentService.js` | Returns safe questions and timer state for active session |
| `save-response` | TypeScript | Candidate Session JWT | `responseService.js` | Real-time autosave of candidate answers with time validation |
| `record-assessment-event` | TypeScript | Candidate Session JWT | `responseService.js` | Logs anti-cheat events (tab switches, paste attempts) |
| `restart-assessment` | TypeScript | Candidate Session JWT | `assessmentService.js` | Wipes answers and increments attempt to 2 for crash recovery |
| `submit-assessment` | TypeScript | Candidate Session JWT | `responseService.js` | Atomically marks test submitted, schedules evaluation |
| `evaluate-responses`| TypeScript | Service Role / Auth User | `submit-assessment`, Recruiter UI | Grades MCQs & Text questions via AI, handles escalations |
| `generate-summary` | TypeScript | Service Role Key | `evaluate-responses` | Generates candidate feedback, executive summary & roadmap |
| `get-candidate-result`| TypeScript | Candidate Session JWT | `resultService.js` | Candidate-safe polling endpoint for completed results |
| `generate-pdf` | TypeScript | Service Role / Auth User | `evaluate-responses`, Recruiter UI | Converts HTML report to PDF via PDFShift, saves to Storage |
| `get-pdf-url` | TypeScript | Candidate Session JWT | `resultService.js` | Returns 48-hour signed Supabase Storage URL for PDF report |
| `send-email` | TypeScript | Service Role Key | `evaluate-responses`, Stripe | Sends transactional emails via Resend with auto-retry |
| `send-verification-email` | TypeScript | Service Role / User JWT | `authService.js` | Sends account verification link with 60-second cooldown |
| `create-checkout` | TypeScript | Recruiter User JWT | `billingService.js` | Creates Stripe Checkout sessions for plan upgrades |
| `stripe-webhook` | TypeScript | Stripe Signature Header | Stripe Webhooks Engine | Updates tiers, downgrades canceled plans, logs purchases |

---

## 2. Shared Libraries (`supabase/functions/_shared/`)

### 1. `sessionToken.ts`
* **Purpose:** Issues and cryptographically verifies candidate session tokens using HMAC-SHA256 (`jose` v5.9.6).
* **Token Lifetime:** 4 hours (`SESSION_DURATION_SECONDS = 14400`).
* **Secret Source:** `SESSION_SIGNING_SECRET` (must be $\ge 32$ characters).
* **Payload Structure:**
  ```json
  {
    "assessmentId": "uuid",
    "candidateId": "uuid",
    "issuedAt": 1711929600,
    "expiresAt": 1711944000
  }
  ```
* **Key Functions:**
  * `signSessionToken({ assessmentId, candidateId })`: Returns signed JWT string.
  * `verifySessionToken(token)`: Returns `{ assessmentId, candidateId }` or throws `SessionTokenError` (`TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_CONFIG_ERROR`). [EVIDENT]

### 2. `ai.js`
* **Purpose:** Multi-provider LLM calling engine implementing cascading fallback and JSON parsing.
* **Providers Configured:**
  1. **Primary: Gemini Flash (`gemini-2.5-flash`)**
     * Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
     * Timeout: 20,000ms (`AbortController`). Temperature: 0.1.
  2. **Fallback 1: OpenRouter (`openai/gpt-oss-120b:free`)**
     * Endpoint: `https://openrouter.ai/api/v1/chat/completions`
     * Timeout: 100,000ms (`AbortController`). Temperature: 0.1.
  3. **Fallback 2: Groq (`llama-3.3-70b-versatile`)**
     * Endpoint: `https://api.groq.com/openai/v1/chat/completions`
     * Timeout: 40,000ms (`AbortController`). `response_format: { type: "json_object" }`.
* **Key Functions:**
  * `callAI(prompt, maxTokens)`: Tries Gemini $\rightarrow$ OpenRouter $\rightarrow$ Groq. Returns `{ data, error, model }`.
  * `callAILarge(prompt, maxTokens)`: Large prompt variant following identical provider order.
  * `parseJSON(text)`: Multi-strategy JSON parser handling raw JSON, markdown-wrapped JSON (````json ... ````), and regex substring extraction (`/\{[\s\S]*\}/`). [EVIDENT]

### 3. `utils.ts`
* **Purpose:** Standard utility functions for CORS, logging, and error responses.
* **Key Components:**
  * `createServiceClient()`: Creates Supabase client using `SUPABASE_SERVICE_ROLE_KEY` with disabled session persistence.
  * `formatSuccess(data, status = 200)`: Formats standard JSON success payload.
  * `formatError(code, message, status)`: Formats standard `{ error: { code, message } }` payload.
  * `createLogger(functionName, requestId)`: Structured JSON logger with automatic key redaction for passwords, answers, tokens, and API keys via `sensitiveKeyPattern`. [EVIDENT]

### 4. `rateLimit.js`
* **Purpose:** IP and action rate limiting backed by the `increment_ratelimit` stored procedure.
* **Key Functions:**
  * `getLimit(tier)`: Returns 50 for Starter/Pro, Infinity for Enterprise, 10 for Free.
  * `checkRateLimit(supabase, identifier, action, maxPerDay)`: Computes UTC day start, invokes RPC, and returns `{ allowed: boolean, count: number }`. [EVIDENT]

---

## 3. Detailed Edge Function Specifications

---

### `start-assessment`
* **File:** `supabase/functions/start-assessment/index.ts`
* **Purpose:** Validates the public job token, verifies recruiter assessment quotas, creates or resumes candidate records, creates the assessment attempt, locks and triggers question generation, and issues the signed candidate session JWT.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "token": "job-token-uuid-or-string"
    }
    ```
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "assessmentId": "uuid",
      "candidateId": "uuid",
      "sessionToken": "eyJhbGciOi...",
      "assessmentStatus": "ready"
    }
    ```
* **Authentication & Authorization:** Public endpoint. Validates job token exists, is active, has not expired, and has not exceeded `link_max_uses`.
* **Callers:** `src/services/assessment/assessmentService.js` (`startAssessment`).
* **Failure Behavior & Error Codes:**
  * `400 VALIDATION_ERROR`: Missing name/email/token, malformed email, or invalid length.
  * `404 LINK_EXPIRED`: Job not found, deactivated, or expired.
  * `409 LINK_MAX_USES_REACHED`: Link reached max candidate starts.
  * `409 ASSESSMENT_ALREADY_TAKEN`: Candidate has a completed attempt and `allow_retakes = false`.
  * `500 GENERATION_FAILED`: Question generation timed out or failed across all AI providers.

---

### `get-job-by-token`
* **File:** `supabase/functions/get-job-by-token/index.ts`
* **Purpose:** Returns candidate-safe job metadata for the assessment landing page. Filters out internal recruiter notes, billing data, and answers.
* **Inputs:**
  * Method: `POST`
  * Body: `{"token": "job-token-string"}`
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "job": {
        "title": "Senior Backend Engineer",
        "companyName": "Acme Corp",
        "description": "...",
        "skills": ["Node.js", "PostgreSQL"],
        "timeLimitMinutes": 30,
        "allowRetakes": false
      },
      "status": "active"
    }
    ```
* **Authentication:** Public.
* **Callers:** `src/services/assessment/assessmentService.js` (`getJobByToken`).
* **Failure Behavior:**
  * `400 VALIDATION_ERROR`: Invalid or missing token.
  * `404 NOT_FOUND`: Token does not exist.
  * `410 EXPIRED`: Job is deactivated, expired, or link use limit exceeded.

---

### `redirect-link`
* **File:** `supabase/functions/redirect-link/index.ts`
* **Purpose:** Handles short assessment link clicks (`/r/:token`). Anonymously hashes IP address and User-Agent, logs traffic into `link_opens`, checks validity, and redirects HTTP 302 to `/assess/:token`.
* **Inputs:**
  * Method: `GET`
  * URL: `https://<project>.supabase.co/functions/v1/redirect-link/:token`
* **Outputs:**
  * `302 Found`: Redirects to `${SITE_URL}/assess/${token}`.
  * `404 Not Found`: Returns minimal HTML error page if token does not exist.
* **Authentication:** Public.
* **Callers:** Rewritten by Vercel edge proxy (`vercel.json`: `/r/:token` $\rightarrow$ `redirect-link`).
* **Failure Behavior:**
  * Redirects to `/assess/expired` if job is inactive, expired, or over maximum allowed uses.
  * Rate-limited to max 50 logged opens per IP per hour to avoid log table bloat.

---

### `generate-questions`
* **File:** `supabase/functions/generate-questions/index.ts`
* **Purpose:** Generates exactly 8 role-specific screening questions (5 MCQ and 3 Text) tailored to job skills using multi-model AI orchestration. Validates structure, checks cache, and inserts questions.
* **Inputs:**
  * Method: `POST`
  * Headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "jobId": "uuid",
      "recruiterId": "uuid"
    }
    ```
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "success": true,
      "cached": false,
      "questionsCount": 8
    }
    ```
* **Authentication:** Service-to-service internal only. Requires `SUPABASE_SERVICE_ROLE_KEY` to bypass platform JWT gateway. [EVIDENT]
* **Callers:** `start-assessment` Edge Function.
* **Failure Behavior:**
  * Validates questions strictly against schema rules (exactly 8 questions, 5 MCQ with 4 options and valid answer, 3 Text with non-empty ideal answers, point brackets 10/20/30).
  * If validation or AI call fails, retries once with stricter prompt rules.
  * If all retries fail, marks assessment status `'failed'` and inserts `assessment_generation_failed` into `notifications`.

---

### `get-assessment`
* **File:** `supabase/functions/get-assessment/index.ts`
* **Purpose:** Returns assessment questions and active state to candidate. Strips `correct_answer`, `ideal_answer`, and AI rubrics to protect exam integrity.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "sessionToken": "JWT"
    }
    ```
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "assessment": {
        "id": "uuid",
        "status": "ready",
        "timeLimitMinutes": 30,
        "startedAt": "2026-10-02T12:00:00Z",
        "attemptNumber": 1
      },
      "questions": [
        {
          "id": "uuid",
          "question_text": "...",
          "question_type": "mcq",
          "skill": "React",
          "points": 10,
          "options": ["A", "B", "C", "D"],
          "order_index": 0
        }
      ]
    }
    ```
* **Authentication:** Verifies `sessionToken` matches `assessmentId` and is unexpired.
* **Callers:** `src/services/assessment/assessmentService.js` (`getAssessment`).
* **Failure Behavior:**
  * `401 TOKEN_INVALID` / `TOKEN_EXPIRED`.
  * `403 OWNERSHIP_MISMATCH`: Token candidate ID does not match assessment.
  * `404 ASSESSMENT_NOT_FOUND`.

---

### `save-response`
* **File:** `supabase/functions/save-response/index.ts`
* **Purpose:** Real-time autosave endpoint for candidate answers. Verifies session JWT, validates that the server-side time limit has not expired, transitions assessment to `in_progress` on first answer, and upserts into `responses`.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "questionId": "uuid",
      "answer": "Selected option or text answer",
      "timeTaken": 45,
      "sessionToken": "JWT"
    }
    ```
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "responseId": "uuid",
      "savedAt": "2026-10-02T12:15:30Z"
    }
    ```
* **Authentication:** Validates candidate `sessionToken`.
* **Callers:** `src/services/assessment/responseService.js` (`saveResponse`).
* **Failure Behavior:**
  * `400 VALIDATION_ERROR`: Answer exceeds 10,000 characters or missing fields.
  * `401 TOKEN_INVALID` / `TOKEN_EXPIRED`.
  * `409 ASSESSMENT_EXPIRED`: `(now - started_at) > time_limit_minutes`. Triggers automatic exam submission on frontend.
  * `409 ASSESSMENT_NOT_ACTIVE`: Assessment is already submitted, evaluating, or completed.

---

### `record-assessment-event`
* **File:** `supabase/functions/record-assessment-event/index.ts`
* **Purpose:** Telemetry logger for anti-cheat events. Updates `tab_switches` and `paste_attempts`. Automatically sets `is_flagged = true` when tab switches reach 3.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "sessionToken": "JWT",
      "eventType": "tab_switch" | "paste_attempt",
      "metadata": { "count": 2 }
    }
    ```
* **Outputs:**
  * `200 OK`: `{"success": true, "recorded": true}`.
* **Authentication:** Validates candidate `sessionToken`.
* **Callers:** `src/services/assessment/responseService.js` (`recordTabSwitch`, `recordPasteAttempt`).
* **Failure Behavior:**
  * Uses optimistic concurrency loop (up to 3 retries) when updating `paste_attempts` to avoid race conditions.

---

### `restart-assessment`
* **File:** `supabase/functions/restart-assessment/index.ts`
* **Purpose:** One-time crash recovery restart. Allowed only when `attempt_number = 1` and status is `'in_progress'`. Wipes all previous response rows, resets `tab_switches` and `paste_attempts`, updates `attempt_number = 2`, and clears `started_at` so the candidate can restart with a fresh timer.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "sessionToken": "JWT"
    }
    ```
* **Outputs:**
  * `200 OK`: `{"restarted": true, "attemptNumber": 2, "startedAt": "..."}`.
* **Authentication:** Validates candidate `sessionToken`.
* **Callers:** `src/services/assessment/assessmentService.js` (`restartAssessment`).
* **Failure Behavior:**
  * `409 RESTART_NOT_ALLOWED`: Attempt number is already $\ge 2$ or assessment is submitted.

---

### `submit-assessment`
* **File:** `supabase/functions/submit-assessment/index.ts`
* **Purpose:** Concludes assessment test taking. Atomically updates status from `ready`/`in_progress` to `submitted`, calls stored procedure `increment_assessments_used` for the recruiter, and schedules evaluation in the background.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "sessionToken": "JWT"
    }
    ```
* **Outputs:**
  * `200 OK`: `{"submitted": true, "submittedAt": "2026-10-02T12:30:00Z", "assessmentId": "uuid"}`.
* **Authentication:** Validates candidate `sessionToken`.
* **Callers:** `src/services/assessment/responseService.js` (`submitAssessment`).
* **Failure Behavior:**
  * Idempotent: If assessment is already in `submitted`, `evaluating`, or `completed`, returns `200 OK` with existing `submitted_at` timestamp.
  * Evaluation trigger: Dispatched asynchronously using `EdgeRuntime.waitUntil` to guarantee sub-second HTTP response time for candidates.

---

### `evaluate-responses`
* **File:** `supabase/functions/evaluate-responses/index.ts`
* **Purpose:** Core grading engine. Grades MCQ questions deterministically. Evaluates text answers using the multi-model AI chain against ideal rubrics. Clamps scores, computes confidence scores, penalizes anti-cheat violations, persists results, and schedules summary generation, email, and PDF pipelines.
* **Inputs:**
  * Method: `POST`
  * Body: `{"assessmentId": "uuid"}`
* **Outputs:**
  * `200 OK`: `{"status": "completed", "resultId": "uuid", "overallScore": 82.5, "passed": true}`.
* **Authentication:** Service Role Key or Authenticated Recruiter JWT.
* **Callers:** `submit-assessment` Edge Function (automated), Recruiter `CandidateProfile.jsx` / `JobDetail.jsx` (manual retry).
* **Failure Behavior & Escalation:**
  * Text question AI evaluation retries once after 1000ms if provider fails or returns invalid JSON.
  * If all AI retries fail, throws `EvaluationFailedError`.
  * The handler catches `EvaluationFailedError`, transitions `assessments.status = 'pending_review'`, inserts a notification of type `evaluation_pending_review`, triggers `send-email` (`type: "pending_review"`), and returns `200 OK` with `{ status: "pending_review" }` to prevent client timeouts. [EVIDENT]

---

### `generate-summary`
* **File:** `supabase/functions/generate-summary/index.ts`
* **Purpose:** Generates post-evaluation intelligence: candidate-facing feedback summary, improvement resources (concept, practice, project), executive summary, hiring signal (`Strong Yes`, `Maybe`, `No`), hiring rationale, strengths, weaknesses, and a structured multi-day AI Growth Roadmap.
* **Inputs:**
  * Method: `POST`
  * Body: `{"assessmentId": "uuid", "resultId": "uuid"}`
* **Outputs:**
  * `200 OK`: `{"success": true, "summaryGenerated": true}`.
* **Authentication:** Service Role Key.
* **Callers:** `evaluate-responses` Edge Function.
* **Failure Behavior:**
  * Fallback templates: If AI summary generation fails or times out, applies rule-based heuristic summaries based on question pass/fail rates rather than blocking the candidate flow.

---

### `get-candidate-result`
* **File:** `supabase/functions/get-candidate-result/index.ts`
* **Purpose:** Polling and data retrieval endpoint for candidate submitted and result pages. Returns score, status, question feedback, and radar chart metrics while withholding recruiter executive summaries and notes.
* **Inputs:**
  * Method: `POST`
  * Body: `{"assessmentId": "uuid", "sessionToken": "JWT"}`
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "status": "completed",
      "overallScore": 85,
      "passed": true,
      "skillScores": [...],
      "questions": [...],
      "trainingPlan": [...]
    }
    ```
* **Authentication:** Validates candidate `sessionToken`.
* **Callers:** `src/services/assessment/resultService.js` (`getResult`).

---

### `generate-pdf`
* **File:** `supabase/functions/generate-pdf/index.ts`
* **Purpose:** Acquires a generation lock on `results.pdf_status = 'generating'`, builds a clean HTML evaluation report, sends it to PDFShift API for A4 rendering, uploads the binary PDF into the private `reports` Supabase Storage bucket, and updates `results.pdf_storage_path`.
* **Inputs:**
  * Method: `POST`
  * Body: `{"assessmentId": "uuid", "resultId": "uuid", "isAutoRetry"?: boolean}`
* **Outputs:**
  * `200 OK`: `{"status": "generated", "storagePath": "candidate-id/uuid.pdf"}`.
* **Authentication:** Service Role Key or Authenticated Recruiter JWT.
* **Callers:** `evaluate-responses` (automated), `CandidateProfile.jsx` (manual retry).
* **Failure Behavior:**
  * If PDFShift fails, catches error and checks `pdf_generation_attempts`.
  * If attempts $< 1$: Increments attempts, sets `pdf_status = 'pending'`, waits 2000ms, and re-invokes `generate-pdf` asynchronously (`isAutoRetry: true`).
  * If attempts $\ge 1$: Sets `pdf_status = 'failed'`, records error in `pdf_error`, and inserts a `pdf_generation_failed` alert into `notifications`. [EVIDENT]

---

### `get-pdf-url`
* **File:** `supabase/functions/get-pdf-url/index.ts`
* **Purpose:** Generates a temporary 48-hour signed Supabase Storage URL for a candidate's generated PDF report.
* **Inputs:**
  * Method: `POST`
  * Body: `{"resultId": "uuid", "sessionToken": "JWT"}`
* **Outputs:**
  * `200 OK`:
    ```json
    {
      "status": "generated",
      "signedUrl": "https://<project>.supabase.co/storage/v1/object/sign/reports/..."
    }
    ```
* **Authentication:** Validates candidate `sessionToken` and checks that the assessment ID matches `results.assessment_id`.
* **Callers:** `src/services/assessment/resultService.js` (`getPdfDownloadUrl`).
* **Expiry:** `SIGNED_URL_EXPIRY_SECONDS = 172800` (48 hours). [EVIDENT]

---

### `send-email`
* **File:** `supabase/functions/send-email/index.ts`
* **Purpose:** Transactional email dispatcher using Resend API. Handles candidate score delivery, recruiter completion alerts (filtered by recruiter notification settings), and manual review alerts.
* **Inputs:**
  * Method: `POST`
  * Body:
    ```json
    {
      "assessmentId": "uuid",
      "resultId": "uuid",
      "type": "candidate_result" | "recruiter_notify" | "both" | "pending_review"
    }
    ```
* **Outputs:**
  * `200 OK`: `{"status": "sent", "candidateSent": true, "recruiterSent": true}`.
* **Authentication:** Service Role Key.
* **Callers:** `evaluate-responses` Edge Function.
* **Failure Behavior:**
  * Wrapped in `retrySend()`: On network error or Resend 5xx, waits 2000ms and tries once more.
  * If delivery fails permanently, inserts `email_failed` notification into `notifications` and returns HTTP `207 Multi-Status`. [EVIDENT]

---

### `send-verification-email`
* **File:** `supabase/functions/send-verification-email/index.ts`
* **Purpose:** Dispatches account verification links to new recruiters. Enforces 60-second cooldown rate limit and generates unique verification tokens.
* **Inputs:**
  * Method: `POST`
  * Body: `{"userId": "uuid"}`
* **Outputs:**
  * `200 OK`: `{"status": "sent"}`.
  * `429 Too Many Requests`: `{"error": "cooldown_active", "remainingSeconds": 45}`.
* **Authentication:** Caller must provide Service Role Key OR a User JWT matching `userId`. [EVIDENT]
* **Callers:** `src/services/auth/authService.js` (`register`), `VerifyEmailPage.jsx` (`resendVerificationEmail`).
* **Security & Tokens:** Generates `crypto.randomUUID()`, saves to `profiles.email_verification_token` with `email_verification_sent_at = now()`.

---

### `create-checkout`
* **File:** `supabase/functions/create-checkout/index.ts`
* **Purpose:** Generates Stripe Checkout sessions for authenticated recruiters upgrading their plan tier. Searches or creates Stripe customer IDs and links them to `profiles.stripe_customer_id`.
* **Inputs:**
  * Method: `POST`
  * Headers: `Authorization: Bearer <USER_JWT>`
  * Body:
    ```json
    {
      "priceId": "price_1Ti...",
      "recruiterId": "uuid"
    }
    ```
* **Outputs:**
  * `200 OK`: `{"url": "https://checkout.stripe.com/c/pay/cs_test_..."}`.
* **Authentication:** Validates recruiter Supabase Auth token and enforces `user.id === recruiterId`.
* **Callers:** `src/services/recruiter/billingService.js` (`createCheckoutSession`).

---

### `stripe-webhook`
* **File:** `supabase/functions/stripe-webhook/index.ts`
* **Purpose:** Ingests and processes asynchronous Stripe events. Verifies signatures via Web Crypto with timing-safe string comparison and replay protection.
* **Events Processed:**
  * `checkout.session.completed`:
    * Subscription mode: Updates `profiles.subscription_tier`, sets `assessments_limit` (Starter: 10, Growth: 100, Scale: 500), and records `stripe_customer_id`.
    * Payment mode: Records candidate training plan purchase ($9.00) in `training_purchases`.
  * `customer.subscription.deleted`: Downgrades recruiter profile to `'starter'` tier and resets `assessments_limit = 10`.
  * `invoice.payment_failed`: Sends warning notification email via `send-email`.
* **Authentication:** Verifies `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET` with 300-second timestamp delta limit. [EVIDENT]
* **Callers:** Stripe servers.
* **Outputs:** `200 OK` `{"received": true}`.
