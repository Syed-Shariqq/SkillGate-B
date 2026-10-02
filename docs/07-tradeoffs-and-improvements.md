# 07. System Limitations, Architectural Trade-offs & Scaling Roadmap

This document outlines the architectural trade-offs made in SkillGate, current performance bottlenecks, and prioritized engineering improvements for high-volume enterprise scaling. Every claim is tagged as **[EVIDENT]** (grounded in existing code, comments, or repository artifacts) or **[INFERRED]** (engineering deductions derived from the system architecture).

---

## 1. Architectural Trade-offs & Current Limitations

### 1. Just-In-Time Question Generation vs. Static Question Banks
* **Current Implementation:** When a candidate starts an assessment, `start-assessment` locks the record and triggers `generate-questions` to synthesize 8 questions dynamically via AI. [EVIDENT] (`supabase/functions/start-assessment/index.ts` L218–260)
* **Trade-off:**
  * *Advantage:* Highly customized questions strictly matching the recruiter's exact skill requirements; eliminates question leaks on sites like Glassdoor/LeetCode. [INFERRED]
  * *Disadvantage:* High initial latency (10–25 seconds) while the candidate waits for the AI model to respond and validate, creating friction on test launch. [EVIDENT] (`waitForGeneration` loops up to 30 times with 1-second sleep).
* **V2 Redesign:** Pre-generate a pooled bank of 24–40 validated questions when the recruiter creates the job; randomly sample 8 questions per candidate. This reduces candidate test launch latency from 20 seconds to $< 300\text{ ms}$. [INFERRED]

### 2. Candidate Polling vs. WebSocket Realtime for Results
* **Current Implementation:** When a candidate completes a test, `AssessmentSubmitted.jsx` polls `get-candidate-result` every 3 seconds for up to 90 seconds until `status = 'completed'` or `'pending_review'`. [EVIDENT] (`src/services/assessment/resultService.js` L236)
* **Trade-off:**
  * *Advantage:* Simple client-side implementation; immune to transient WebSocket disconnections on mobile networks. [INFERRED]
  * *Disadvantage:* Under high concurrency (e.g. 5,000 university candidates submitting simultaneously), polling generates 15,000–30,000 Edge Function invocations per minute, unnecessarily consuming serverless CPU budget and database connections. [INFERRED]
* **V2 Redesign:** Use Supabase Realtime Postgres CDC subscriptions on `results` table filtered by `assessment_id=eq.${assessmentId}`, pushing the result payload immediately upon completion and eliminating HTTP polling. [INFERRED]

### 3. Synchronous External Conversion vs. Asynchronous PDF Queue
* **Current Implementation:** `generate-pdf` calls the external PDFShift API over HTTP with a 30-second timeout, converts the HTML, and uploads the binary PDF directly within the serverless function execution window. [EVIDENT] (`supabase/functions/generate-pdf/index.ts` L800–856)
* **Trade-off:**
  * *Advantage:* Generates candidate PDFs immediately so candidate result pages can serve signed download links within seconds. [EVIDENT]
  * *Disadvantage:* Third-party latency (PDFShift taking 5–12s) ties up Edge Function execution time. If PDFShift experiences degraded performance, serverless functions can hit Deno execution timeouts. [INFERRED]
* **V2 Redesign:** Offload PDF generation to a message queue (e.g. PostgreSQL `pgmq` or RabbitMQ worker) with a dedicated Chromium cluster (`puppeteer` or `playwright`), decoupling web HTTP cycles from document compilation. [INFERRED]

### 4. Client-Managed Offline Storage Queue
* **Current Implementation:** Answers are stored in browser `localStorage` (`skillgate_answers_${id}`) and pending unsent saves are queued in `skillgate_pending_saves_${id}`. [EVIDENT] (`src/pages/assessment/AssessmentPage/index.jsx` L80–150)
* **Trade-off:**
  * *Advantage:* Zero data loss during Wi-Fi drops; transparent background sync upon reconnect. [EVIDENT]
  * *Disadvantage:* Susceptible to browser storage limits (typically 5 MB per origin) and candidate storage-clearing or aggressive browser incognito privacy settings. [INFERRED]
* **V2 Redesign:** Upgrade from `localStorage` to `IndexedDB` via `idb-keyval` for structured, asynchronous offline persistence with higher capacity and worker thread access. [INFERRED]

---

## 2. Scaling Bottlenecks & Capacity Analysis

```
Bottleneck 1: Database Connection Saturation
  [Edge Function Cluster] ---> Direct Postgres Pool ---> [Max Connections: 60-100]
  Resolution: Enable Supabase PgBouncer (Port 6543) / Supavisor connection pooler.

Bottleneck 2: AI Provider Rate Limits (RPM / TPM)
  [Concurrent Candidate Submissions] ---> Gemini / Groq Rate Limits (e.g. 60 RPM)
  Resolution: Multi-account token rotation and Redis-backed request queuing.

Bottleneck 3: Synchronous Candidate Launch Latency
  [Candidate Start] ---> [Wait 20s for AI Question Generation] ---> [Test UI]
  Resolution: Background question pool generation during job creation.
```

