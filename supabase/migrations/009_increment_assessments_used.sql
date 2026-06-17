-- Migration to add atomic assessments_used increment helper
CREATE OR REPLACE FUNCTION increment_assessments_used(p_recruiter_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET assessments_used = assessments_used + 1,
      updated_at = now()
  WHERE id = p_recruiter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
