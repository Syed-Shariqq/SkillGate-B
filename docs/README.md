# SkillGate Technical Architecture & Codebase Documentation

Welcome to the comprehensive technical documentation for **SkillGate**, an AI-powered technical pre-screening and candidate assessment platform. This documentation suite was produced from a complete codebase and git-history audit to serve as an authoritative reference for system design, code reviews, and technical interviews.

---

## 1. Documentation Index

| File | Title | Description |
| :--- | :--- | :--- |
| **[01-overview.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/01-overview.md)** | **System Overview & Tech Stack** | Product summary, problem statement, user roles (Recruiter, Candidate, Admin), and technical stack rationale. |
| **[02-folder-map.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/02-folder-map.md)** | **Codebase Folder Map & Reading Guide** | Granular folder and file tree with single-sentence responsibilities, plus a "Where to Start Reading" guide per feature. |
| **[03-database.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/03-database.md)** | **Database Schema, RLS & RPCs** | All 12 tables, columns, constraints, foreign keys, triggers, stored procedures, RLS policy matrix, and Mermaid ER diagram. |
| **[04-edge-functions.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/04-edge-functions.md)** | **Edge Functions Reference** | Complete catalog of 18 Supabase Edge Functions + `_shared` utilities: inputs, outputs, auth, callers, and failure modes. |
| **[05-flows.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/05-flows.md)** | **Core End-to-End System Flows** | Mermaid sequence diagrams and numbered step-by-step code execution traces for all 8 major system flows. |
| **[06-security-and-edge-cases.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/06-security-and-edge-cases.md)** | **Security Architecture & Bug Audit** | Dual auth model, RLS deep dive, Edge Function security boundary, edge case handling, and chronological bug resolution audit. |
| **[07-tradeoffs-and-improvements.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/07-tradeoffs-and-improvements.md)** | **Trade-offs, Bottlenecks & Roadmap** | Architectural trade-offs, scaling bottlenecks, capacity analysis, and Version 2.0 roadmap derived from `v2.txt`. |
| **[08-interview-prep.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/08-interview-prep.md)** | **Interview Prep & Talk Tracks** | 60s pitch, 5min overview, 15min deep dive, 30 rigorous interview Q&As with weak vs. strong contrasts, and a technical glossary. |

---

## 2. Suggested Reading Orders

### Path A: Quick Architecture Revision (30 Minutes)
*For a high-level technical refresh before an interview or presentation.*
1. **[01-overview.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/01-overview.md)**: Product, user roles, and core tech choices.
2. **[08-interview-prep.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/08-interview-prep.md)** (Section 1): Memorize the 60-second pitch, 5-minute overview, and 15-minute whiteboard guide.
3. **[05-flows.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/05-flows.md)**: Review Sequence Diagrams for Flow C (Candidate Test-Taking) and Flow D (AI Evaluation Fallback).

### Path B: Deep Engineering & Code Review (2 Hours)
*For code auditing, extending the platform, or defending implementation choices in depth.*
1. **[02-folder-map.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/02-folder-map.md)**: Understand file placement and code navigation.
2. **[03-database.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/03-database.md)**: Review tables, foreign keys, triggers, and stored procedures in `remote_schema.sql`.
3. **[04-edge-functions.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/04-edge-functions.md)**: Review all 18 Deno edge functions and shared libraries.
4. **[06-security-and-edge-cases.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/06-security-and-edge-cases.md)**: Study Row-Level Security, token validation, offline queuing, and bug audit.
5. **[07-tradeoffs-and-improvements.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/07-tradeoffs-and-improvements.md)**: Review known bottlenecks and scaling roadmap.