### 1. Database Connection Saturation
* **Observation:** Each Edge Function creates a Supabase client (`createClient()`) that connects to Postgres. Under simultaneous bursts of hundreds of candidate submissions, direct connection limits on starter/pro PostgreSQL instances (typically 60–100 connections) can be exhausted. [INFERRED]
* **Mitigation:** Route all Edge Function database access through Supabase's transaction connection pooler (`Supavisor`, port 6543) with query statement caching enabled. [INFERRED]

### 2. AI Rate Limiting (Tokens Per Minute & Requests Per Minute)
* **Observation:** The primary provider (Gemini 2.5 Flash) and fallback providers (Groq, OpenRouter) enforce strict RPM (Requests Per Minute) and TPM (Tokens Per Minute) quotas on API keys. A sudden surge of 200 candidates starting assessments simultaneously would breach free/tier-1 quotas, cascading all calls to Groq and exhausting the chain. [INFERRED]
* **Mitigation:** Implement distributed rate-limiting using Redis/Upstash tokens, dynamic provider quota balancing, and round-robin API key pools. [INFERRED]

### 3. Anti-Cheat Evasion (Multi-Monitor & External Device Limitations)
* **Observation:** `useAntiCheat.js` monitors `document.visibilityState` for tab switching and intercepts DOM `paste`, `copy`, and `cut` events. [EVIDENT] (`src/hooks/useAntiCheat.js`)
* **Limitation:** It cannot detect candidates viewing secondary monitors, running split-screen tiling window managers, running the test inside a Virtual Machine (VM), or photographing questions with a mobile phone. [INFERRED]
* **Mitigation:** For enterprise, high-stakes assessments, integrate optional WebRTC proctoring: fullscreen lockdown via the Fullscreen API, webcam eye-tracking, and dual-camera verification. [INFERRED]

---

## 3. Version 2.0 Roadmap & Planned Enhancements

The project repository includes a foundational `v2.txt` file outlining key CTO-level priorities. Below is the full engineering roadmap synthesizing `v2.txt` with architectural audit findings:

### 1. Candidate Identity Verification & Anti-Spam (from `v2.txt`)
* **V2 Requirement:** *"Require email verification before assessment starts; OTP to candidate email before allowing assessment access."* [EVIDENT] (`v2.txt` L1–2)
* **Rationale:** Currently, any candidate can enter an arbitrary email address on the assessment landing page. If a candidate inputs a fake email, they consume one of the recruiter's limited subscription assessment credits (`assessments_used`) without an authentic identity. [EVIDENT]
* **Implementation Plan:**
  1. Candidate inputs email on `/assess/:token`.
  2. Edge Function `send-candidate-otp` dispatches a 6-digit numeric OTP via Resend.
  3. Candidate enters OTP; backend verifies hash and only then issues `sessionToken` and creates assessment record.

### 2. IP-Based Candidate Rate Limiting (from `v2.txt`)
* **V2 Requirement:** *"IP-based rate limiting on assessment starts."* [EVIDENT] (`v2.txt` L3)
* **Rationale:** Prevents automated bot scrapers from clicking public links and repeatedly launching assessments, exhausting recruiter quotas and AI API budgets. [INFERRED]
* **Implementation Plan:** Enforce sliding window counter in `rate_limits` table: maximum 3 assessment starts per IP per hour per job token.

### 3. Resume-Based Skill Extraction & Analysis (from `v2.txt`)
* **V2 Requirement:** *"Resume based skill Extraction and Resume Analysis; Smart candidate filtering."* [EVIDENT] (`v2.txt` L4–5)
* **Implementation Plan:**
  1. Recruiter or candidate uploads PDF resume to `resumes` storage bucket.
  2. OCR / text parsing Edge Function extracts verified work history, skills, and seniorities.
  3. Tailors assessment questions directly to resume claims (e.g. testing specific frameworks the candidate claims $\ge 3$ years experience with).
  4. Recruiter candidate profile displays match percentage between resume claims and evaluated assessment scores.

### 4. Custom Verified Sending Domains for Resend
* **Current Limitation:** Email sender is hard-coded to `FROM_EMAIL = "onboarding@resend.dev"`. In Resend sandbox mode, emails cannot be delivered to unverified recipient inboxes. [EVIDENT] (`supabase/functions/send-email/index.ts` L104, `SKILLGATE_TEST_REFERENCE.md` L420)
* **Improvement:** Configure SPF, DKIM, and DMARC DNS records for `skillgate.com` on Resend and dynamically inject recruiter company names into email headers (`from: "Acme Hiring via SkillGate <notifications@skillgate.com>"`).

### 5. API Client Standard Alignment
* **Current Limitation:** As verified in `SKILLGATE_TEST_REFERENCE.md` (Lines 403–404, 458–459), two recruiter pages call `supabase.functions.invoke("evaluate-responses")` directly rather than routing through normalized service helpers:
  1. `src/pages/recruiter/candidates/CandidateProfile.jsx` (Line 55)
  2. `src/pages/recruiter/jobs/JobDetail.jsx` (Line 59)
* **Improvement:** Migrate these direct call sites to `candidateService.js` and wrap them with `apiClient` to ensure uniform error handling, telemetry, and retry policies. [EVIDENT]
