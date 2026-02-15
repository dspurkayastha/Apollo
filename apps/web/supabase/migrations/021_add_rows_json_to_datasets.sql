-- 021: Add rows_json column to datasets for storing parsed CSV/XLSX rows
-- This allows the analysis runner to access actual data without re-downloading from R2
-- Rollback: ALTER TABLE public.datasets DROP COLUMN IF EXISTS rows_json;

ALTER TABLE public.datasets ADD COLUMN rows_json JSONB;

COMMENT ON COLUMN public.datasets.rows_json IS 'Parsed data rows from uploaded CSV/XLSX, stored as JSON array of objects';