### Path C: Technical Interview Mastery
*For practicing system design and behavioral interview scenarios.*
1. **[08-interview-prep.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/08-interview-prep.md)**: Work through all 30 interview questions, reviewing the "Weak vs. Strong" answer contrasts and follow-up prompts.
2. **[06-security-and-edge-cases.md](file:///c:/Users/syedr/Downloads/SkillGate-B/SkillGate-B/docs/06-security-and-edge-cases.md)** (Section 5): Familiarize yourself with the historical bug audit (commits `9be9be9`, `397192b`, `6cf2781`) to answer behavioral questions about debugging and overcoming engineering hurdles.

---

## 3. Discrepancy & Code Contradiction Audit

During this codebase audit, the following contradictions between documentation (`README.md`, `SKILLGATE_TEST_REFERENCE.md`) and actual source code were identified and cataloged:

### 1. OpenRouter Model Identification Discrepancy
* **Doc Statement:** `README.md` (Line 98) and `SKILLGATE_TEST_REFERENCE.md` (Line 440) state that OpenRouter calls `deepseek/deepseek-chat:free`.
* **Code Reality:** In `supabase/functions/_shared/ai.js` (Lines 85–135), the function is named `callDeepSeek`, but line 103 actually requests `model: "openai/gpt-oss-120b:free"` from OpenRouter. However, lines 203 and 237 return `{ model: "deepseek/deepseek-chat:free" }` in the result metadata.
* **Audit Verdict:** The model actually executing inference via OpenRouter is `openai/gpt-oss-120b:free`.

### 2. Table Count Contradiction in README
* **Doc Statement:** `README.md` (Line 190) states: *"It contains 11 public tables:"*.
* **Code Reality:** The table directly below that line in `README.md` lists 12 public tables. `remote_schema.sql` confirms exactly 12 public tables: `profiles`, `jobs`, `candidates`, `assessments`, `questions`, `responses`, `results`, `notifications`, `link_opens`, `rate_limits`, `cache`, and `training_purchases`.
* **Audit Verdict:** The schema contains 12 public tables.

### 3. API Client Bypass Call Sites
* **Doc Statement:** `SKILLGATE_TEST_REFERENCE.md` (Lines 403–404, 458–459) notes that two call sites bypass the normalized `apiClient` service layer.
* **Code Reality Verified:**
  1. `src/pages/recruiter/candidates/CandidateProfile.jsx` (Line 55): Calls `supabase.functions.invoke("evaluate-responses")` directly.
  2. `src/pages/recruiter/jobs/JobDetail.jsx` (Line 59): Calls `supabase.functions.invoke("evaluate-responses")` directly.
* **Audit Verdict:** Both direct call sites exist in code and should be migrated to `candidateService.js` in a future cleanup.

---

## 4. Unclear & Unverified Items (UNCLEAR)

The following items are referenced in configuration or documentation but cannot be definitively verified in source code:

1. **`S3_ACCESS_KEY` & `S3_SECRET_KEY` Production Usage [UNCLEAR]:**
   * *Detail:* Referenced in `supabase/config.toml` (Lines 87–88) and `README.md` (Lines 405–406). The application code interacts with Supabase Storage strictly through `@supabase/supabase-js` storage API (`supabase.storage.from("reports")`). Whether an external AWS S3 bucket was ever mounted in the live production Supabase instance is UNCLEAR from repository code.
2. **Resend Production Sending Domain [UNCLEAR]:**
   * *Detail:* In `supabase/functions/send-email/index.ts` (Line 104) and `send-verification-email/index.ts` (Line 40), `FROM_EMAIL` is hardcoded to `onboarding@resend.dev`. In Resend sandbox mode, emails cannot be delivered to unverified third-party domains. Whether a custom verified domain is configured via runtime environment secrets or if this remains in sandbox mode is UNCLEAR from repository files.
3. **`avatars` Storage Bucket [UNCLEAR]:**
   * *Detail:* Mentioned in migration comments in `supabase/migrations/003_storage_buckets.sql`. The current frontend exclusively references `company_logo_url` in the `logos` bucket. Whether an `avatars` bucket was ever provisioned in the remote Supabase dashboard is UNCLEAR.
