-- 019: Add ai_generated_latex column to sections
-- Stores original AI-generated LaTeX for diff comparison during review.
-- Never modified by user edits — only set during AI generation.
-- Rollback: ALTER TABLE public.sections DROP COLUMN IF EXISTS ai_generated_latex;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS ai_generated_latex TEXT DEFAULT NULL;

COMMENT ON COLUMN public.sections.ai_generated_latex IS
  'Original AI-generated LaTeX preserved for review diff. NULL for manually-created sections.';
