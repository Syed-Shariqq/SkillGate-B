


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_anon_rate_limit"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."check_anon_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, account_status)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    CASE 
      WHEN split_part(lower(NEW.email), '@', 2) = ANY(ARRAY['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'live.com', 'msn.com']) THEN 'pending_approval'
      ELSE 'approved'
    END
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_assessments_used"("p_recruiter_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles
  SET assessments_used = assessments_used + 1,
      updated_at = now()
  WHERE id = p_recruiter_id;
END;
$$;


ALTER FUNCTION "public"."increment_assessments_used"("p_recruiter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_job_link_use_count"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."increment_job_link_use_count"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ratelimit"("p_identifier" "text", "p_action" "text", "p_window_start" timestamp with time zone) RETURNS TABLE("count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into rate_limits (identifier, action, window_start, count, created_at)
  values (p_identifier, p_action, p_window_start, 1, now())
  on conflict (identifier, action, window_start)
  do update set count = rate_limits.count + 1;

  return query
  select rate_limits.count
  from rate_limits
  where rate_limits.identifier = p_identifier
    and rate_limits.action = p_action
    and rate_limits.window_start = p_window_start;
end;
$$;


ALTER FUNCTION "public"."increment_ratelimit"("p_identifier" "text", "p_action" "text", "p_window_start" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_questions_and_mark_ready"("p_assessment_id" "uuid", "p_questions" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into questions (
    id,
    assessment_id,
    job_id,
    recruiter_id,
    question_text,
    question_type,
    skill,
    difficulty,
    options,
    correct_answer,
    ideal_answer,
    points,
    order_index,
    is_custom,
    created_at
  )
  select
    gen_random_uuid(),
    p_assessment_id,
    (q->>'job_id')::uuid,
    (q->>'recruiter_id')::uuid,
    q->>'question_text',
    q->>'question_type',
    q->>'skill',
    q->>'difficulty',
    (q->'options'),
    q->>'correct_answer',
    q->>'ideal_answer',
    (q->>'points')::int,
    (q->>'order_index')::int,
    false,
    now()
  from jsonb_array_elements(p_questions) as q;

  update assessments
  set status = 'ready', updated_at = now()
  where id = p_assessment_id;
end;
$$;


ALTER FUNCTION "public"."insert_questions_and_mark_ready"("p_assessment_id" "uuid", "p_questions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_assessment_question_generation"("p_assessment_id" "uuid", "p_job_id" "uuid", "p_recruiter_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."lock_assessment_question_generation"("p_assessment_id" "uuid", "p_job_id" "uuid", "p_recruiter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_email_debug"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user_id uuid;
  v_email_verified boolean;
  v_sent_at timestamptz;
BEGIN
  SELECT id, email_verified, email_verification_sent_at
  INTO v_user_id, v_email_verified, v_sent_at
  FROM profiles
  WHERE email_verification_token = p_token;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'email_verified', v_email_verified,
    'sent_at', v_sent_at
  );
END;
$$;


ALTER FUNCTION "public"."verify_email_debug"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_email_with_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_id uuid;
  v_email_verified boolean;
  v_sent_at timestamptz;
begin
  -- 1. Fetch profile matching token (no LIMIT 1 needed due to unique constraint)
  select id, email_verified, email_verification_sent_at
  into v_user_id, v_email_verified, v_sent_at
  from profiles
  where email_verification_token = p_token;

  -- 2. Handle invalid token (no matching profile row)
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  -- 3. Handle already verified users (idempotency/duplicate link clicks)
  if v_email_verified = true then
    return jsonb_build_object('success', true, 'status', 'already_verified');
  end if;

  -- 4. Fail-safe check: reject if sent timestamp is null
  if v_sent_at is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  -- 5. Handle expired tokens (24-hour limit)
  if v_sent_at < now() - interval '24 hours' then
    return jsonb_build_object('success', false, 'error', 'token_expired');
  end if;

  -- 6. Successful verification: Update profile row, log timestamp, clear token columns
  update profiles
  set email_verified = true,
      email_verified_at = now(),
      email_verification_token = null,
      email_verification_sent_at = null
  where id = v_user_id;

  return jsonb_build_object('success', true, 'status', 'verified');
end;
$$;


ALTER FUNCTION "public"."verify_email_with_token"("p_token" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "time_limit_minutes" integer DEFAULT 30 NOT NULL,
    "generation_attempts" integer DEFAULT 0 NOT NULL,
    "evaluation_attempts" integer DEFAULT 0 NOT NULL,
    "tab_switches" integer DEFAULT 0 NOT NULL,
    "paste_attempts" integer DEFAULT 0 NOT NULL,
    "is_flagged" boolean DEFAULT false NOT NULL,
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assessments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'generating'::"text", 'ready'::"text", 'in_progress'::"text", 'submitted'::"text", 'evaluating'::"text", 'completed'::"text", 'failed'::"text", 'pending_review'::"text"])))
);


