
-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  company_website TEXT,
  company_logo_url TEXT,
  work_email TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter', 'growth', 'scale')),
  assessments_used INTEGER NOT NULL DEFAULT 0,
  assessments_limit INTEGER NOT NULL DEFAULT 10,
  stripe_customer_id TEXT,
  billing_cycle_reset_at TIMESTAMPTZ,
  notify_on_every_completion BOOLEAN NOT NULL DEFAULT false,
  notify_on_pass_only BOOLEAN NOT NULL DEFAULT true,
  notify_inapp BOOLEAN NOT NULL DEFAULT true,
  zapier_webhook_url TEXT,
  is_onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- JOBS
-- ON DELETE RESTRICT — cannot delete job with candidates
-- Recruiters deactivate via is_active = false instead
-- ============================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  description TEXT NOT NULL,
  skills JSONB NOT NULL DEFAULT '[]',
  min_score_threshold INTEGER NOT NULL DEFAULT 70
    CHECK (min_score_threshold BETWEEN 50 AND 90),
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allow_retakes BOOLEAN NOT NULL DEFAULT false,
  show_score_to_candidate BOOLEAN NOT NULL DEFAULT true,
  assessment_link_token TEXT UNIQUE,
  link_expires_at TIMESTAMPTZ,
  link_max_uses INTEGER,
  link_use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CANDIDATES
-- ON DELETE RESTRICT — preserve hiring history
-- ============================================
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'in_progress', 'completed',
      'shortlisted', 'rejected'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ASSESSMENTS
-- attempt_number supports retakes
-- ON DELETE RESTRICT everywhere
-- ============================================
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'generating', 'ready', 'in_progress',
      'submitted', 'evaluating', 'completed',
      'failed', 'pending_review'
    )),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  evaluation_attempts INTEGER NOT NULL DEFAULT 0,
  tab_switches INTEGER NOT NULL DEFAULT 0,
  paste_attempts INTEGER NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_attempt UNIQUE(candidate_id, job_id, attempt_number)
);

-- ============================================
-- QUESTIONS
-- DB-level validation for MCQ and text types
-- ============================================
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL
    CHECK (question_type IN ('mcq', 'text')),
  skill TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  options JSONB,
  correct_answer TEXT,
  ideal_answer TEXT,
  points INTEGER NOT NULL DEFAULT 10
    CHECK (points IN (10, 20, 30)),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      question_type = 'mcq'
      AND options IS NOT NULL
      AND jsonb_array_length(options) = 4
      AND correct_answer IS NOT NULL
      AND options ? correct_answer
    )
    OR
    (
      question_type = 'text'
      AND ideal_answer IS NOT NULL
    )
  )
);

-- ============================================
-- RESPONSES
-- score is 0-1 scale, enforced by CHECK
-- ON DELETE RESTRICT
-- ============================================
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  answer_given TEXT,
  is_correct BOOLEAN,
  score NUMERIC(5,2) CHECK (score IS NULL OR score BETWEEN 0 AND 1),
  points_earned INTEGER DEFAULT 0,
  ai_feedback TEXT,
  missed_concepts JSONB DEFAULT '[]',
  time_taken_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, question_id)
);

-- ============================================
-- RESULTS
-- ON DELETE RESTRICT
-- ============================================
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE
    REFERENCES assessments(id) ON DELETE RESTRICT,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC(5,2) DEFAULT 0,
  confidence_label TEXT DEFAULT 'Low'
    CHECK (confidence_label IN ('High', 'Medium', 'Low')),
  skill_scores JSONB DEFAULT '[]',
  total_points_earned INTEGER DEFAULT 0,
  total_points_possible INTEGER DEFAULT 0,
  time_taken_seconds INTEGER DEFAULT 0,
  feedback_summary TEXT,
  improvement_resources JSONB DEFAULT '[]',
  executive_summary TEXT,
  hiring_signal TEXT
    CHECK (hiring_signal IN ('Strong Yes', 'Maybe', 'No')),
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  training_plan JSONB DEFAULT '[]',
  pdf_url TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  summary_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- CASCADE on recruiter delete — intentional
-- Recruiter gone = their notifications gone
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN (
      'candidate_passed', 'candidate_failed',
      'assessment_complete', 'link_limit_reached',
      'email_failed', 'evaluation_failed'
    )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CACHE
-- Service role only. Client access denied via RLS.
-- ============================================
CREATE TABLE cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- RATE LIMITS
-- Composite PK — no UUID needed for lookup table
-- ============================================
CREATE TABLE rate_limits (
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, action, window_start)
);

-- ============================================
-- TRAINING PURCHASES
-- ON DELETE RESTRICT — preserve payment records
-- ============================================
CREATE TABLE training_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL
    REFERENCES candidates(id) ON DELETE RESTRICT,
  assessment_id UUID NOT NULL
    REFERENCES assessments(id) ON DELETE RESTRICT,
  stripe_session_id TEXT UNIQUE,
  amount_paid INTEGER NOT NULL DEFAULT 900,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX idx_jobs_token ON jobs(assessment_link_token);
CREATE INDEX idx_candidates_lookup ON candidates(LOWER(email), job_id);
CREATE INDEX idx_candidates_recruiter ON candidates(recruiter_id);
CREATE INDEX idx_assessments_candidate ON assessments(candidate_id);
CREATE INDEX idx_assessments_job ON assessments(job_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_questions_job ON questions(job_id);
CREATE INDEX idx_responses_assessment ON responses(assessment_id);
CREATE INDEX idx_results_assessment ON results(assessment_id);
CREATE INDEX idx_notifications_recruiter ON notifications(recruiter_id);
CREATE INDEX idx_notifications_unread ON notifications(recruiter_id, is_read);
CREATE INDEX idx_cache_key ON cache(cache_key);
CREATE INDEX idx_cache_expires ON cache(expires_at);
CREATE UNIQUE INDEX idx_candidates_unique_email_job 
  ON candidates (LOWER(email), job_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jobs_updated
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_candidates_updated
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_assessments_updated
  BEFORE UPDATE ON assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_responses_updated
  BEFORE UPDATE ON responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_results_updated
  BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FIX: results trigger was missing in previous version
CREATE TRIGGER trg_results_updated_at
  BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO PROFILE CREATION ON SIGNUP
-- FIX: Added ON CONFLICT DO NOTHING + exception
-- handler so auth signup never fails silently
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();