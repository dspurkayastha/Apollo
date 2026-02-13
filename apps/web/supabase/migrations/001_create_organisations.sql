-- 001: Create organisations table
-- Rollback: DROP TABLE IF EXISTS public.organisations CASCADE;

CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  university_type TEXT NOT NULL CHECK (university_type IN ('wbuhs', 'ssuhs', 'generic')),
  cls_config_json JSONB NOT NULL DEFAULT '{}',
  logo_urls JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Users can view organisations they belong to
CREATE POLICY "Users can view own organisation"
  ON public.organisations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT u.organisation_id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
