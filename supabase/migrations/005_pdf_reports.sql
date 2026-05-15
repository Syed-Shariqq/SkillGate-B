ALTER TABLE results
ADD COLUMN IF NOT EXISTS pdf_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pdf_error TEXT,
ADD COLUMN IF NOT EXISTS pdf_generation_started_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'results_pdf_status_check'
  ) THEN
    ALTER TABLE results
    ADD CONSTRAINT results_pdf_status_check
    CHECK (
      pdf_status IS NULL
      OR pdf_status IN ('pending', 'generating', 'generated', 'failed')
    );
  END IF;
END $$;

CREATE POLICY "Service role can manage reports"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'reports')
WITH CHECK (bucket_id = 'reports');
