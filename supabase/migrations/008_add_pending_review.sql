ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_status_check;

ALTER TABLE assessments ADD CONSTRAINT assessments_status_check
  CHECK (status IN (
    'pending', 'generating', 'ready', 'in_progress', 
    'submitted', 'evaluating', 'completed', 'failed', 
    'pending_review'
  ));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'email_sent', 'email_failed', 'candidate_passed', 
    'candidate_failed', 'assessment_complete', 'link_limit_reached', 
    'assessment_generation_failed', 'evaluation_pending_review'
  ));
