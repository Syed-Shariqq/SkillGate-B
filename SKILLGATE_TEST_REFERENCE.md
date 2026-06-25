# SkillGate Test Reference & System Architecture Document

This document serves as the absolute source of truth for the SkillGate pre-screening and assessment platform. The details below are compiled directly from the live codebase, Edge Functions, and database schema (pulled directly from the live Supabase project).

---

## 1. User Roles & Entry Points

SkillGate supports three distinct user roles, each with specific entry points, authentication mechanisms, and accessible routes.

### A. Recruiters
Recruiters create jobs, generate assessment links, review candidate profiles, and manage billing.
*   **Entry Points:**
    *   **Signup Page (`/auth`):** Recruiters sign up using their full name, email, and password. This invokes `register()` in `authService.js`, which signs them up with Supabase Auth and triggers the `send-verification-email` Edge Function.
    *   **Login Page (`/auth`):** Registered recruiters log in via email and password using Supabase `signInWithPassword()`.
    *   **Email Verification Link (`/verify-email/confirm?token=...`):** Clicking the verification link in the signup email routes the user to the verification confirmation page, executing the database function `verify_email_with_token`.
*   **Accessible Routes (Guarded by `ProtectedRoute`):**
    *   `/dashboard`: Main recruiter dashboard showing metrics, usage stats, and recent activity.
    *   `/jobs`: List of all jobs created by the recruiter.
    *   `/jobs/create`: Form to create a new job position (specifying title, description, skills, pass threshold, and retake policies).
    *   `/jobs/:jobId`: Detailed job page listing candidates, statuses, scores, and enabling manual evaluation retries.
    *   `/jobs/:jobId/settings`: Edit job configurations.
    *   `/jobs/:jobId/success`: Displays the unique job token link after successful creation.
    *   `/jobs`: All Jobs page.
    *   `/candidates/:candidateId`: Candidate profile detailing question-by-question scoring, AI feedback, notes, and manual retry options.
    *   `/analytics`: Visual graphs of recruiter assessments and hiring metrics.
    *   `/billing`: Active plan status, usage metrics, and checkout links.
    *   `/billing/plans`: Subscription plan selection page.
    *   `/settings`: Manage recruiter profile data (name, company name, website).
    *   `/notifications`: Recruiter alert center.
*   **Guarded Transition Pages:**
    *   `/verify-email`: Shown if logged in but email is unverified.
    *   `/onboarding`: Form to collect company details shown if email is verified but `profiles.is_onboarded` is false.
    *   `/pending-approval`: Shown if email domain is generic (e.g., Gmail) and account status is `pending_approval`.
    *   `/rejected`: Shown if admin rejects the recruiter's registration.

### B. Candidates
Candidates take assessments and view their individual test results.
*   **Entry Points:**
    *   **Job Link URL (`/assess/:token`):** A public, token-based link shared by recruiters (e.g., `/assess/job-token-123`). This renders the `AssessmentLanding` page, which validates the token against the active job parameters.
*   **Accessible Routes (Guards managed inside pages, no Supabase auth required):**
    *   `/assess/:token`: Assessment landing page prompting candidates for name and email.
    *   `/assess/:token/test`: The active assessment interface (guarded by a valid session token stored in local storage).
    *   `/assess/:token/submitted`: Assessment landing page showing confirmation that responses are successfully recorded.
    *   `/assess/:token/result/:assessmentId`: Detailed score breakdown, skill radar chart, and growth roadmap.
    *   `/assess/expired`: Shown if the job link expiration date has passed.
    *   `/assess/taken`: Renders if the candidate has already taken the test and retakes are disabled.
    *   `/assessment-unavailable`: Displays if the recruiter's assessment limit has been reached.

### C. Admins
Admins approve or reject recruiter accounts registered with generic domains.
*   **Entry Points:**
    *   Log in via `/auth` (shares the standard login screen, but is authenticated using an account where `profiles.is_admin` is `true`).
*   **Accessible Routes (Guarded by `AdminRoute`):**
    *   `/admin/approvals`: View, approve, or reject pending recruiter accounts.

---

## 2. Full User Flows & Guard Enforcements

The routing guards in `src/routes/index.jsx` enforce strict page transitions based on the recruiter's authentication status, onboarding stage, and domain verification.

```mermaid
graph TD
    %% Recruiter Flow
    subgraph Recruiter Flow
        A[Recruiter Signup at /auth] --> B{Email Domain?}
        B -- Generic Domain --> C[account_status = pending_approval]
        B -- Company Domain --> D[account_status = approved]
        
        C & D --> E[Triggers send-verification-email]
        E --> F[verify-email page]
        F --> G[Clicks Link: verify-email/confirm?token=...]
        G --> H{verify_email_with_token RPC}
        
        H --> I{Approved & verified?}
        I -- No: Generic domain --> J[Redirects to /pending-approval]
        I -- Yes: Company domain --> K[Redirects to /onboarding]
        
        J -->|Admin approves| K
        K --> L[Onboarding: Sets is_onboarded = true]
        L --> M[Accesses /dashboard]
        M --> N[Creates Job -> Generates Token]
    end

    %% Candidate Flow
    subgraph Candidate Flow
        O[Candidate clicks /assess/:token] --> P{get-job-by-token}
        P -- Invalid/Expired/Max Uses -- > Q[Redirect to error page]
        P -- Valid --> R{Recruiter Limit check}
        R -- Over Limit --> S[Redirect to /assessment-unavailable]
        R -- Under Limit --> T[Landing page: Enters Name & Email]
        
        T --> U[start-assessment Edge Function]
        U --> V{Existing Active Attempt?}
        V -- Yes --> W[ResumeOrRestartModal]
        V -- No --> X[Create assessment row & generate questions]
        
        X & W --> Y[Redirects to /assess/:token/test]
        Y --> Z[Answering: real-time save-response]
        Z --> AA[Submits: submit-assessment]
        AA --> AB[Asynchronous evaluation-responses]
        AB --> AC[Redirects to /assess/:token/submitted]
        AC -->|Polling completed| AD[Accesses /assess/:token/result/:id]
    end
```

