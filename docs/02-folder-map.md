# 02. Codebase Folder Map & Code Reading Guide

This document maps every directory, key module, and architectural layer in SkillGate, explaining its primary responsibilities and providing an onboarding roadmap for technical interviews and codebase navigation.

---

## 1. Directory Tree & Responsibilities

```text
SkillGate-B/
├── .env.example                     Template for frontend environment variables
├── .env.local                       Active local frontend env (gitignored, contains VITE_* variables)
├── index.html                       HTML entry point; mounts React root and loads Google Fonts
├── package.json                     Dependencies (React 19, TanStack Query 5, Tailwind 4, Recharts)
├── remote_schema.sql                Authoritative database schema: tables, RLS, triggers, stored RPCs
├── vercel.json                      Vercel deployment rules and /r/:token proxy rewrite
├── vite.config.js                   Vite build configuration with @tailwindcss/vite plugin
├── public/                          Static assets, logos, and screenshots
│   └── screenshots/                 UI walkthrough screenshots used in README
├── docs/                            System architecture, audit, and interview documentation
├── src/                             React 19 frontend source code
│   ├── App.jsx                      Root application component; mounts QueryClientProvider & Toaster
│   ├── main.jsx                     DOM entry point; renders App into #root
│   ├── index.css                    Tailwind 4 imports and CSS custom properties (color tokens)
│   ├── assets/                      Vector icons, illustrations, brand assets
│   ├── components/                  Reusable visual UI elements and route guards
│   │   ├── AdminRoute.jsx           Route guard: checks isAuthenticated && isAdmin
│   │   ├── ErrorBoundary.jsx        Class-based root error boundary with reload fallback
│   │   ├── ProtectedRoute.jsx       Recruiter route guard: 6-stage sequential verification
│   │   ├── PublicRoute.jsx          Guest route guard: redirects logged-in users away from /auth
│   │   ├── SectionErrorBoundary.jsx Isolated component boundary to prevent chart/table cascades
│   │   ├── assessment/              Candidate test interface UI components
│   │   │   ├── AssessmentTimer.jsx  Sticky countdown timer widget with progress indicator
│   │   │   ├── MCQQuestion.jsx      Radio-button option list for multiple-choice questions
│   │   │   ├── ProgressDots.jsx     Numbered question pagination bar showing answered/flagged
│   │   │   ├── SkillRadarChart.jsx  Lazy-loaded Recharts Radar chart displaying skill scores
│   │   │   └── TextQuestion.jsx     Textarea input with paste-blocking and character limits
│   │   ├── recruiter/               Recruiter dashboard-specific components
│   │   │   ├── CandidateRow.jsx     Candidate list item in JobDetail table with status actions
│   │   │   ├── JobCard.jsx          Summary card for jobs in AllJobs and Dashboard
│   │   │   ├── JobQrCode.jsx        QR code generator component for public job assessment links
│   │   │   ├── OnboardingChecklist.jsx Stepper widget guiding new recruiters through setup
│   │   │   └── UpgradeBanner.jsx    Warning banner displayed when assessment quota exceeds 80%
│   │   └── ui/                      Design-system primitives
│   │       ├── Badge.jsx            Status pill with variant colors (success, warning, error, info)
│   │       ├── Button.jsx           Button component supporting variants, sizes, and spinner states
│   │       ├── Card.jsx             Container surface with dark theme borders and padding
│   │       ├── EmptyState.jsx       Fallback placeholder for empty tables and candidate lists
│   │       ├── Input.jsx            Standardized styled text inputs with error state labels
│   │       ├── LoadingSpinner.jsx   Animated SVG spinner with size variants (sm, md, lg)
│   │       ├── Modal.jsx            Accessible backdrop dialog with Esc key support
│   │       └── SkeletonCard.jsx     Pulsing skeleton loader cards for TanStack Query states
│   ├── config/                      Configuration clients
│   │   └── supabase.js              Initializes Supabase browser client with anon key
│   ├── constants/                   Static application definitions
│   │   ├── assessment.js            Question types, point brackets (10, 20, 30), question count (8)
│   │   ├── limits.js                Subscription tier limits (Starter: 10, Growth: 100, Scale: 500)
│   │   └── status.js                Enum definitions for assessments, candidates, and jobs
│   ├── context/                     React Context providers
│   │   └── AuthContext.jsx          Global recruiter auth state, profile data, login, logout, refresh
│   ├── hooks/                       Custom React hooks
│   │   ├── useAntiCheat.js          Monitors visibilitychange, tracks tab switches, blocks paste/cut
│   │   ├── useAssessmentTimer.js    Countdown hook calculating elapsed time from server started_at
│   │   ├── useAuth.js               Convenience hook consuming AuthContext
│   │   └── queries/                 TanStack Query query and mutation hooks
│   │       ├── useAdminQuery.js     Admin recruiter approvals query and mutation hooks
│   │       ├── useAnalyticsJobsQuery.js Job list selector for RecruiterAnalytics dropdown
│   │       ├── useAnalyticsQuery.js Aggregated recruiter metrics (pass rates, completion rates)
│   │       ├── useCandidateDetailsQuery.js Candidate profile breakdown and question results
│   │       ├── useCandidatesQuery.js Candidate table queries, status toggles, and bulk actions
│   │       ├── useDashboardQuery.js Recruiter home dashboard summary metrics and activity
│   │       ├── useJobDetailsQuery.js Job metadata, candidate counts, and active link status
│   │       ├── useJobsQuery.js      Jobs list query and active/inactive toggle mutations
│   │       ├── useNotificationsQuery.js Realtime notifications, unread count, mark-read mutations
│   │       └── useOnboardingStatusQuery.js Checks recruiter onboarding and company profile status
│   ├── layouts/                     Layout shells
│   │   └── RecruiterLayout.jsx      Dashboard sidebar, header, quota indicator, realtime alerts
│   ├── lib/                         Utility wrappers
│   │   ├── queryClient.js           TanStack QueryClient instance (default staleTime: 30s)
│   │   └── supabase.js              Re-exports supabase client from @/config/supabase
│   ├── pages/                       Route-level view components
│   │   ├── LandingPage.jsx          Public marketing page highlighting features and pricing
│   │   ├── NotFound.jsx             404 fallback page
│   │   ├── PendingApprovalPage.jsx  Gate page for recruiters registered with generic email domains
│   │   ├── RejectedPage.jsx         Gate page for rejected recruiter accounts
│   │   ├── assessment/              Candidate test-taking views
│   │   │   ├── AssessmentAlreadyTaken.jsx Rendered when retakes are disabled and test is complete
│   │   │   ├── AssessmentExpired.jsx Rendered when job link is deactivated or expires
│   │   │   ├── AssessmentLanding.jsx Candidate details form, token validation, quota check
│   │   │   ├── AssessmentPage/      Main test runner sub-tree
│   │   │   │   ├── AssessmentHeader.jsx Top bar with job title, candidate name, timer, save badge
│   │   │   │   ├── NavigationControls.jsx Previous, Next, Flag question, and Submit buttons
│   │   │   │   ├── QuestionContainer.jsx Renders MCQQuestion or TextQuestion depending on type
│   │   │   │   ├── ResumeOrRestartModal.jsx Crash-recovery dialog (Resume vs. Restart)
│   │   │   │   └── index.jsx        Orchestrates question state, timer, autosave, offline queue
│   │   │   ├── AssessmentResult.jsx Candidate score breakdown, radar chart, PDF download, roadmap
│   │   │   └── AssessmentSubmitted.jsx Submission confirmation page with polling for evaluation
│   │   ├── auth/                    Recruiter authentication views
│   │   │   ├── RecruiterAuthPage.jsx Tabbed login and signup form with Supabase Auth
│   │   │   ├── RecruiterOnboarding.jsx Company name, website, and work email registration form
│   │   │   ├── ResetPasswordPage.jsx Password recovery form via Supabase Auth reset tokens
│   │   │   ├── VerifyEmailConfirmPage.jsx Consumes ?token=... via verify_email_with_token RPC
│   │   │   └── VerifyEmailPage.jsx  Notice page prompting recruiter to check inbox for link
│   │   ├── candidate/               Candidate-specific error views
│   │   │   └── AssessmentUnavailable.jsx Shown when recruiter plan quota (assessments_limit) is full
│   │   ├── demo/                    Interactive demo assessment views for prospective users
│   │   │   ├── DemoAssessment.jsx   Mock assessment flow with predefined questions
│   │   │   ├── DemoLanding.jsx      Demo start page
│   │   │   └── DemoResult.jsx       Mock score report and roadmap preview
│   │   └── recruiter/               Authenticated recruiter administrative pages
│   │       ├── RecruiterDashboard.jsx Overview metrics, quota meters, and recent candidate activity
│   │       ├── admin/
│   │       │   └── AdminApprovalsPage.jsx Admin table to approve/reject pending recruiters
│   │       ├── analytics/
│   │       │   └── RecruiterAnalytics.jsx Visual hiring funnel, score distribution, weak skills
│   │       ├── billing/
│   │       │   ├── BillingPage.jsx  Current plan status, assessment usage meter, Stripe portal
│   │       │   └── PlansPage.jsx    Subscription tier cards (Starter, Growth, Scale) with Stripe
│   │       ├── candidates/
│   │       │   └── CandidateProfile.jsx Comprehensive question-by-question scoring, AI rationale
│   │       ├── dashboard/
│   │       │   └── RecruiterDashboard.jsx Alternative dashboard import path
│   │       ├── jobs/
│   │       │   ├── AllJobs.jsx      Filterable list of all recruiter jobs with link copying
│   │       │   ├── CreateJob.jsx    Job creation wizard (title, skills, pass score, expiration)
│   │       │   ├── JobCreatedSuccess.jsx Post-creation confirmation with shareable links & QR code
│   │       │   ├── JobDetail.jsx    Detailed job view with candidate table, status filters, CSV
│   │       │   └── JobSettings.jsx  Edit job parameters, reset link token, danger-zone deletion
│   │       ├── notifications/
│   │       │   └── NotificationsPage.jsx Filterable notification feed with mark-as-read actions
│   │       └── settings/
│   │           └── RecruiterSettings.jsx Recruiter profile, company details, email notification toggles
│   ├── routes/                      Routing layer
│   │   └── index.jsx                Central React Router 7 route definitions with lazy imports
│   ├── services/                    API and database communication layer
│   │   ├── apiClient.js             Base wrapper normalizing Supabase queries and error structures
│   │   ├── assessment/              Candidate assessment API clients
│   │   │   ├── assessmentService.js Validates tokens, starts sessions, manages sessionStorage
│   │   │   ├── responseService.js   Autosaves answers, records anti-cheat events, submits tests
│   │   │   └── resultService.js     Fetches candidate results, polls evaluation, signed PDF URLs
│   │   ├── auth/                    Recruiter authentication API client
│   │   │   └── authService.js       SignUp, signIn, signOut, resetPassword, profile operations
│   │   └── recruiter/               Recruiter data access layer
│   │       ├── adminService.js      Approves/rejects recruiter profiles via Supabase RLS
│   │       ├── analyticsService.js  Calculates score distribution, funnel stages, weak skills
│   │       ├── billingService.js    Calls create-checkout Edge Function for Stripe Checkout
│   │       ├── candidateService.js  Updates candidate statuses, triggers evaluation retries
│   │       ├── createJobService.js  Persists new jobs in Supabase with random link tokens
│   │       ├── dashboardService.js  Aggregates metrics for recruiter dashboard cards
│   │       ├── jobSettingsService.js Updates job configurations and resets link tokens
│   │       ├── jobsService.js       Queries jobs, calculates pass rates, exports candidate CSVs
│   │       ├── notificationService.js Fetches notifications, counts unread, marks read
│   │       ├── recruiterService.js  Common profile queries and workspace settings
│   │       └── recruiterSettingsService.js Persists company metadata and alert preferences
│   └── utils/                       Helper functions
│       └── helpers.js               Formatting utilities (dates, durations, percentages)
└── supabase/                        Supabase configuration and backend code
    ├── config.toml                  Local Supabase CLI configuration
    ├── migrations/                  11 historical migration files documenting schema evolution
    └── functions/                   18 Supabase Edge Functions (Deno runtime)
        ├── _shared/                 Common Edge Function libraries
        │   ├── ai.js                Multi-provider AI caller (Gemini -> GPT-OSS -> Groq)
        │   ├── cache.js             PostgreSQL cache table operations for AI questions
        │   ├── constants.js         System constants and fallback templates
        │   ├── rateLimit.js         Per-day rate limit counter using increment_ratelimit RPC
        │   ├── response.js          Standardized JSON response headers and formatters
        │   ├── sessionToken.ts      HMAC-SHA256 JWT signing and verification for candidate sessions
        │   ├── utils.ts             Service role client factory, JSON logging, error formatters
        │   └── validate.js          Payload shape and UUID validation helpers
        ├── create-checkout/         Creates Stripe Checkout sessions for subscription upgrades
        ├── evaluate-responses/      Grades MCQs and text answers with AI, flags suspicious answers
        ├── generate-pdf/            Renders HTML assessment report and converts to PDF via PDFShift
        ├── generate-questions/      Generates 8 role-specific questions with AI and validates schema
        ├── generate-summary/        Creates candidate feedback, executive summary, and roadmap
        ├── get-assessment/          Returns candidate questions and timer state for valid session
        ├── get-candidate-result/    Returns candidate-safe results payload without recruiter notes
        ├── get-job-by-token/        Public endpoint validating token and returning job details
        ├── get-pdf-url/             Generates 48-hour signed Supabase Storage URL for PDF report
        ├── record-assessment-event/ Logs tab switches and paste attempts with anti-cheat counters
        ├── redirect-link/           Hashes client IP/UA, logs open to link_opens, redirects to test
        ├── restart-assessment/      Wipes responses and resets attempt number to 2 for retries
        ├── save-response/           Autosaves individual question answers with server time check
        ├── send-email/              Dispatches result emails and review alerts via Resend API
        ├── send-verification-email/ Sends account verification email with 60-second cooldown
        ├── start-assessment/        Registers candidate, creates assessment row, signs session JWT
        ├── stripe-webhook/          Processes Stripe subscription updates, cancellations, purchases
        └── submit-assessment/       Atomically marks assessment submitted, schedules evaluation
```

