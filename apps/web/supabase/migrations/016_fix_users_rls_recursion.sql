-- 016: Fix infinite recursion in users RLS policy (error 42P17)
--
-- The "Admins can view org users" policy on public.users does
-- SELECT FROM public.users inside itself, causing infinite recursion
-- when Postgres evaluates RLS. Fix: SECURITY DEFINER helper functions
-- that bypass RLS for auth lookups.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_current_user_id();
--   DROP FUNCTION IF EXISTS public.get_current_user_org_id();
--   DROP FUNCTION IF EXISTS public.is_current_user_admin();
--   Then re-run the original 002 "Admins can view org users" policy.

-- Helper: get the current user's UUID (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users
  WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub')
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get the current user's organisation_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID AS $$
  SELECT organisation_id FROM public.users
  WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub')
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if the current user is an admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub')
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Fix users table ──

DROP POLICY IF EXISTS "Admins can view org users" ON public.users;

CREATE POLICY "Admins can view org users"
  ON public.users FOR SELECT TO authenticated
  USING (
    public.is_current_user_admin()
    AND organisation_id = public.get_current_user_org_id()
  );

-- ── Fix projects table (also queries users, triggering the recursion) ──

DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE TO authenticated
  USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "Admins can view org projects" ON public.projects;
CREATE POLICY "Admins can view org projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.is_current_user_admin()
    AND organisation_id = public.get_current_user_org_id()
  );

DROP POLICY IF EXISTS "Supervisors can view shared projects" ON public.projects;
CREATE POLICY "Supervisors can view shared projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    metadata_json ->> 'supervisor_user_id' = public.get_current_user_id()::text
  );
