-- 1. Add assessment_id to questions
ALTER TABLE questions 
ADD COLUMN assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE;

-- 2. Add status constraint to assessments
ALTER TABLE assessments 
ADD CONSTRAINT assessments_status_check 
CHECK (status IN ('pending','generating','ready','in_progress','submitted','completed','failed','expired'));

-- 3. Add cache expiry index
CREATE INDEX idx_cache_expires_at ON cache(expires_at);





create or replace function insert_questions_and_mark_ready(
  p_assessment_id uuid,
  p_questions jsonb
) returns void as $$
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
$$ language plpgsql security definer;




create or replace function increment_ratelimit(
  p_identifier text,
  p_action text,
  p_window_start timestamptz
) returns table(count int) as $$
begin
  insert into ratelimit (identifier, action, window_start, count, created_at)
  values (p_identifier, p_action, p_window_start, 1, now())
  on conflict (identifier, action, window_start)
  do update set count = ratelimit.count + 1;

  return query
  select ratelimit.count
  from ratelimit
  where ratelimit.identifier = p_identifier
    and ratelimit.action = p_action
    and ratelimit.window_start = p_window_start;
end;
$$ language plpgsql security definer;