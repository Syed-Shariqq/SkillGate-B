-- Migration to add pdf_generation_attempts column to results table
ALTER TABLE results
ADD COLUMN IF NOT EXISTS pdf_generation_attempts INTEGER NOT NULL DEFAULT 0;