---

## 2. Where to Start Reading: Feature-by-Feature Guide

### 1. Recruiter Authentication & Approval Flow
Understand how recruiters register, verify emails, go through onboarding, and get gated based on their email domain:
1. `src/pages/auth/RecruiterAuthPage.jsx`: The signup/login UI. Note how `register()` in `src/services/auth/authService.js` signs up with Supabase Auth and triggers `send-verification-email`.
2. `supabase/functions/send-verification-email/index.ts`: Inspect the 60-second cooldown check and token generation.
3. `src/pages/auth/VerifyEmailConfirmPage.jsx`: See how the email link executes `verify_email_with_token` RPC (`remote_schema.sql` L295).
4. `src/context/AuthContext.jsx`: Inspect `isEmailVerified`, `isOnboarded`, `isPendingApproval`, `isRejected`.
5. `src/components/ProtectedRoute.jsx`: Inspect the strict 6-stage redirect waterfall.
6. `src/pages/recruiter/admin/AdminApprovalsPage.jsx`: Inspect admin approval actions.

### 2. Job Creation & Public Link Distribution
Understand how a recruiter configures an assessment and distributes short links:
1. `src/pages/recruiter/jobs/CreateJob.jsx`: Form capturing skills, pass threshold, retakes, and expiration.
2. `src/services/recruiter/createJobService.js`: Generates random link token and inserts into `jobs`.
3. `src/pages/recruiter/jobs/JobCreatedSuccess.jsx` & `src/components/recruiter/JobQrCode.jsx`: Displays `/r/:token` and QR code.
4. `vercel.json`: Rewrites `/r/:token` to `redirect-link` Edge Function.
5. `supabase/functions/redirect-link/index.ts`: Hashes IP, logs to `link_opens`, validates expiration, and redirects to `/assess/:token`.