### A. Protected Route Guard Logic (`ProtectedRoute.jsx`)
Applies to all recruiter dashboard routes. Evaluated in the following order:
1.  **Loading Check:** If `useAuth()` loading is `true`, render the `FullscreenLoader`.
2.  **Auth Check:** If `isAuthenticated` is `false`, redirect to `/auth`.
3.  **Email Verification Check:** If `isEmailVerified` (based on `profiles.email_verified === true`) is `false`, redirect to `/verify-email`.
4.  **Onboarding Check:** If `isOnboarded` (based on `profiles.is_onboarded === true`) is `false`, redirect to `/onboarding`.
5.  **Admin Approval Check:** If `isPendingApproval` (based on `profiles.account_status === 'pending_approval'`) is `true`, redirect to `/pending-approval`.
6.  **Rejection Check:** If `isRejected` (based on `profiles.account_status === 'rejected'`) is `true`, redirect to `/rejected`.
7.  **Access Granted:** If all conditions are met, render the requested page via `<Outlet />`.

### B. Admin Route Guard Logic (`AdminRoute.jsx`)
1.  **Loading Check:** If `loading` is `true`, render the `FullscreenLoader`.
2.  **Auth Check:** If `isAuthenticated` is `false`, redirect to `/auth`.
3.  **Admin Check:** If `isAdmin` (based on `profiles.is_admin === true`) is `false`, redirect to `/dashboard` (restricting access).
4.  **Access Granted:** Render the admin controls via `<Outlet />`.

### C. Public Route Guard Logic (`PublicRoute.jsx`)
Applied to auth endpoints to prevent logged-in users from seeing login screens.
1.  **Loading Check:** If `loading` is `true`, render the `FullscreenLoader`.
2.  **Auth Check:** If `isAuthenticated` is `true`:
    *   If `!isEmailVerified`, redirect to `/verify-email`.
    *   If `isOnboarded`, redirect to `/dashboard`.
    *   If `!isOnboarded`, redirect to `/onboarding`.
3.  **Access Granted:** If not authenticated, render the auth layout via `<Outlet />`.

---

## 3. Database Schema Overview (Live Pulled)

This schema reflects the active tables, columns, constraints, and Row-Level Security (RLS) policies extracted from the live database.

### 1. `profiles`
Tracks recruiter accounts, subscription details, and admin statuses.
*   **Columns:**
    *   `id` (`uuid`): Primary key referencing `auth.users(id)` ON DELETE CASCADE.
    *   `email` (`text`, default `""`): Recruiter email address.
    *   `full_name` (`text`): Recruiter's name.
    *   `company_name` (`text`): Registered company name.
    *   `company_website` (`text`): Company URL.
    *   `company_logo_url` (`text`): S3/storage path for logo.
    *   `work_email` (`text`): Secondary contact email.
    *   `subscription_tier` (`text`, default `'starter'`): Check constraint: `'starter'`, `'growth'`, `'scale'`.
    *   `assessments_used` (`integer`, default `0`): Running total of completed candidate assessments.
    *   `assessments_limit` (`integer`, default `10`): Max assessments allowed in the current billing cycle.
    *   `stripe_customer_id` (`text`): Stripe customer reference.
    *   `billing_cycle_reset_at` (`timestamptz`): Reset timestamp for assessments limit.
    *   `notify_on_every_completion` (`boolean`, default `false`): Alert recruiter on every candidate finish.
    *   `notify_on_pass_only` (`boolean`, default `false`): Alert recruiter only when candidate passes.
    *   `notify_inapp` (`boolean`, default `true`): Toggle for dashboard alerts.
    *   `zapier_webhook_url` (`text`): Custom recruiter integration.
    *   `is_onboarded` (`boolean`, default `false`): Onboarding wizard state.
    *   `is_admin` (`boolean`, default `false`): Admin role override flag.
    *   `account_status` (`text`, default `'approved'`): Check constraint: `'approved'`, `'pending_approval'`, `'rejected'`.
    *   `email_verified` (`boolean`, default `false`): Profile verification status.
    *   `email_verification_token` (`text`): Random token generated for signup.
    *   `email_verification_sent_at` (`timestamptz`): Sent timestamp for verification cooldown.
    *   `email_verified_at` (`timestamptz`): Time verification occurred.
*   **Indexes:**
    *   `idx_profiles_email_verification_token` UNIQUE on `email_verification_token` WHERE `email_verification_token` IS NOT NULL.