ALTER TABLE "public"."assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cache_key" "text" NOT NULL,
    "cache_type" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "candidates_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'shortlisted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "skills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "min_score_threshold" integer DEFAULT 70 NOT NULL,
    "time_limit_minutes" integer DEFAULT 30 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "allow_retakes" boolean DEFAULT false NOT NULL,
    "show_score_to_candidate" boolean DEFAULT true NOT NULL,
    "assessment_link_token" "text",
    "link_expires_at" timestamp with time zone,
    "link_max_uses" integer,
    "link_use_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jobs_min_score_threshold_check" CHECK ((("min_score_threshold" >= 50) AND ("min_score_threshold" <= 90)))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."link_opens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_hash" "text",
    "user_agent_hash" "text"
);


ALTER TABLE "public"."link_opens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "candidate_id" "uuid",
    "assessment_id" "uuid",
    "job_id" "uuid",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['email_sent'::"text", 'email_failed'::"text", 'candidate_passed'::"text", 'candidate_failed'::"text", 'assessment_complete'::"text", 'link_limit_reached'::"text", 'assessment_generation_failed'::"text", 'evaluation_pending_review'::"text", 'pdf_generation_failed'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "full_name" "text",
    "company_name" "text",
    "company_website" "text",
    "company_logo_url" "text",
    "work_email" "text",
    "subscription_tier" "text" DEFAULT 'starter'::"text" NOT NULL,
    "assessments_used" integer DEFAULT 0 NOT NULL,
    "assessments_limit" integer DEFAULT 10 NOT NULL,
    "stripe_customer_id" "text",
    "billing_cycle_reset_at" timestamp with time zone,
    "notify_on_every_completion" boolean DEFAULT false NOT NULL,
    "notify_on_pass_only" boolean DEFAULT false NOT NULL,
    "notify_inapp" boolean DEFAULT true NOT NULL,
    "zapier_webhook_url" "text",
    "is_onboarded" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "account_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "email_verification_token" "text",
    "email_verification_sent_at" timestamp with time zone,
    "email_verified_at" timestamp with time zone,
    CONSTRAINT "account_status_check" CHECK (("account_status" = ANY (ARRAY['approved'::"text", 'pending_approval'::"text", 'rejected'::"text"]))),
    CONSTRAINT "profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['starter'::"text", 'growth'::"text", 'scale'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "question_text" "text" NOT NULL,
    "question_type" "text" NOT NULL,
    "skill" "text" NOT NULL,
    "difficulty" "text" DEFAULT 'medium'::"text" NOT NULL,
    "options" "jsonb",
    "correct_answer" "text",
    "ideal_answer" "text",
    "points" integer DEFAULT 10 NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_custom" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assessment_id" "uuid",
    CONSTRAINT "questions_check" CHECK (((("question_type" = 'mcq'::"text") AND ("options" IS NOT NULL) AND ("jsonb_array_length"("options") = 4) AND ("correct_answer" IS NOT NULL) AND ("options" ? "correct_answer")) OR (("question_type" = 'text'::"text") AND ("ideal_answer" IS NOT NULL)))),
    CONSTRAINT "questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "questions_points_check" CHECK (("points" = ANY (ARRAY[10, 20, 30]))),
    CONSTRAINT "questions_question_type_check" CHECK (("question_type" = ANY (ARRAY['mcq'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "identifier" "text" NOT NULL,
    "action" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assessment_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "answer_given" "text",
    "is_correct" boolean,
    "score" numeric(5,2),
    "points_earned" integer DEFAULT 0,
    "ai_feedback" "text",
    "missed_concepts" "jsonb" DEFAULT '[]'::"jsonb",
    "time_taken_seconds" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "responses_score_check" CHECK ((("score" IS NULL) OR (("score" >= (0)::numeric) AND ("score" <= (1)::numeric))))
);


ALTER TABLE "public"."responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assessment_id" "uuid" NOT NULL,
    "overall_score" numeric(5,2) DEFAULT 0 NOT NULL,
    "passed" boolean DEFAULT false NOT NULL,
    "confidence_score" numeric(5,2) DEFAULT 0,
    "confidence_label" "text" DEFAULT 'Low'::"text",
    "skill_scores" "jsonb" DEFAULT '[]'::"jsonb",
    "total_points_earned" integer DEFAULT 0,
    "total_points_possible" integer DEFAULT 0,
    "time_taken_seconds" integer DEFAULT 0,
    "feedback_summary" "text",
    "improvement_resources" "jsonb" DEFAULT '[]'::"jsonb",
    "executive_summary" "text",
    "hiring_signal" "text",
    "strengths" "jsonb" DEFAULT '[]'::"jsonb",
    "weaknesses" "jsonb" DEFAULT '[]'::"jsonb",
    "training_plan" "jsonb" DEFAULT '[]'::"jsonb",
    "pdf_url" "text",
    "email_sent" boolean DEFAULT false NOT NULL,
    "summary_generated" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hiring_rationale" "text",
    "summary_generated_at" timestamp with time zone,
    "summary_model" "text",
    "summary_prompt_version" "text",
    "pdf_status" "text" DEFAULT 'pending'::"text",
    "pdf_storage_path" "text",
    "pdf_generated_at" timestamp with time zone,
    "pdf_error" "text",
    "pdf_generation_started_at" timestamp with time zone,
    "pdf_generation_attempts" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "results_confidence_label_check" CHECK (("confidence_label" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "results_hiring_signal_check" CHECK (("hiring_signal" = ANY (ARRAY['Strong Yes'::"text", 'Maybe'::"text", 'No'::"text"]))),
    CONSTRAINT "results_pdf_status_check" CHECK (("pdf_status" = ANY (ARRAY['pending'::"text", 'generating'::"text", 'generated'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "assessment_id" "uuid" NOT NULL,
    "stripe_session_id" "text",
    "amount_paid" integer DEFAULT 900 NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."training_purchases" OWNER TO "postgres";


ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cache"
    ADD CONSTRAINT "cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."cache"
    ADD CONSTRAINT "cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_email_job_id_unique" UNIQUE ("email", "job_id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_assessment_link_token_key" UNIQUE ("assessment_link_token");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."link_opens"
    ADD CONSTRAINT "link_opens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("identifier", "action", "window_start");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_assessment_id_question_id_key" UNIQUE ("assessment_id", "question_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_assessment_id_key" UNIQUE ("assessment_id");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_purchases"
    ADD CONSTRAINT "training_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_purchases"
    ADD CONSTRAINT "training_purchases_stripe_session_id_key" UNIQUE ("stripe_session_id");



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "unique_attempt" UNIQUE ("candidate_id", "job_id", "attempt_number");



CREATE INDEX "idx_assessments_candidate" ON "public"."assessments" USING "btree" ("candidate_id");



CREATE INDEX "idx_assessments_job" ON "public"."assessments" USING "btree" ("job_id");



CREATE UNIQUE INDEX "idx_assessments_one_active_per_candidate_job" ON "public"."assessments" USING "btree" ("candidate_id", "job_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'in_progress'::"text"]));



CREATE INDEX "idx_assessments_status" ON "public"."assessments" USING "btree" ("status");



CREATE INDEX "idx_cache_expires" ON "public"."cache" USING "btree" ("expires_at");



CREATE INDEX "idx_cache_expires_at" ON "public"."cache" USING "btree" ("expires_at");



CREATE INDEX "idx_cache_key" ON "public"."cache" USING "btree" ("cache_key");



CREATE INDEX "idx_candidates_lookup" ON "public"."candidates" USING "btree" ("lower"("email"), "job_id");



CREATE INDEX "idx_candidates_recruiter" ON "public"."candidates" USING "btree" ("recruiter_id");



CREATE UNIQUE INDEX "idx_candidates_unique_email_job" ON "public"."candidates" USING "btree" ("lower"("email"), "job_id");



CREATE UNIQUE INDEX "idx_candidates_unique_email_job_exact" ON "public"."candidates" USING "btree" ("email", "job_id");



CREATE INDEX "idx_jobs_recruiter" ON "public"."jobs" USING "btree" ("recruiter_id");



CREATE INDEX "idx_jobs_token" ON "public"."jobs" USING "btree" ("assessment_link_token");



CREATE INDEX "idx_notifications_recruiter" ON "public"."notifications" USING "btree" ("recruiter_id");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("recruiter_id", "is_read");



CREATE UNIQUE INDEX "idx_profiles_email_verification_token" ON "public"."profiles" USING "btree" ("email_verification_token") WHERE ("email_verification_token" IS NOT NULL);



CREATE INDEX "idx_questions_job" ON "public"."questions" USING "btree" ("job_id");



CREATE INDEX "idx_responses_assessment" ON "public"."responses" USING "btree" ("assessment_id");



CREATE INDEX "idx_results_assessment" ON "public"."results" USING "btree" ("assessment_id");



CREATE INDEX "link_opens_job_id_idx" ON "public"."link_opens" USING "btree" ("job_id");



CREATE OR REPLACE TRIGGER "trg_assessments_updated" BEFORE UPDATE ON "public"."assessments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_candidates_updated" BEFORE UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_jobs_updated" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_responses_updated" BEFORE UPDATE ON "public"."responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_results_updated" BEFORE UPDATE ON "public"."results" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_results_updated_at" BEFORE UPDATE ON "public"."results" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."link_opens"
    ADD CONSTRAINT "link_opens_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."training_purchases"
    ADD CONSTRAINT "training_purchases_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."training_purchases"
    ADD CONSTRAINT "training_purchases_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE RESTRICT;



CREATE POLICY "Candidates can check their purchase" ON "public"."training_purchases" FOR SELECT USING (true);



CREATE POLICY "Public can read recruiter limit for assessment check" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Recruiters can read link opens for their jobs" ON "public"."link_opens" FOR SELECT USING (("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."recruiter_id" = "auth"."uid"()))));



CREATE POLICY "Service role can insert link opens" ON "public"."link_opens" FOR INSERT WITH CHECK (true);



CREATE POLICY "admin_can_update_any_profile" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."is_admin" = true)))));



CREATE POLICY "anon_insert_training_purchase" ON "public"."training_purchases" FOR INSERT TO "anon" WITH CHECK (("assessment_id" IN ( SELECT "a"."id"
   FROM ("public"."assessments" "a"
     JOIN "public"."jobs" "j" ON (("j"."id" = "a"."job_id")))
  WHERE (("j"."assessment_link_token" IS NOT NULL) AND ("a"."status" = 'completed'::"text")))));



ALTER TABLE "public"."assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_cache_anon" ON "public"."cache" TO "anon" USING (false);



CREATE POLICY "deny_cache_authenticated" ON "public"."cache" TO "authenticated" USING (false);



CREATE POLICY "deny_rate_limits_anon" ON "public"."rate_limits" TO "anon" USING (false);



CREATE POLICY "deny_rate_limits_authenticated" ON "public"."rate_limits" TO "authenticated" USING (false);



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."link_opens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_owner" ON "public"."profiles" TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_all_assessments" ON "public"."assessments" TO "authenticated" USING (("auth"."uid"() = "recruiter_id")) WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "recruiter_all_candidates" ON "public"."candidates" TO "authenticated" USING (("auth"."uid"() = "recruiter_id")) WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "recruiter_all_jobs" ON "public"."jobs" TO "authenticated" USING (("auth"."uid"() = "recruiter_id")) WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "recruiter_all_notifications" ON "public"."notifications" TO "authenticated" USING (("auth"."uid"() = "recruiter_id")) WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "recruiter_all_questions" ON "public"."questions" TO "authenticated" USING (("auth"."uid"() = "recruiter_id")) WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "recruiter_read_purchases" ON "public"."training_purchases" FOR SELECT TO "authenticated" USING (("assessment_id" IN ( SELECT "assessments"."id"
   FROM "public"."assessments"
  WHERE ("assessments"."recruiter_id" = "auth"."uid"()))));



CREATE POLICY "recruiter_read_responses" ON "public"."responses" FOR SELECT TO "authenticated" USING (("assessment_id" IN ( SELECT "assessments"."id"
   FROM "public"."assessments"
  WHERE ("assessments"."recruiter_id" = "auth"."uid"()))));



CREATE POLICY "recruiter_read_results" ON "public"."results" FOR SELECT TO "authenticated" USING (("assessment_id" IN ( SELECT "assessments"."id"
   FROM "public"."assessments"
  WHERE ("assessments"."recruiter_id" = "auth"."uid"()))));



ALTER TABLE "public"."responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_purchases" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."check_anon_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_anon_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_anon_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_assessments_used"("p_recruiter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_assessments_used"("p_recruiter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_assessments_used"("p_recruiter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_job_link_use_count"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_job_link_use_count"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_job_link_use_count"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ratelimit"("p_identifier" "text", "p_action" "text", "p_window_start" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ratelimit"("p_identifier" "text", "p_action" "text", "p_window_start" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ratelimit"("p_identifier" "text", "p_action" "text", "p_window_start" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_questions_and_mark_ready"("p_assessment_id" "uuid", "p_questions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_questions_and_mark_ready"("p_assessment_id" "uuid", "p_questions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_questions_and_mark_ready"("p_assessment_id" "uuid", "p_questions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_assessment_question_generation"("p_assessment_id" "uuid", "p_job_id" "uuid", "p_recruiter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."lock_assessment_question_generation"("p_assessment_id" "uuid", "p_job_id" "uuid", "p_recruiter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_assessment_question_generation"("p_assessment_id" "uuid", "p_job_id" "uuid", "p_recruiter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_email_debug"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_email_debug"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_email_debug"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_email_with_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_email_with_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_email_with_token"("p_token" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."assessments" TO "anon";
GRANT ALL ON TABLE "public"."assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."assessments" TO "service_role";



GRANT ALL ON TABLE "public"."cache" TO "anon";
GRANT ALL ON TABLE "public"."cache" TO "authenticated";
GRANT ALL ON TABLE "public"."cache" TO "service_role";



GRANT ALL ON TABLE "public"."candidates" TO "anon";
GRANT ALL ON TABLE "public"."candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."candidates" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."link_opens" TO "anon";
GRANT ALL ON TABLE "public"."link_opens" TO "authenticated";
GRANT ALL ON TABLE "public"."link_opens" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."responses" TO "anon";
GRANT ALL ON TABLE "public"."responses" TO "authenticated";
GRANT ALL ON TABLE "public"."responses" TO "service_role";



GRANT ALL ON TABLE "public"."results" TO "anon";
GRANT ALL ON TABLE "public"."results" TO "authenticated";
GRANT ALL ON TABLE "public"."results" TO "service_role";



GRANT ALL ON TABLE "public"."training_purchases" TO "anon";
GRANT ALL ON TABLE "public"."training_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."training_purchases" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































