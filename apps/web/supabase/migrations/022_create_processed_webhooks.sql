-- 022: Create processed_webhooks table for payment webhook idempotency
-- Rollback: DROP TABLE IF EXISTS public.processed_webhooks CASCADE;

CREATE TABLE public.processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processed_webhooks_event_id ON public.processed_webhooks(event_id);

-- No RLS needed — this table is only accessed by server-side webhook handlers