*   **RLS Policies:**
    *   `profile_owner`: Authenticated users can perform ALL operations if `auth.uid() = id`.
    *   `Public can read recruiter limit for assessment check`: Allows SELECT for anyone (`anon` and `authenticated`) to inspect assessment limits.
    *   `admin_can_update_any_profile`: Grants UPDATE to authenticated admins (checks if `is_admin = true` on `auth.uid()`).

### 2. `jobs`
Job openings created by recruiters.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `recruiter_id` (`uuid`): References `profiles(id)` ON DELETE RESTRICT.
    *   `title` (`text`): Job title.
    *   `company_name` (`text`): Hiring company.
    *   `description` (`text`): Job details.
    *   `skills` (`jsonb`, default `'[]'`): Skill list array.
    *   `min_score_threshold` (`integer`, default `70`): Check constraint between `50` and `90`.
    *   `time_limit_minutes` (`integer`, default `30`): Timer limit.
    *   `is_active` (`boolean`, default `true`): Deactivation flag.
    *   `allow_retakes` (`boolean`, default `false`): Retake flag.
    *   `show_score_to_candidate` (`boolean`, default `true`): Let candidate see their score.
    *   `assessment_link_token` (`text`, unique): Link token.
    *   `link_expires_at` (`timestamptz`): Token expiration timestamp.
    *   `link_max_uses` (`integer`): Maximum starts allowed.
    *   `link_use_count` (`integer`, default `0`): Current starts recorded.
*   **Indexes:**
    *   `idx_jobs_recruiter` on `recruiter_id`.
    *   `idx_jobs_token` on `assessment_link_token`.
*   **RLS Policies:**
    *   `recruiter_all_jobs`: Authenticated recruiters have ALL permissions if `auth.uid() = recruiter_id`.

### 3. `candidates`
Details of candidate applicants.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `job_id` (`uuid`): References `jobs(id)` ON DELETE RESTRICT.
    *   `recruiter_id` (`uuid`): References `profiles(id)` ON DELETE RESTRICT.
    *   `full_name` (`text`): Candidate's name.
    *   `email` (`text`): Candidate's email.
    *   `status` (`text`, default `'pending'`): Check constraint: `'pending'`, `'in_progress'`, `'completed'`, `'shortlisted'`, `'rejected'`.
*   **Indexes:**
    *   `idx_candidates_recruiter` on `recruiter_id`.
    *   `idx_candidates_lookup` on `lower(email)`, `job_id`.
    *   `idx_candidates_unique_email_job` UNIQUE on `lower(email)`, `job_id`.
*   **RLS Policies:**
    *   `recruiter_all_candidates`: Authenticated recruiters have ALL permissions if `auth.uid() = recruiter_id`.

### 4. `assessments`
Tracks candidate test-taking attempts.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `job_id` (`uuid`): References `jobs(id)` ON DELETE RESTRICT.
    *   `candidate_id` (`uuid`): References `candidates(id)` ON DELETE RESTRICT.
    *   `recruiter_id` (`uuid`): References `profiles(id)` ON DELETE RESTRICT.
    *   `attempt_number` (`integer`, default `1`): Attempt count.
    *   `status` (`text`, default `'pending'`): Check constraint: `'pending'`, `'generating'`, `'ready'`, `'in_progress'`, `'submitted'`, `'evaluating'`, `'completed'`, `'failed'`, `'pending_review'`.
    *   `started_at` (`timestamptz`): Start time.
    *   `submitted_at` (`timestamptz`): Submit time.
    *   `completed_at` (`timestamptz`): Complete time.
    *   `time_limit_minutes` (`integer`, default `30`): Timer value.
    *   `generation_attempts` (`integer`, default `0`): Lock count for questions.
    *   `evaluation_attempts` (`integer`, default `0`): Grading retries.
    *   `tab_switches` (`integer`, default `0`): Tab switch counter.
    *   `paste_attempts` (`integer`, default `0`): Paste event counter.
    *   `is_flagged` (`boolean`, default `false`): Marked if tab switches >= 3.
    *   `idempotency_key` (`text`, unique): Concurrency lock key.
*   **Indexes:**
    *   `idx_assessments_candidate` on `candidate_id`.
    *   `idx_assessments_job` on `job_id`.
    *   `idx_assessments_status` on `status`.
    *   `idx_assessments_one_active_per_candidate_job` UNIQUE on `candidate_id`, `job_id` WHERE status is `'pending'`, `'ready'`, or `'in_progress'`.
*   **Constraints:**
    *   `unique_attempt` UNIQUE on `candidate_id`, `job_id`, `attempt_number`.
*   **RLS Policies:**
    *   `recruiter_all_assessments`: Recruiters can do ALL if `auth.uid() = recruiter_id`.

