-- 018: Add rich_content_json column to sections
-- Stores Tiptap JSON alongside derived latex_content for dual storage.
-- Rollback: ALTER TABLE public.sections DROP COLUMN IF EXISTS rich_content_json;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS rich_content_json JSONB DEFAULT NULL;

COMMENT ON COLUMN public.sections.rich_content_json IS
  'Tiptap JSON from rich text editor. NULL when edited in source view (latex_content is canonical).';
