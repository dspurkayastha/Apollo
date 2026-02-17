-- 017: Add rich_content_json column to sections
-- Sprint 3-4: Stores Tiptap JSON for rich text editing

ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS rich_content_json JSONB DEFAULT NULL;

COMMENT ON COLUMN sections.rich_content_json IS
  'Tiptap JSON AST for rich text editor. NULL when latex_content was edited directly in source view (stale indicator).';
