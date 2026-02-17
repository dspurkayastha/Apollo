-- Add rows_json column to datasets table for storing parsed row data
-- This enables the analysis pipeline to read dataset rows directly from DB
-- without needing to re-download and re-parse the original file.

ALTER TABLE datasets
  ADD COLUMN IF NOT EXISTS rows_json jsonb DEFAULT NULL;

COMMENT ON COLUMN datasets.rows_json IS 'Parsed dataset rows as JSONB array — populated on upload/generate';
