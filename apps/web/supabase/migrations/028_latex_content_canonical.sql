-- Migration 028: Mark rich_content_json as deprecated (Phase 4)
-- LaTeX is now the canonical format; CodeMirror 6 is the sole editor.
-- Column retained for rollback safety only.

COMMENT ON COLUMN public.sections.rich_content_json IS
  'DEPRECATED (Phase 4). LaTeX is canonical. Retained for rollback only.';
