-- Candidate assessment session foundation.
-- Keeps public candidate workflow behind Edge Functions while preserving RLS.

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_one_active_per_candidate_job
  ON assessments (candidate_id, job_id)
  WHERE status IN ('pending', 'ready', 'in_progress');

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_unique_email_job_exact
  ON candidates (email, job_id);

CREATE OR REPLACE FUNCTION increment_job_link_use_count(p_job_id uuid)
RETURNS boolean AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE jobs
  SET link_use_count = link_use_count + 1,
      updated_at = now()
  WHERE id = p_job_id
    AND is_active = true
    AND (link_expires_at IS NULL OR link_expires_at > now())
    AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
  RETURNING link_use_count INTO updated_count;

  RETURN updated_count IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION lock_assessment_question_generation(
  p_assessment_id uuid,
  p_job_id uuid,
  p_recruiter_id uuid
)
RETURNS boolean AS $$
DECLARE
  locked_id uuid;
BEGIN
  UPDATE assessments
  SET generation_attempts = generation_attempts + 1,
      updated_at = now()
  WHERE id = p_assessment_id
    AND job_id = p_job_id
    AND recruiter_id = p_recruiter_id
    AND status = 'pending'
    AND generation_attempts = 0
  RETURNING id INTO locked_id;

  RETURN locked_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
