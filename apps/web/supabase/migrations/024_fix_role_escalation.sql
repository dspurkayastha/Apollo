-- 024: Prevent role escalation via profile update
--
-- The "Users can update own profile" policy allows users to set their own
-- role to 'admin' or 'supervisor'. Fix: use a SECURITY DEFINER helper to
-- ensure the role column cannot be changed via the update policy.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_current_user_role();
--   Then re-run the original 002 "Users can update own profile" policy.

-- Helper: get the current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users
  WHERE clerk_user_id = (SELECT auth.jwt() ->> 'sub')
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace the permissive update policy with one that prevents role changes
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (clerk_user_id = (select auth.jwt() ->> 'sub'))
  WITH CHECK (
    clerk_user_id = (select auth.jwt() ->> 'sub')
    AND role = public.get_current_user_role()
  );