### 5. `questions`
Questions created for assessments.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `job_id` (`uuid`): References `jobs(id)` ON DELETE RESTRICT.
    *   `recruiter_id` (`uuid`): References `profiles(id)` ON DELETE RESTRICT.
    *   `assessment_id` (`uuid`): References `assessments(id)` ON DELETE CASCADE.
    *   `question_text` (`text`): Question description.
    *   `question_type` (`text`): `'mcq'` or `'text'`.
    *   `skill` (`text`): Skill evaluated.
    *   `difficulty` (`text`, default `'medium'`): `'easy'`, `'medium'`, `'hard'`.
    *   `options` (`jsonb`): MCQ answers.
    *   `correct_answer` (`text`): MCQ correct option.
    *   `ideal_answer` (`text`): Text question rubric.
    *   `points` (`integer`, default `10`): `10`, `20`, or `30`.
    *   `order_index` (`integer`, default `0`): Sequence order.
    *   `is_custom` (`boolean`, default `false`): If created manually.
*   **RLS Policies:**
    *   `recruiter_all_questions`: Recruiters can do ALL if `auth.uid() = recruiter_id`.

### 6. `responses`
Answers submitted by candidates.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `assessment_id` (`uuid`): References `assessments(id)` ON DELETE RESTRICT.
    *   `question_id` (`uuid`): References `questions(id)` ON DELETE RESTRICT.
    *   `candidate_id` (`uuid`): References `candidates(id)` ON DELETE RESTRICT.
    *   `answer_given` (`text`): Candidate's response.
    *   `is_correct` (`boolean`): True if correct.
    *   `score` (`numeric(5,2)`): Clamped value between 0.00 and 1.00.
    *   `points_earned` (`integer`, default `0`): Earned score.
    *   `ai_feedback` (`text`): AI explanation.
    *   `missed_concepts` (`jsonb`, default `'[]'`): Missed ideas list.
    *   `time_taken_seconds` (`integer`, default `0`): Time taken.
*   **Constraints:**
    *   `responses_assessment_id_question_id_key` UNIQUE on `assessment_id`, `question_id`.
*   **RLS Policies:**
    *   `recruiter_read_responses`: Recruiters can SELECT if they own the assessment.

### 7. `results`
AI evaluation summaries and report references.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `assessment_id` (`uuid`): References `assessments(id)` ON DELETE RESTRICT. Unique key.
    *   `overall_score` (`numeric(5,2)`, default `0`): Final percentage.
    *   `passed` (`boolean`, default `false`): Passed flag.
    *   `confidence_score` (`numeric(5,2)`): Score validity percentage.
    *   `confidence_label` (`text`, default `'Low'`): `'High'`, `'Medium'`, `'Low'`.
    *   `skill_scores` (`jsonb`, default `'[]'`): Scores mapped to categories.
    *   `total_points_earned` (`integer`, default `0`): Final points.
    *   `total_points_possible` (`integer`, default `0`): Maximum possible points.
    *   `time_taken_seconds` (`integer`, default `0`): Total duration.
    *   `feedback_summary` (`text`): Overall feedback.
    *   `executive_summary` (`text`): Recruiter-facing summary.
    *   `hiring_signal` (`text`): `'Strong Yes'`, `'Maybe'`, `'No'`.
    *   `strengths` (`jsonb`, default `'[]'`): Strong areas.
    *   `weaknesses` (`jsonb`, default `'[]'`): Areas to improve.
    *   `training_plan` (`jsonb`, default `'[]'`): Growth roadmap.
    *   `pdf_url` (`text`): Storage URL reference.
    *   `email_sent` (`boolean`, default `false`): Check for notification delivery.
    *   `summary_generated` (`boolean`, default `false`): Summary flag.
    *   `hiring_rationale` (`text`): Extra rationale.
    *   `pdf_status` (`text`, default `'pending'`): `'pending'`, `'generating'`, `'generated'`, `'failed'`.
    *   `pdf_storage_path` (`text`): S3/storage PDF path.
    *   `pdf_generated_at` (`timestamptz`): Generation time.
    *   `pdf_error` (`text`): PDF generation error log.
    *   `pdf_generation_started_at` (`timestamptz`): Lock start time.
    *   `pdf_generation_attempts` (`integer`, default `0`): Retry counter.
*   **RLS Policies:**
    *   `recruiter_read_results`: Recruiters can SELECT if they own the assessment.

### 8. `notifications`
Alerts for recruiters.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `recruiter_id` (`uuid`): References `profiles(id)` ON DELETE CASCADE.
    *   `type` (`text`): Check constraint: `'email_sent'`, `'email_failed'`, `'candidate_passed'`, `'candidate_failed'`, `'assessment_complete'`, `'link_limit_reached'`, `'assessment_generation_failed'`, `'evaluation_pending_review'`, `'pdf_generation_failed'`.
    *   `title` (`text`): Notification header.
    *   `message` (`text`): Message text.
    *   `candidate_id` (`uuid`): References `candidates(id)` ON DELETE SET NULL.
    *   `assessment_id` (`uuid`): References `assessments(id)` ON DELETE SET NULL.
    *   `job_id` (`uuid`): References `jobs(id)` ON DELETE SET NULL.
    *   `is_read` (`boolean`, default `false`): Read/unread toggle.
*   **RLS Policies:**
    *   `recruiter_all_notifications`: Recruiters can manage notifications.

### 9. `cache`
Storage for generated AI questions.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `cache_key` (`text`, unique): Hashed cache key.
    *   `cache_type` (`text`): Cache category.
    *   `data` (`jsonb`): Cached data structure.
    *   `expires_at` (`timestamptz`): Cache TTL.
