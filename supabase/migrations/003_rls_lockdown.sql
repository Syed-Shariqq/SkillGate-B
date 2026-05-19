-- SkillGate Stage 9 RLS lockdown.
-- Deployment order:
-- 1. Deploy candidate Edge Functions.
-- 2. Deploy frontend candidate-flow refactor.
-- 3. Verify start/get/save/submit/result/event functions end-to-end.
-- 4. Deploy this migration.
--
-- Policy intent:
-- - Candidate assessment flow is Edge Functions only.
-- - Recruiters keep authenticated owner-scoped access.
-- - Service role keeps bypassing RLS for Edge Functions.
-- - No broad anon policies and no unconditional predicates.

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Jobs: remove public job-link preview reads.
-- Public link preview now happens in get-job-by-token with the service role.
DROP POLICY IF EXISTS "anon_read_active_job_by_token" ON jobs;
DROP POLICY IF EXISTS "anon_read_jobs_by_token" ON jobs;
DROP POLICY IF EXISTS "anon_select_jobs_by_token" ON jobs;

-- Candidates: remove public candidate creation.
-- Candidate creation now happens in start-assessment with the service role.
DROP POLICY IF EXISTS "anon_insert_candidate_rate_limited" ON candidates;
DROP POLICY IF EXISTS "anon_insert_candidate" ON candidates;
DROP POLICY IF EXISTS "candidate_insert" ON candidates;

-- Assessments: remove public assessment creation.
-- Assessment creation now happens in start-assessment with the service role.
DROP POLICY IF EXISTS "anon_insert_assessment" ON assessments;
DROP POLICY IF EXISTS "candidate_insert_assessment" ON assessments;

-- Questions: remove public reads.
-- Candidate question reads now happen in get-assessment with sanitized DTOs.
DROP POLICY IF EXISTS "anon_read_questions" ON questions;
DROP POLICY IF EXISTS "anon_select_questions" ON questions;
DROP POLICY IF EXISTS "candidate_read_questions" ON questions;
DROP POLICY IF EXISTS "candidate_select_questions" ON questions;

-- Responses: remove public writes.
-- Candidate answer writes now happen in save-response with ownership checks.
DROP POLICY IF EXISTS "anon_insert_response" ON responses;
DROP POLICY IF EXISTS "anon_update_response" ON responses;
DROP POLICY IF EXISTS "anon_upsert_response" ON responses;
DROP POLICY IF EXISTS "candidate_insert_response" ON responses;
DROP POLICY IF EXISTS "candidate_update_response" ON responses;
DROP POLICY IF EXISTS "candidate_upsert_response" ON responses;

-- Results: remove public reads.
-- Candidate result reads now happen in get-candidate-result with safe DTOs.
DROP POLICY IF EXISTS "anon_read_results" ON results;
DROP POLICY IF EXISTS "anon_select_results" ON results;
DROP POLICY IF EXISTS "candidate_read_results" ON results;
DROP POLICY IF EXISTS "candidate_select_results" ON results;

-- Kept policies are authenticated and owner-scoped:
-- - recruiter_all_candidates uses auth.uid() = recruiter_id
-- - recruiter_all_assessments uses auth.uid() = recruiter_id
-- - recruiter_all_questions uses auth.uid() = recruiter_id
-- - recruiter_read_responses uses assessment ownership by recruiter_id
-- - recruiter_read_results uses assessment ownership by recruiter_id
--
-- Service role bypass remains available to Edge Functions by Supabase design.

-- ============================================
-- ROLLBACK: exact recreation SQL
-- ============================================
-- Use only if the Stage 9 Edge Function flow must be rolled back.
-- These rollback policies are explicit and intentionally avoid broad access.
--
-- CREATE POLICY "anon_read_active_job_by_token"
--   ON jobs FOR SELECT
--   TO anon
--   USING (
--     is_active = true
--     AND assessment_link_token IS NOT NULL
--     AND (link_expires_at IS NULL OR link_expires_at > NOW())
--     AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
--   );
--
-- CREATE POLICY "anon_insert_candidate_rate_limited"
--   ON candidates FOR INSERT
--   TO anon
--   WITH CHECK (
--     job_id IN (
--       SELECT id FROM jobs
--       WHERE is_active = true
--       AND assessment_link_token IS NOT NULL
--       AND (link_expires_at IS NULL OR link_expires_at > NOW())
--       AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
--     )
--     AND check_anon_rate_limit()
--   );
--
-- CREATE POLICY "anon_insert_assessment"
--   ON assessments FOR INSERT
--   TO anon
--   WITH CHECK (
--     job_id IN (
--       SELECT id FROM jobs
--       WHERE is_active = true
--       AND assessment_link_token IS NOT NULL
--       AND (link_expires_at IS NULL OR link_expires_at > NOW())
--       AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
--     )
--   );
--
-- CREATE POLICY "anon_read_questions"
--   ON questions FOR SELECT
--   TO anon
--   USING (
--     assessment_id IN (
--       SELECT a.id
--       FROM assessments a
--       JOIN jobs j ON j.id = a.job_id
--       WHERE a.status IN ('ready', 'in_progress')
--       AND j.is_active = true
--       AND j.assessment_link_token IS NOT NULL
--       AND (j.link_expires_at IS NULL OR j.link_expires_at > NOW())
--     )
--   );
--
-- CREATE POLICY "anon_insert_response"
--   ON responses FOR INSERT
--   TO anon
--   WITH CHECK (
--     assessment_id IN (
--       SELECT id FROM assessments
--       WHERE status IN ('ready', 'in_progress')
--     )
--     AND question_id IN (
--       SELECT q.id
--       FROM questions q
--       WHERE q.assessment_id = responses.assessment_id
--     )
--   );
--
-- CREATE POLICY "anon_update_response"
--   ON responses FOR UPDATE
--   TO anon
--   USING (
--     assessment_id IN (
--       SELECT id FROM assessments
--       WHERE status IN ('ready', 'in_progress')
--     )
--   )
--   WITH CHECK (
--     assessment_id IN (
--       SELECT id FROM assessments
--       WHERE status IN ('ready', 'in_progress')
--     )
--     AND question_id IN (
--       SELECT q.id
--       FROM questions q
--       WHERE q.assessment_id = responses.assessment_id
--     )
--   );
--
-- CREATE POLICY "anon_read_results"
--   ON results FOR SELECT
--   TO anon
--   USING (
--     assessment_id IN (
--       SELECT a.id
--       FROM assessments a
--       JOIN jobs j ON j.id = a.job_id
--       WHERE a.status = 'completed'
--       AND j.assessment_link_token IS NOT NULL
--     )
--   );
