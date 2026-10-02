# 01. System Overview & Technology Stack

SkillGate is an AI-powered technical pre-screening and candidate assessment platform built with React 19, Supabase (PostgreSQL, Row-Level Security, Edge Functions), Stripe, and multiple AI providers. It automates candidate pre-screening through role-tailored technical evaluations while preserving audit trails and hiring signals for recruiters.

---

## 1. Product Summary & Problem Statement

### The Problem
In technical recruitment, engineering teams and recruiters face a persistent dilemma:
1. **Manual Screening Bottleneck**: Engineering managers and senior engineers spend 15–30 minutes per candidate reviewing initial submissions, code samples, or conducting phone screens. This does not scale during high-volume hiring cycles.
2. **Shallow Resume Screening & Keyword Filters**: Traditional Applicant Tracking Systems (ATS) rely on keyword matching, which penalizes unconventional backgrounds and is easily gamed by resume tailoring without measuring actual technical competence.
3. **Black-Box Rejections**: Candidates receive generic rejection emails with zero feedback on weak areas, creating poor candidate experiences.
4. **Assessment Integrity & Cheating**: Unproctored online assessments are prone to copy-pasting, multi-tab browsing, and external AI assistance.

### The SkillGate Solution
SkillGate replaces manual screening with an automated, role-specific screening gate:
- Recruiters define a job description and required skills.
- The system generates an 8-question timed technical assessment (5 multiple-choice questions for foundational knowledge, 3 open-ended text questions for technical problem-solving and architectural depth).
- Candidates complete the assessment through a secure, timed link with real-time anti-cheat monitoring (tab-switch tracking, copy/paste blocking).
- Candidate responses are evaluated by an automated scoring pipeline using multi-model AI fallback (Gemini Flash $\rightarrow$ GPT-OSS $\rightarrow$ Groq Llama 3.3).
- Recruiters receive structured hiring signals, skill radar charts, executive summaries, and downloadable PDF reports.
- Candidates receive instant feedback breakdowns, skill competency scores, and an optional personalized AI training roadmap.

---

## 2. User Roles & System Entry Points

| Role | Description | Authentication & Access Gate | Primary Entry Points |
| :--- | :--- | :--- | :--- |
| **Recruiter** | Creates job listings, distributes assessment tokens, reviews candidate scores, downloads PDF reports, manages billing and team settings. | Supabase Auth (`email` + `password`), guarded by `ProtectedRoute.jsx`. Requires: <br>1. Valid session<br>2. `profiles.email_verified = true`<br>3. `profiles.is_onboarded = true`<br>4. `profiles.account_status = 'approved'` | `/auth` (Login/Signup)<br>`/verify-email`<br>`/onboarding`<br>`/dashboard` |
| **Candidate** | Completes timed assessments, reviews scores and question feedback, downloads assessment reports, purchases growth roadmaps. | No Supabase Auth account. Authenticated via a signed **HMAC-SHA256 Assessment Session Token** issued by `start-assessment` and stored in browser `sessionStorage`. | `/r/:token` (Short redirect link)<br>`/assess/:token` (Assessment landing)<br>`/assess/:token/test` (Assessment interface) |
| **Admin** | Approves or rejects recruiter signups from generic/consumer email domains (`gmail.com`, `yahoo.com`, etc.). | Supabase Auth session where `profiles.is_admin = true`, guarded by `AdminRoute.jsx`. | `/auth` (Login)<br>`/admin/approvals` (Approval table) |

---

## 3. Technology Stack & Design Rationale

```
+-----------------------------------------------------------------------------+
|                               Frontend Layer                                |
|  React 19 (SPA) + Vite 7 + Tailwind CSS 4 + TanStack Query 5 + Recharts     |
+-----------------------------------------------------------------------------+
                                       |
                   HTTP / REST / Signed JWTs / WebSockets
                                       |
+-----------------------------------------------------------------------------+
|                          API & Edge Runtime Layer                           |
|       18 Deno TypeScript/JavaScript Edge Functions on Supabase Edge         |
+-----------------------------------------------------------------------------+
         |                       |                     |             |
+-----------------+   +--------------------+   +-------------+ +-------------+
| Database Layer  |   | AI Provider Chain  |   | Third-Party | | Storage     |
| Supabase Postg- |   | Primary: Gemini    |   | Resend      | | Supabase    |
|   reSQL 15      |   | Fallback: GPT-OSS  |   | Stripe      | | Storage     |
| RLS + 10 RPCs   |   | Fallback: Groq     |   | PDFShift    | | (reports,   |
| 12 Tables       |   |                    |   |             | |  logos)     |
+-----------------+   +--------------------+   +-------------+ +-------------+
```