*   **RLS Policies:**
    *   `deny_cache_anon`: Deny SELECT to anon.
    *   `deny_cache_authenticated`: Deny SELECT to authenticated.

### 10. `rate_limits`
Tracks rate limits.
*   **Columns:**
    *   `identifier` (`text`), `action` (`text`), `window_start` (`timestamptz`): Composite primary key.
    *   `count` (`integer`, default `1`): Current counts.
*   **RLS Policies:**
    *   `deny_rate_limits_anon` & `deny_rate_limits_authenticated`: Deny all public access.

### 11. `training_purchases`
Roadmap purchases.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `candidate_id` (`uuid`): References `candidates(id)` ON DELETE RESTRICT.
    *   `assessment_id` (`uuid`): References `assessments(id)` ON DELETE RESTRICT.
    *   `stripe_session_id` (`text`, unique): Stripe payment reference.
    *   `amount_paid` (`integer`, default `900`): Amount paid in cents ($9.00).
    *   `status` (`text`, default `'pending'`): `'pending'`, `'completed'`, `'failed'`, `'refunded'`.
*   **RLS Policies:**
    *   `Candidates can check their purchase`: Allows candidates to view their purchases.
    *   `recruiter_read_purchases`: Allows recruiter access.
    *   `anon_insert_training_purchase`: Allows anon writes upon completion.

### 12. `link_opens`
Tracks job link traffic.
*   **Columns:**
    *   `id` (`uuid`): Primary key.
    *   `job_id` (`uuid`): References `jobs(id)` ON DELETE CASCADE.
    *   `opened_at` (`timestamptz`, default `now()`): Time opened.
    *   `ip_hash` (`text`): Anonymous client IP.
    *   `user_agent_hash` (`text`): Anonymous user agent.
*   **RLS Policies:**
    *   `Recruiters can read link opens for their jobs`: Recruiter selects if they own the job.
    *   `Service role can insert link opens`: Bypasses RLS for new opens.

---

## 4. Edge Functions Inventory

All functions run on Supabase Edge Runtime, bypassing RLS using the postgres service role client.

| Function Name | Purpose | Expected Input Shape | Expected Return Shape | Frontend Service File |
| :--- | :--- | :--- | :--- | :--- |
| `start-assessment` | Validates job token, upserts candidate, checks retakes, calls `generate-questions`, registers link use, signs JWT. | `{"name": string, "email": string, "token": string}` | `{"success": true, "data": {"assessmentId": UUID, "candidateId": UUID, "sessionToken": JWT, "assessmentStatus": string}}` | `assessmentService.js` |
| `get-assessment` | Fetches questions and assessment status for the active test session. | `{"assessmentId": UUID, "sessionToken": JWT}` | `{"success": true, "data": {"assessment": {...}, "questions": [{"id": UUID, "question_text": string, "question_type": string, "options": Array, "order_index": int}]}}` | `assessmentService.js` |
| `save-response` | Records a single candidate answer in real-time, verifying limits. | `{"assessmentId": UUID, "questionId": UUID, "answer": string, "timeTaken": int, "sessionToken": JWT}` | `{"success": true, "data": {"responseId": UUID, "savedAt": timestamptz}}` | `responseService.js` |
| `submit-assessment` | Submits the test, increments assessments used, and invokes grading. | `{"assessmentId": UUID, "sessionToken": JWT}` | `{"success": true, "data": {"submitted": true, "submittedAt": timestamptz}}` | `responseService.js` |
| `evaluate-responses` | Grades questions, calculates scores, requests AI feedback, and records the result. | `{"assessmentId": UUID}` | `{"status": "completed", "resultId": UUID, "passed": bool, "score": numeric}` | Recruiter pages (Direct invoke) |
| `get-candidate-result`| Candidate-safe results payload. | `{"assessmentId": UUID, "sessionToken": JWT}` | `{"success": true, "data": {"status": string, "overallScore": int, "feedback": string, "questionResults": Array}}` | `resultService.js` |
| `generate-pdf` | Generates PDF report via PDFShift, saves to storage, and handles retries. | `{"assessmentId": UUID, "resultId": UUID, "isAutoRetry"?: bool}` | `{"status": "generated", "storagePath": string}` | `candidateService.js` |
| `get-pdf-url` | Returns temporary signed URL for the report. | `{"resultId": UUID, "sessionToken": JWT}` | `{"status": "generated", "signedUrl": string}` | `resultService.js` |
| `send-email` | Dispatches results or alerts via Resend. | `{"assessmentId": UUID, "resultId"?: UUID, "type": string}` | `{"status": "sent", "candidateSent": bool, "recruiterSent": bool}` | `resultService.js` |
| `send-verification-email`| Verification link dispatcher. | `{"userId": UUID}` | `{"status": "sent"}` | `authService.js` |
| `stripe-webhook` | Listens to Stripe events for subscriptions, cancellations, and failures. | Stripe webhook payload | `{"received": true}` | Stripe Integration |
| `create-checkout` | Creates Stripe checkout sessions. | `{"priceId": string, "recruiterId": UUID}` | `{"url": string}` | `billingService.js` |
| `restart-assessment` | Deletes answers and increments attempt number to 2. | `{"assessmentId": UUID, "sessionToken": JWT}` | `{"success": true, "data": {"restarted": true, "attemptNumber": 2}}` | `assessmentService.js` |
| `record-assessment-event`| Anti-cheat event logger. | `{"assessmentId": UUID, "sessionToken": JWT, "eventType": string, "metadata": object}` | `{"success": true, "data": {"recorded": true}}` | `responseService.js` |
| `get-job-by-token` | Candidate job preview metadata. | `{"token": string}` | `{"success": true, "data": {"job": {...}, "status": string}}` | `assessmentService.js` |

