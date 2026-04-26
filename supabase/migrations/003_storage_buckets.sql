-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- FIX: Removed conflicting authenticated INSERT policy
-- Only logos allowed for authenticated uploads
-- Reports are backend-only via service role key
-- ============================================

-- Block all anon uploads to any bucket
CREATE POLICY "deny_anon_all_uploads"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (false);

-- Recruiters can only upload to their own logo folder
-- Reports bucket implicitly blocked — not in WITH CHECK
CREATE POLICY "recruiter_upload_own_logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read logos (public bucket)
CREATE POLICY "public_read_logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- Recruiter update/delete their own logo only
CREATE POLICY "recruiter_update_own_logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recruiter_delete_own_logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );