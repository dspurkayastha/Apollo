-- 002: Create users table
-- Rollback: DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'supervisor', 'admin')),
  organisation_id UUID REFERENCES public.organisations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_clerk_id ON public.users(clerk_user_id);
CREATE INDEX idx_users_organisation_id ON public.users(organisation_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (clerk_user_id = (select auth.jwt()->>'sub'));

-- Users can update their own row
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (clerk_user_id = (select auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (select auth.jwt()->>'sub'));

-- Admins can read users in their organisation
CREATE POLICY "Admins can view org users"
  ON public.users FOR SELECT TO authenticated
  USING (
    organisation_id IN (
      SELECT u.organisation_id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
        AND u.role = 'admin'
    )
  );