> [!WARNING]
> **\* Bypassed API Client Call Sites (bugs.txt Verification):**
> 
> We verified the codebase for the 4 call sites mentioned in `bugs.txt`:
> 1. `src/pages/assessment/AssessmentResult.jsx` (Calling `"get-pdf-url"`): **VERIFIED NOT BYPASSED**. It calls `getPdfDownloadUrl` in `resultService.js`, which uses the `invokeFunction` helper.
> 2. `src/services/assessment/resultService.js` (Calling `"get-pdf-url"` on line 30): **VERIFIED NOT BYPASSED**. It uses the `invokeFunction` helper, which correctly wraps the invocation in the `apiClient` error normalizer.
> 3. `src/pages/recruiter/candidates/CandidateProfile.jsx` (Calling `"evaluate-responses"` on line 55): **VERIFIED BYPASSED**. Calls `supabase.functions.invoke("evaluate-responses")` directly.
> 4. `src/pages/recruiter/jobs/JobDetail.jsx` (Calling `"evaluate-responses"` on line 59): **VERIFIED BYPASSED**. Calls `supabase.functions.invoke("evaluate-responses")` directly.

---

## 5. Third-Party Integrations

SkillGate relies on four external APIs, complete with fallback logic on failures and known environment restrictions.

### A. Resend (Email Delivery)
*   **Triggers:**
    *   **Signup verification:** Triggers `send-verification-email` from frontend registration.
    *   **Candidate result & Recruiter notification:** Triggered on result completion.
    *   **Manual review:** Triggered if grading fails.
    *   **Payment Failure:** Triggered when Stripe billing fails.
*   **Fallback Behavior:** Uses `retrySend` which catches failure, waits 2000ms, and tries exactly once more. If both fail, writes `email_failed` type in `notifications` table and returns a `207` status code.
*   **Known Limitations:**
    *   **Sandbox Domain:** Uses `onboarding@resend.dev` as `FROM_EMAIL`. Resend blocks emails to unverified recipients in sandbox mode. Needs verified domain.

### B. Stripe (Payment Processing)
*   **Triggers:**
    *   Recruiter upgrades tier or buys a candidate growth roadmap.
*   **Webhook Events:**
    *   `checkout.session.completed` (Subscription/Payment): Sets recruiter subscription tiers, resets limits, or writes to `training_purchases`.
    *   `customer.subscription.deleted`: Downgrades profiles to `'starter'` and resets limit to `10`.
    *   `invoice.payment_failed`: Sends a warning email via `send-email`.
*   **Fallback Behavior:** Stripe automatically retries webhook delivery if the server returns non-200. Webhook verification uses timing-safe comparison on raw request bodies.

### C. PDFShift (HTML-to-PDF Conversion)
*   **Triggers:**
    *   Completion of evaluation triggers report generation.
*   **Fallback Behavior:** If PDFShift fails, it retries once after 2000ms. If it fails again, writes status `'failed'` and logs the error details in `pdf_error` on `results` table, then inserts a notification of type `pdf_generation_failed`.

### D. AI Model Fallback Chain (Gemini $\rightarrow$ OpenRouter $\rightarrow$ Groq)
*   **Triggers:** Question generation and answer evaluations.
*   **Model Selection:**
    1.  **Primary:** Gemini (`gemini-2.5-flash`, 20s timeout limit).
    2.  **Fallback 1:** OpenRouter (`deepseek/deepseek-chat:free` / `openai/gpt-oss-120b:free`, 100s timeout limit).
    3.  **Fallback 2:** Groq (`llama-3.3-70b-versatile`, 40s timeout limit).
*   **Fallback Behavior:**
    *   **Question Generation:** If all fail, marks assessment status `'failed'` and adds `assessment_generation_failed` notification.
    *   **Evaluation:** If all fail, throws `EvaluationFailedError`, transitions status to `'pending_review'`, inserts `evaluation_pending_review` notification, and sends manual review email to recruiter.

---

## 6. Known Issues / Deferred Debt (from bugs.txt)

This list captures all registered bugs and technical debt currently in the project backlog.

*   **Bug 01 (Open):** Evaluation failures for text-based questions due to JSON parse errors from AI response grading.
*   **Bug 02 (Open):** Random screen freezing in loading state.
*   **Deferred Code Quality:** Hardcoded parameters in `apiClient` and page components should be cleaned and replaced with constants.
*   **Deferred API Client Bypass (Open / Verified):**
    *   `src/pages/assessment/AssessmentResult.jsx` (get-pdf-url) - **Verified Not Bypassed** (uses `getPdfDownloadUrl` in `resultService.js` which wraps `apiClient`).
    *   `src/services/assessment/resultService.js` (get-pdf-url) - **Verified Not Bypassed** (uses `invokeFunction` which wraps `apiClient`).
    *   `src/pages/recruiter/candidates/CandidateProfile.jsx` (evaluate-responses retry, line 55) - **Verified Bypassed**.
    *   `src/pages/recruiter/jobs/JobDetail.jsx` (evaluate-responses retry, line 59) - **Verified Bypassed**.
