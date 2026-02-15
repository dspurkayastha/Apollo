-- 023: Create review system for supervisor collaboration
-- review_tokens: shareable read-only links with expiry
-- review_comments: supervisor feedback on sections
-- Rollback: DROP TABLE IF EXISTS public.review_comments CASCADE; DROP TABLE IF EXISTS public.review_tokens CASCADE;

CREATE TABLE public.review_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_tokens_token ON public.review_tokens(token);
CREATE INDEX idx_review_tokens_project_id ON public.review_tokens(project_id);

CREATE TABLE public.review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  review_token_id UUID NOT NULL REFERENCES public.review_tokens(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  phase_number INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_comments_project_id ON public.review_comments(project_id);

-- RLS: review_tokens are managed by authenticated users
ALTER TABLE public.review_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project review tokens"
  ON public.review_tokens FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- review_comments have no RLS — they're accessed via token validation in API routes
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project review comments"
  ON public.review_comments FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON u.id = p.user_id
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );
