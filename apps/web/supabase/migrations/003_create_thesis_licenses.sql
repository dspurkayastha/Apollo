-- 003: Create thesis_licenses table
-- Rollback: DROP TABLE IF EXISTS public.thesis_licenses CASCADE;

CREATE TABLE public.thesis_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  project_id UUID UNIQUE,  -- null until attached; one licence per project
  plan_type TEXT NOT NULL CHECK (plan_type IN ('student_monthly', 'professional_monthly', 'addon', 'one_time', 'institutional')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'active', 'expired', 'transferred')),
  candidate_name_hash TEXT,  -- SHA-256 of normalised candidate name
  registration_no_hash TEXT,  -- SHA-256 of normalised registration number
  university TEXT,
  guide_name_hash TEXT,  -- SHA-256 of normalised guide name
  identity_locked_at TIMESTAMPTZ,  -- immutable once set (Phase 1→2)
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  transfer_count INTEGER NOT NULL DEFAULT 0,
  last_transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_thesis_licenses_user_id ON public.thesis_licenses(user_id);

ALTER TABLE public.thesis_licenses ENABLE ROW LEVEL SECURITY;

-- Users can view their own licences
CREATE POLICY "Users can view own licences"
  ON public.thesis_licenses FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Users can update their own licences (attach, transfer)
CREATE POLICY "Users can update own licences"
  ON public.thesis_licenses FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- Trigger: prevent identity changes after lock
CREATE OR REPLACE FUNCTION prevent_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.identity_locked_at IS NOT NULL THEN
    IF NEW.candidate_name_hash IS DISTINCT FROM OLD.candidate_name_hash
       OR NEW.registration_no_hash IS DISTINCT FROM OLD.registration_no_hash
       OR NEW.guide_name_hash IS DISTINCT FROM OLD.guide_name_hash
       OR NEW.university IS DISTINCT FROM OLD.university THEN
      RAISE EXCEPTION 'Identity fields cannot be changed after locking';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_identity_lock
  BEFORE UPDATE ON public.thesis_licenses
  FOR EACH ROW EXECUTE FUNCTION prevent_identity_change();

-- Trigger: enforce 6-month transfer cooldown
CREATE OR REPLACE FUNCTION enforce_transfer_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'transferred' AND OLD.status != 'transferred' THEN
    IF OLD.last_transferred_at IS NOT NULL
       AND OLD.last_transferred_at + INTERVAL '6 months' > now() THEN
      RAISE EXCEPTION 'Transfer cooldown: must wait 6 months between transfers';
    END IF;
    NEW.last_transferred_at := now();
    NEW.transfer_count := OLD.transfer_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_transfer_cooldown
  BEFORE UPDATE ON public.thesis_licenses
  FOR EACH ROW EXECUTE FUNCTION enforce_transfer_cooldown();