*   **Resend blocker:** Recruiter invitation and candidate mailing are blocked on sandbox configurations until custom domains are verified.

---

## 7. Environment Variables & Secrets Required

### A. Frontend Environment Variables (`.env.local`)
```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_CREATE_CHECKOUT_URL=https://<ref>.supabase.co/functions/v1/create-checkout
VITE_STRIPE_TRAINING_PLAN_PRICE_ID=price_1Ti...
VITE_STRIPE_TRAINING_PLAN_PAYMENT_LINK=https://buy.stripe.com/test_...
VITE_STRIPE_GROWTH_PRICE_ID=price_1Ti...
VITE_STRIPE_SCALE_PRICE_ID=price_1Ti...
```

### B. Supabase Edge Function Secrets (`supabase vault` / `deno env`)
```bash
# Supabase Core
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Third-Party Integrations
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_1Ti...
STRIPE_GROWTH_PRICE_ID=price_1Ti...
STRIPE_SCALE_PRICE_ID=price_1Ti...
STRIPE_TRAINING_PLAN_PRICE_ID=price_1Ti...
RESEND_API_KEY=re_...
PDFSHIFT_API_KEY=...
SITE_URL=https://...

# AI Keys
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
```

---

## 8. Edge Case Specifications

Here is the exact behavior currently implemented in code for specific edge-case scenarios:

### A. Network Failure Mid-Assessment
*   **Implemented Behavior:**
    *   When the frontend detects a network failure or a failed `saveResponse` call:
        *   If the save fails, it retries once after 2000ms.
        *   If the retry fails, the response is queued locally in the browser's local storage under `skillgate_pending_saves_${assessmentId}` and `saveStatus` is set to `"offline"`.
        *   When connectivity is restored (`online` event fires), `flushPendingQueue()` is executed. This loops through the local queue and syncs answers with the backend.
        *   If an unsaved item fails sync with an `ASSESSMENT_EXPIRED` error, the queue is cleared, the candidate is alerted, and the assessment is automatically submitted.

### B. Assessment Generation Failure
*   **Implemented Behavior:**
    *   If `generate-questions` fails (due to AI timeouts, validation failures, or rate limits):
        *   Updates the assessment status to `'failed'` in the `assessments` table.
        *   Inserts a notification of type `assessment_generation_failed` into the recruiter's `notifications` table.
        *   The frontend candidate gets redirected to `/assess/expired` or shows an error message.

### C. AI Evaluation/Scoring Failure
*   **Implemented Behavior:**
    *   If Gemini, OpenRouter, and Groq all fail during `evaluateTextResponse`:
        *   The function throws an `EvaluationFailedError`.
        *   The `evaluate-responses` handler catches this error, updates the assessment status to `'pending_review'`, and inserts a notification of type `evaluation_pending_review` for the recruiter.
        *   It triggers `send-email` Edge Function (with body `{ type: "pending_review" }`) to alert the recruiter.
        *   The function returns a `200` response with `{ status: "pending_review" }` to prevent frontend client timeout.

### D. Browser Crash / Refresh Recovery Mid-Assessment
*   **Implemented Behavior:**
    *   When loading `/assess/:token/test`, the page reads session token from storage and calls `get-assessment`.
    *   It restores the exact state from local storage: `answers`, `currentIndex`, and `flaggedQuestions`.
    *   If the assessment status in DB is `'in_progress'` and progress exists locally, the page opens `ResumeOrRestartModal`.
        *   **Resume:** Dismisses modal and syncs any unsaved offline responses. Remaining timer duration is recalculated relative to the original `started_at` timestamp.
        *   **Restart:** Calls `restartAssessment` Edge Function. This resets answers, increments attempt count to `2`, clears local storage data, and navigates back to landing page.
    *   If status is `'submitted'`, `'completed'`, or `'evaluating'`, the candidate is redirected to `/assess/:token/submitted` to prevent retakes.

### E. Duplicate Submission Prevention
*   **Implemented Behavior:**
    *   The `submit-assessment` Edge Function attempts to update the assessment status to `'submitted'`:
        ```sql
        UPDATE assessments SET status = 'submitted' WHERE id = :id AND status IN ('ready', 'in_progress')
        ```
    *   If a row is updated, it triggers grading.
    *   If no row is updated (meaning it was already submitted):
        *   Checks assessment status. If status is `submitted`, `evaluating`, or `completed`, it returns success idempotently:
            `{"success": true, "data": {"submitted": true, "submittedAt": "..."}}`.
        *   If in any other state (e.g. `'failed'`), it returns `ASSESSMENT_NOT_ACTIVE` (409).

### F. Plan-Limit Enforcement
*   **Implemented Behavior:**
    *   When the candidate hits the `AssessmentLanding` page, the frontend selects `assessments_used` and `assessments_limit` from `profiles` table.
    *   If `used >= limit` (e.g., 10 >= 10 on Starter), the page immediately navigates the candidate to `/assessment-unavailable`.
    *   *Note: This check occurs before candidate registration. The recruiter is notified of link limits on their dashboard when `isOverLimit` is evaluated.*

