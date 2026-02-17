-- 025: Pricing & Licence System Overhaul (Phase 3)
--
-- Adds columns for reset tracking, monthly phase gating, and billing period.
-- Updates plan_type CHECK to include new plan IDs.
-- Creates atomic attach_licence_to_project() RPC.
--
-- Rollback:
--   ALTER TABLE thesis_licenses DROP COLUMN IF EXISTS reset_count, monthly_phases_advanced, billing_period_start;
--   DROP FUNCTION IF EXISTS public.attach_licence_to_project(uuid, uuid, uuid);

-- 1. New columns on thesis_licenses
ALTER TABLE public.thesis_licenses
  ADD COLUMN IF NOT EXISTS reset_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_phases_advanced integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz;

-- 2. Update plan_type CHECK to accept new plan IDs (drop and re-create)
ALTER TABLE public.thesis_licenses DROP CONSTRAINT IF EXISTS thesis_licenses_plan_type_check;

ALTER TABLE public.thesis_licenses
  ADD CONSTRAINT thesis_licenses_plan_type_check
  CHECK (plan_type IN (
    'one_time',             -- legacy
    'student_onetime',
    'student_monthly',
    'professional_onetime',
    'professional_monthly',
    'addon',
    'institutional'
  ));

-- 3. Atomic licence attachment RPC
CREATE OR REPLACE FUNCTION public.attach_licence_to_project(
  p_licence_id uuid,
  p_project_id uuid,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_licence record;
  v_project record;
BEGIN
  -- Lock licence row
  SELECT * INTO v_licence
  FROM public.thesis_licenses
  WHERE id = p_licence_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'LICENCE_NOT_FOUND');
  END IF;

  IF v_licence.status <> 'available' THEN
    RETURN jsonb_build_object('error', 'LICENCE_NOT_AVAILABLE', 'detail', v_licence.status);
  END IF;

  -- Lock project row
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = p_project_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROJECT_NOT_FOUND');
  END IF;

  IF v_project.status <> 'sandbox' THEN
    RETURN jsonb_build_object('error', 'PROJECT_NOT_SANDBOX', 'detail', v_project.status);
  END IF;

  -- Atomically update both
  UPDATE public.thesis_licenses
  SET project_id = p_project_id,
      status = 'active',
      activated_at = now()
  WHERE id = p_licence_id;

  UPDATE public.projects
  SET license_id = p_licence_id,
      status = 'licensed',
      updated_at = now()
  WHERE id = p_project_id;

  RETURN jsonb_build_object('ok', true, 'licence_id', p_licence_id, 'project_id', p_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