### 3. Candidate Assessment Lifecycle (Start $\rightarrow$ Take $\rightarrow$ Submit)
Follow the candidate through authentication, test taking, offline resilience, and submission:
1. `src/pages/assessment/AssessmentLanding.jsx`: Candidate submits name and email; calls `startAssessment()`.
2. `supabase/functions/start-assessment/index.ts`: Inspect candidate upsert, check for active attempt, question generation locking, and HS256 session JWT signing (`sessionToken.ts`).
3. `src/pages/assessment/AssessmentPage/index.jsx`: The central test engine:
   - Reads session token from `sessionStorage`.
   - Mounts `useAssessmentTimer.js` and `useAntiCheat.js`.
   - `triggerSaveResponse`: Saves answers to `save-response` Edge Function with versioning.
   - `flushPendingQueue`: Recovers unsaved answers from `localStorage` upon reconnect.
   - `ResumeOrRestartModal.jsx`: Handles browser crash recovery.
4. `supabase/functions/save-response/index.ts`: Enforces session JWT validation, question ownership, and server-side timer window.
5. `supabase/functions/submit-assessment/index.ts`: Atomically updates status to `'submitted'`, invokes `increment_assessments_used`, and triggers background evaluation via `EdgeRuntime.waitUntil`.

### 4. AI Question Generation & Evaluation Pipeline
Understand the multi-provider LLM chain and evaluation rubric:
1. `supabase/functions/_shared/ai.js`: Inspect `callGemini`, `callDeepSeek` (OpenRouter GPT-OSS), and `callGroq`, plus `parseJSON`.
2. `supabase/functions/generate-questions/index.ts`: Prompt formatting, schema validation (5 MCQ + 3 Text = 8 total), and database insertion via `insert_questions_and_mark_ready`.
3. `supabase/functions/evaluate-responses/index.ts`:
   - Deterministic MCQ scoring (100% code-based).
   - AI text evaluation with 0.0–1.0 score clamping, feedback, and missed concepts.
   - Retry logic (1 retry after 1000ms).
   - Escalation to `pending_review` and `evaluation_pending_review` notification if all AI models fail.
