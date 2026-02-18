-- Temporary column for streaming content during AI generation.
-- Holds partial content for Supabase Realtime live preview.
-- Cleared on generation completion.
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS streaming_content text DEFAULT '';

COMMENT ON COLUMN public.sections.streaming_content IS
  'Holds partial content during AI generation. Cleared on completion. Used by Realtime subscriptions for live preview.';