### Frontend Architecture
- **React 19.2.0** (`package.json`): Provides the component foundation. Uses React 19 hooks and functional components throughout. [EVIDENT]
- **Vite 7.2.2** (`vite.config.js`): High-speed build tool and development server. Replaces traditional Webpack bundling, enabling route-based code splitting via `React.lazy` (`src/routes/index.jsx`), which reduced the main production bundle from 1.2 MB to 507 KB (commit `5a706c2`). [EVIDENT]
- **Tailwind CSS 4.2.4** (`package.json`): Provides utility-first styling with custom CSS variables (`src/index.css`) for dark-theme UI design tokens (`--color-bg-primary: #0B0F14`, `--color-accent: #6366F1`). [EVIDENT]
- **TanStack React Query v5.101.0** (`src/lib/queryClient.js`, `src/hooks/queries/`): Manages server state, caching, optimistic UI updates, and background invalidation for recruiter views (candidates, jobs, analytics, notifications). Replaced legacy manual `useEffect` fetch loops in commit `fcbea25`. [EVIDENT]
- **React Router v7.14.2** (`src/routes/index.jsx`): Manages application routing, layout nesting (`RecruiterLayout.jsx`), and navigation guards (`ProtectedRoute.jsx`, `PublicRoute.jsx`, `AdminRoute.jsx`). [EVIDENT]
- **Recharts 3.8.1** (`src/components/assessment/SkillRadarChart.jsx`, `src/pages/recruiter/analytics/RecruiterAnalytics.jsx`): Renders SVG radar charts for candidate skill visualization and analytics bar/pie charts. [EVIDENT]
- **react-hot-toast 2.6.0** (`src/App.jsx`): Lightweight toast notification engine used for autosave status, copy feedback, anti-cheat warnings, and mutation errors. [EVIDENT]

### Backend & Persistence Layer
- **Supabase PostgreSQL 15** (`remote_schema.sql`): Relational data store enforcing referential integrity, foreign key cascading/restricting, unique indexes, and schema check constraints. [EVIDENT]
- **Row-Level Security (RLS)** (`remote_schema.sql`): Enforces tenant isolation directly at the database engine level. Authenticated recruiters can only read/write their own records (`auth.uid() = recruiter_id`). Direct anonymous writes to core assessment tables are denied. [EVIDENT]
- **PostgreSQL Database Functions (RPCs)** (`remote_schema.sql`): Stored procedures execute atomic operations inside database transactions:
  * `increment_assessments_used`: Atomically increments a recruiter's usage count.
  * `increment_job_link_use_count`: Atomically increments and bounds candidate link usage.
  * `lock_assessment_question_generation`: Atomic concurrency lock preventing duplicate question generation.
  * `insert_questions_and_mark_ready`: Atomically stores 8 questions and transitions status to `ready`.
  * `verify_email_with_token`: Validates 24-hour verification tokens and updates verification status atomically.
- **Supabase Realtime** (`src/layouts/RecruiterLayout.jsx`): PostgreSQL change-data-capture (CDC) channel subscribing to inserts on `notifications` table filtered by `recruiter_id=eq.${user.id}`, invalidating React Query caches instantly. [EVIDENT]
- **Supabase Storage** (`003_storage_buckets.sql`):
  * `reports`: Private storage bucket storing candidate evaluation PDF reports, accessible strictly through short-lived signed URLs.
  * `logos`: Public storage bucket for recruiter company logos.

### Edge Runtime & Business Logic Layer
- **Supabase Edge Functions (Deno Runtime)** (`supabase/functions/`): 18 serverless functions running at the edge. Edge Functions encapsulate all privileged operations requiring the PostgreSQL `service_role` key, external API secrets, and AI provider orchestration. [EVIDENT]
- **Candidate Session JWTs (HMAC-SHA256 via `jose`)** (`supabase/functions/_shared/sessionToken.ts`): Candidates do not create Supabase Auth accounts. Instead, `start-assessment` signs an HS256 JWT payload containing `{ assessmentId, candidateId, issuedAt, expiresAt }` with a 4-hour lifespan using `SESSION_SIGNING_SECRET`. Every candidate edge function validates this token before mutating assessment data. [EVIDENT]