4. `supabase/functions/generate-summary/index.ts`: Asynchronously generates executive summary, strengths, weaknesses, hiring signal, and candidate training plan.

### 5. Candidate Results, AI Roadmap & PDF Generation
How candidate score reports and shareable PDFs are delivered:
1. `src/pages/assessment/AssessmentSubmitted.jsx`: Polls `get-candidate-result` until status transitions to `'completed'`.
2. `src/pages/assessment/AssessmentResult.jsx`: Displays score banner, `SkillRadarChart.jsx`, expandable question feedback, and the AI Growth Roadmap modal.
3. `supabase/functions/generate-pdf/index.ts`: Generates styled HTML report, converts to PDF via PDFShift, uploads to `reports` storage bucket, and handles auto-retries on failure.
4. `supabase/functions/get-pdf-url/index.ts`: Returns a 48-hour signed Supabase Storage URL after validating the candidate session JWT.

### 6. Recruiter Dashboard, Analytics & Candidate Profile
How recruiters monitor hiring metrics and make decisions:
1. `src/pages/recruiter/dashboard/RecruiterDashboard.jsx` & `src/hooks/queries/useDashboardQuery.js`: Recruiter summary metrics and active candidate counts.
2. `src/pages/recruiter/jobs/JobDetail.jsx`: Candidate list with status badges, score threshold comparison, CSV export, and evaluation retry button.
3. `src/pages/recruiter/candidates/CandidateProfile.jsx`: Deep dive into candidate answers, AI evaluation feedback, suspicious flags, and manual review overrides.
4. `src/pages/recruiter/analytics/RecruiterAnalytics.jsx`: Visual funnel analytics, score distributions, and weak skill aggregation across jobs.

