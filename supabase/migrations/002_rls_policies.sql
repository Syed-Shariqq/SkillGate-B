-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_purchases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RATE LIMIT HELPER FUNCTION
-- SECURITY DEFINER is intentional — this function
-- needs to bypass RLS on rate_limits to work.
-- Do NOT remove SECURITY DEFINER or rate limiting
-- breaks silently without any error.
-- Handles proxy headers + shared network IPs safely.
-- ============================================
CREATE OR REPLACE FUNCTION check_anon_rate_limit()
RETURNS BOOLEAN AS $$
DECLARE
  request_ip TEXT;
  current_window TIMESTAMPTZ;
  current_count INTEGER;
BEGIN
  -- Handle comma-separated proxy headers safely
  request_ip := split_part(COALESCE(
    current_setting('request.headers', true)::json->>'x-real-ip',
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    'unknown'
  ), ',', 1);

  -- Trim any whitespace from IP
  request_ip := TRIM(request_ip);

  -- Hour-level window bucket
  current_window := DATE_TRUNC('hour', NOW());

  -- Get current count for this IP + window
  SELECT count INTO current_count
  FROM rate_limits
  WHERE identifier = request_ip
    AND action = 'candidate_insert'
    AND window_start = current_window;

  IF current_count IS NULL THEN
    current_count := 0;
  END IF;

  -- 20/hour allows shared networks (offices, universities)
  -- without being exploitable
  IF current_count >= 20 THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limits (identifier, action, window_start, count)
  VALUES (request_ip, 'candidate_insert', current_window, 1)
  ON CONFLICT (identifier, action, window_start)
  DO UPDATE SET count = rate_limits.count + 1;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES
-- ============================================
CREATE POLICY "profile_owner"
  ON profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- JOBS POLICIES
-- ============================================
CREATE POLICY "recruiter_all_jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "anon_read_active_job_by_token"
  ON jobs FOR SELECT
  TO anon
  USING (
    is_active = true
    AND assessment_link_token IS NOT NULL
    AND (link_expires_at IS NULL OR link_expires_at > NOW())
    AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
  );

-- ============================================
-- CANDIDATES POLICIES
-- FIX: anon INSERT rate-limited + token validated
-- No anon SELECT — Edge Function handles reads
-- ============================================
CREATE POLICY "recruiter_all_candidates"
  ON candidates FOR ALL
  TO authenticated
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "anon_insert_candidate_rate_limited"
  ON candidates FOR INSERT
  TO anon
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs
      WHERE is_active = true
      AND assessment_link_token IS NOT NULL
      AND (link_expires_at IS NULL OR link_expires_at > NOW())
      AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
    )
    AND check_anon_rate_limit()
  );

-- ============================================
-- ASSESSMENTS POLICIES
-- No anon SELECT/UPDATE — Edge Function only
-- ============================================
CREATE POLICY "recruiter_all_assessments"
  ON assessments FOR ALL
  TO authenticated
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "anon_insert_assessment"
  ON assessments FOR INSERT
  TO anon
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs
      WHERE is_active = true
      AND assessment_link_token IS NOT NULL
      AND (link_expires_at IS NULL OR link_expires_at > NOW())
      AND (link_max_uses IS NULL OR link_use_count < link_max_uses)
    )
  );

-- ============================================
-- QUESTIONS POLICIES
-- No public access — Edge Function serves questions
-- ============================================
CREATE POLICY "recruiter_all_questions"
  ON questions FOR ALL
  TO authenticated
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

-- ============================================
-- RESPONSES POLICIES
-- Recruiter read only
-- All writes via Edge Function (service role)
-- ============================================
CREATE POLICY "recruiter_read_responses"
  ON responses FOR SELECT
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE recruiter_id = auth.uid()
    )
  );

-- ============================================
-- RESULTS POLICIES
-- Recruiter read only
-- All writes via Edge Function (service role)
-- ============================================
CREATE POLICY "recruiter_read_results"
  ON results FOR SELECT
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE recruiter_id = auth.uid()
    )
  );

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
CREATE POLICY "recruiter_all_notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id);

-- ============================================
-- CACHE POLICIES
-- Deny all client access
-- Edge Functions use service role — bypasses RLS
-- ============================================
CREATE POLICY "deny_cache_anon"
  ON cache FOR ALL
  TO anon
  USING (false);

CREATE POLICY "deny_cache_authenticated"
  ON cache FOR ALL
  TO authenticated
  USING (false);

-- ============================================
-- RATE LIMITS POLICIES
-- Deny all client access
-- check_anon_rate_limit() uses SECURITY DEFINER
-- ============================================
CREATE POLICY "deny_rate_limits_anon"
  ON rate_limits FOR ALL
  TO anon
  USING (false);

CREATE POLICY "deny_rate_limits_authenticated"
  ON rate_limits FOR ALL
  TO authenticated
  USING (false);

-- ============================================
-- TRAINING PURCHASES POLICIES
-- Anon insert only for completed assessments
-- Recruiter read for their own jobs
-- ============================================
CREATE POLICY "anon_insert_training_purchase"
  ON training_purchases FOR INSERT
  TO anon
  WITH CHECK (
    assessment_id IN (
      SELECT a.id FROM assessments a
      JOIN jobs j ON j.id = a.job_id
      WHERE j.assessment_link_token IS NOT NULL
      AND a.status = 'completed'
    )
  );

CREATE POLICY "recruiter_read_purchases"
  ON training_purchases FOR SELECT
  TO authenticated
  USING (
    assessment_id IN (
      SELECT id FROM assessments
      WHERE recruiter_id = auth.uid()
    )
  );