### G. PDF Generation Retry Logic
*   **Implemented Behavior:**
    *   If PDF generation fails, the function catches the error and checks `pdf_generation_attempts`.
    *   If `attempts < 1`:
        *   Increments `pdf_generation_attempts` to 1.
        *   Resets `pdf_status` to `'pending'` and logs `pdf_error`.
        *   Waits 2000ms and re-invokes the `generate-pdf` Edge Function asynchronously.
    *   If `attempts >= 1` (retry failed):
        *   Marks the `pdf_status` as `'failed'` and logs the error.
        *   Inserts a notification of type `pdf_generation_failed` to the recruiter.

### H. Admin Approval Flow (Generic vs Company Domain)
*   **Implemented Behavior:**
    *   The trigger function `handle_new_user` on `auth.users` evaluates the signup email domain:
        *   **Generic domains:** Matches `'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'live.com', 'msn.com'`. Sets `profiles.account_status` to `'pending_approval'`.
        *   **Company domains:** Anything not matching the generic array. Sets `profiles.account_status` to `'approved'` directly.

### I. Token-Based Candidate Access
*   **Implemented Behavior:**
    *   **Expiration:** If `jobs.link_expires_at <= now()`, access is blocked, and the candidate is redirected to `/assess/expired`.
    *   **Max Uses:** If `jobs.link_max_uses` is defined and `jobs.link_use_count >= jobs.link_max_uses`, access is blocked, and the candidate is redirected to `/assessment-unavailable` or `/assess/expired`.
    *   **Single-use vs Reusable:** The link is reusable by multiple candidates up to the `link_max_uses` limit. However, a single candidate (tracked by email) is restricted:
        *   If they have an active assessment (`pending`, `ready`, or `in_progress`), they are returned to that active attempt.
        *   If they have a completed assessment and `allow_retakes` is false, they are blocked with a `409` error ("Assessment already taken") and redirected to `/assess/taken`.

---

## 9. Testing Checklist Seed

Use this checklist as a starting point for building end-to-end integration and automated tests.

### Phase 1: Authentication & Onboarding
*   [ ] Test recruiter signup with a company domain (verify auto-approved status).
*   [ ] Test recruiter signup with a generic Gmail domain (verify pending approval status).
*   [ ] Test verification cooldown rate limits (must reject multiple requests in under 60 seconds).
*   [ ] Test verification token expiration (must reject clicks after 24 hours).
*   [ ] Verify `verify_email_with_token` RPC correctly clears token columns on success.
*   [ ] Verify `AdminRoute` successfully restricts standard recruiters from accessing admin approvals.
*   [ ] Verify admin approve/reject actions change `account_status` and update recruiter access.

### Phase 2: Job Creation & Link Validity
*   [ ] Create a job and verify the schema limits for `min_score_threshold` (must reject values outside 50-90).
*   [ ] Test candidate access with expired job token (verify redirect to `/assess/expired`).
*   [ ] Test candidate access with maxed-out link uses (verify redirect to `/assessment-unavailable`).
*   [ ] Test link open logging (verify a row is added to `link_opens` table on visit).

### Phase 3: Assessment Session & Question Prep
*   [ ] Verify `start-assessment` correctly blocks retakes when `allow_retakes` is false.
*   [ ] Verify `start-assessment` allows retakes and increments attempt count when `allow_retakes` is true.
*   [ ] Test question generation cache hit (verify matching questions use cache instead of AI call).
*   [ ] Test question generation fallback chain (simulate Gemini failure -> verify DeepSeek OpenRouter takes over).
*   [ ] Test question generation absolute failure (simulate all model failures -> verify status is `'failed'` and recruiter gets notification).

### Phase 4: Test Taking & Integrity
*   [ ] Verify assessment timer duration calculation (must remain accurate on browser refreshes).
*   [ ] Test real-time save: answer question -> verify response row updates in DB.
*   [ ] Test offline queue saving: disable internet -> answer questions -> verify local storage queue -> restore internet -> verify sync.
*   [ ] Test anti-cheat tab switches: switch tabs 3 times -> verify assessment `is_flagged` status is set to true.
*   [ ] Test anti-cheat copy/paste prevention (verify paste events are blocked and registered).
*   [ ] Test assessment restart option: trigger restart -> verify responses deleted and attempt number is 2.

### Phase 5: Submission & Evaluation
*   [ ] Verify duplicate submit prevention: trigger simultaneous submissions -> verify one success and one safe idempotent response.
*   [ ] Test automatic submit when timer expires.
*   [ ] Test evaluation fallback: simulate AI evaluation failure -> verify transition to `'pending_review'` and dispatcher of pending review email.
*   [ ] Verify confidence score deductions for anti-cheat switches (must subtract score for tab switches/paste attempts).
*   [ ] Test Stripe webhook events: mock checkout completed -> verify tier upgrade / training purchase insertion.
*   [ ] Verify plan limits boundary: recruiter reaches 10 assessments -> try launching 11th assessment (must redirect to `/assessment-unavailable`).
*   [ ] Test PDF generation retry logic: force PDFShift error on first attempt -> verify auto-retry -> verify failure notification if retry fails.
