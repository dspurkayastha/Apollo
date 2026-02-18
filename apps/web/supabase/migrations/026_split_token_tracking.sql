-- Add separate input/output token columns to ai_conversations
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0;

-- Backfill from total_tokens (assume 70% input, 30% output as approximation)
UPDATE public.ai_conversations
SET input_tokens = ROUND(total_tokens * 0.7),
    output_tokens = ROUND(total_tokens * 0.3)
WHERE input_tokens = 0 AND total_tokens > 0;

COMMENT ON COLUMN public.ai_conversations.total_tokens IS 'Legacy combined total. Use input_tokens + output_tokens for new records.';