### AI Provider Orchestration & Fallback Chain
- **Primary: Google Gemini 2.5 Flash** (`supabase/functions/_shared/ai.js`): Fast, cost-efficient model with a 20-second timeout. Handles question generation and text-answer rubric scoring. [EVIDENT]
- **Secondary Fallback: OpenRouter (`openai/gpt-oss-120b:free`)** (`supabase/functions/_shared/ai.js`): Open-source LLM fallback invoked if Gemini times out or returns HTTP errors, configured with a 100-second timeout. [EVIDENT]
- **Tertiary Fallback: Groq (`llama-3.3-70b-versatile`)** (`supabase/functions/_shared/ai.js`): Ultra-low-latency Llama 3.3 model on Groq LPU hardware with a 40-second timeout and strict JSON object enforcement. [EVIDENT]
- **Escalation Protocol**: If all 3 AI providers fail during candidate evaluation, the system raises an `EvaluationFailedError`, transitions assessment status to `'pending_review'`, inserts an `evaluation_pending_review` notification, and sends an alert email to the recruiter for manual scoring. [EVIDENT]

### Third-Party Services
- **Resend** (`supabase/functions/send-email/`, `supabase/functions/send-verification-email/`): Transactional email delivery service for recruiter email verification, candidate score reports, recruiter completion alerts, and payment failure notifications. Includes automatic single-retry logic (`retrySend`). [EVIDENT]
- **Stripe** (`supabase/functions/create-checkout/`, `supabase/functions/stripe-webhook/`): Handles recruiter tiered subscriptions (`starter`, `growth`, `scale`) and candidate training plan purchases ($9.00) via Stripe Checkout sessions and cryptographic webhook verification. [EVIDENT]
- **PDFShift** (`supabase/functions/generate-pdf/`): Headless Chrome HTML-to-PDF REST API converting styled HTML reports into A4 PDF documents. [EVIDENT]
- **Vercel** (`vercel.json`): Hosts the production React SPA with URL rewrite rules redirecting short links (`/r/:token`) to the `redirect-link` Edge Function for click tracking. [EVIDENT]

---

## 4. Architectural Design Rationale Summary

| Architectural Decision | Implementation Pattern | Codebase Rationale & Evidence |
| :--- | :--- | :--- |
| **Candidate Auth without Supabase Users** | Signed HS256 JWT in `sessionStorage` (`sessionToken.ts`) | **[EVIDENT]** Candidates are transient users who must not pollute `auth.users`. Creating auth accounts introduces registration friction that hurts assessment completion rates. |
| **Edge Functions over Direct Table Writes** | Service-role Edge Functions (`supabase/functions/`) | **[EVIDENT]** (Commit `a47f84c` & `72cbe6e`): Direct anonymous database writes were locked down to prevent candidates from modifying scores, manipulating timers, or injecting unauthorized question rows. |
| **Multi-Provider AI Fallback** | Gemini $\rightarrow$ GPT-OSS $\rightarrow$ Groq (`_shared/ai.js`) | **[EVIDENT]** Eliminates single-point-of-failure risk from upstream AI provider outages or rate limits during live candidate assessments. |
| **Asynchronous PDF & Summary Pipelines** | Background worker invocation (`EdgeRuntime.waitUntil`) | **[EVIDENT]** (`submit-assessment/index.ts` L120–138): Submitting an assessment must return immediately (< 500ms) to the candidate browser; heavy LLM evaluation and PDF generation run asynchronously in the background. |
| **Deterministic + AI Hybrid Scoring** | Code-based MCQ grading + LLM Text grading (`evaluate-responses/index.ts`) | **[EVIDENT]** MCQ questions are graded deterministically in TypeScript for 100% accuracy; open-ended questions use LLMs with structured JSON rubrics and strict clamping (0.0 to 1.0). |
| **Domain-Based Recruiter Approval Gate** | PostgreSQL trigger on `auth.users` (`remote_schema.sql` L99) | **[EVIDENT]** Company domains (`@company.com`) are auto-approved; generic domains (`@gmail.com`) require platform admin verification to prevent spam and resource exhaustion. |