### 7. Stripe Billing & Quota Enforcement
How subscriptions, usage limits, and candidate training plan purchases work:
1. `src/pages/recruiter/billing/BillingPage.jsx` & `PlansPage.jsx`: Displays usage quota meters and plan upgrade buttons.
2. `src/services/recruiter/billingService.js`: Calls `create-checkout` Edge Function.
3. `supabase/functions/create-checkout/index.ts`: Resolves or creates Stripe customer and returns Stripe Checkout URL.
4. `supabase/functions/stripe-webhook/index.ts`:
   - Validates Stripe signature via `crypto.subtle` with timing-safe comparison.
   - Handles `checkout.session.completed` for subscriptions and training plans ($9.00).
   - Handles `customer.subscription.deleted` (downgrades to Starter limit 10).
   - Handles `invoice.payment_failed` (triggers failure alert email).
5. `src/pages/assessment/AssessmentLanding.jsx`: Checks recruiter's `assessments_used >= assessments_limit` and redirects over-quota candidates to `/assessment-unavailable`.

### 8. Real-Time Notifications & Anti-Cheat
How integrity is maintained and recruiters are alerted instantly:
1. `src/hooks/useAntiCheat.js`: Tracks `visibilitychange` for tab switches (warns at 1 & 2, flags at 3+), intercepts `copy`, `cut`, and `paste` events.
2. `supabase/functions/record-assessment-event/index.ts`: Optimistically updates `tab_switches` and `paste_attempts` in `assessments` table.
3. `src/layouts/RecruiterLayout.jsx`: Subscribes to Supabase Realtime channel `notifications:${user.id}` and invalidates TanStack Query caches on new notification rows.
