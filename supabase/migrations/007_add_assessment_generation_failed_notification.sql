ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'candidate_passed', 'candidate_failed',
    'assessment_complete', 'link_limit_reached',
    'email_failed', 'evaluation_failed',
    'assessment_generation_failed'
  ));
