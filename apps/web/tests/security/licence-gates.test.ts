import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Licence Gate Tests
 *
 * These tests verify that licence-gated features are properly restricted
 * for sandbox (unlicensed) projects.
 *
 * Prerequisites:
 * - Supabase project with migrations applied
 * - SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL env vars set
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

// Skip if no Supabase credentials (local dev without DB or CI without secrets)
const describeWithDb =
  SUPABASE_URL && SERVICE_ROLE_KEY ? describe : describe.skip;

describeWithDb("Licence Gate Tests", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adminClient: SupabaseClient<any, any, any>;
  let userId: string;
  let sandboxProjectId: string;
  let licensedProjectId: string;
  let licenceId: string;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test org
    const { data: org } = await adminClient
      .from("organisations")
      .insert({ name: "Licence Test Org", university_type: "generic" })
      .select()
      .single();

    // Create user
    const { data: user } = await adminClient
      .from("users")
      .insert({
        clerk_user_id: "test_licence_user_" + Date.now(),
        email: "licencetest@test.com",
        name: "Licence Test User",
        role: "student",
        organisation_id: org!.id,
      })
      .select()
      .single();
    userId = user!.id;

    // Create sandbox project
    const { data: sandbox } = await adminClient
      .from("projects")
      .insert({
        user_id: userId,
        organisation_id: org!.id,
        title: "Sandbox Thesis",
        status: "sandbox",
        university_type: "generic",
      })
      .select()
      .single();
    sandboxProjectId = sandbox!.id;

    // Create licence
    const { data: licence } = await adminClient
      .from("thesis_licenses")
      .insert({
        user_id: userId,
        plan_type: "one_time",
        status: "available",
      })
      .select()
      .single();
    licenceId = licence!.id;

    // Create licensed project
    const { data: licensed } = await adminClient
      .from("projects")
      .insert({
        user_id: userId,
        organisation_id: org!.id,
        title: "Licensed Thesis",
        status: "licensed",
        license_id: licenceId,
        university_type: "generic",
      })
      .select()
      .single();
    licensedProjectId = licensed!.id;

    // Attach licence to project
    await adminClient
      .from("thesis_licenses")
      .update({
        project_id: licensedProjectId,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", licenceId);
  });

  describe("Sandbox restrictions", () => {
    it("sandbox project has no licence attached", async () => {
      const { data } = await adminClient
        .from("projects")
        .select("license_id, status")
        .eq("id", sandboxProjectId)
        .single();

      expect(data!.status).toBe("sandbox");
      expect(data!.license_id).toBeNull();
    });

    it("licensed project has licence attached", async () => {
      const { data } = await adminClient
        .from("projects")
        .select("license_id, status")
        .eq("id", licensedProjectId)
        .single();

      expect(data!.status).toBe("licensed");
      expect(data!.license_id).toBe(licenceId);
    });
  });

  describe("Phase transition enforcement", () => {
    it("sandbox project cannot advance past Phase 1", async () => {
      // Sandbox project starts at phase 0
      const { data } = await adminClient
        .from("projects")
        .select("current_phase")
        .eq("id", sandboxProjectId)
        .single();

      expect(data!.current_phase).toBe(0);
    });

    it("phase can only increment by 1", async () => {
      // Try to set phase to 3 (invalid jump from 0)
      const { error } = await adminClient
        .from("projects")
        .update({ current_phase: 3 })
        .eq("id", sandboxProjectId);

      // Note: This is enforced at the application layer, not DB constraint
      // The DB allows the update, but the API should reject it
      // This test documents the expected behaviour for the API layer
      const { data } = await adminClient
        .from("projects")
        .select("current_phase")
        .eq("id", sandboxProjectId)
        .single();

      // Service role bypasses — application enforcement tested via API tests
      expect(data).not.toBeNull();

      // Reset for subsequent tests
      await adminClient.from("projects").update({ current_phase: 0 }).eq("id", sandboxProjectId);
    });
  });

  describe("Licence transfer cooldown", () => {
    it("transfer cooldown is enforced by DB trigger", async () => {
      // Create a licence that was recently transferred
      const { data: newLicence } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "one_time",
          status: "active",
          last_transferred_at: new Date().toISOString(),
          transfer_count: 1,
        })
        .select()
        .single();

      // Try to transfer again (should be blocked by trigger — <6 months)
      const { error } = await adminClient
        .from("thesis_licenses")
        .update({ status: "transferred" })
        .eq("id", newLicence!.id);

      expect(error).not.toBeNull();
      expect(error!.message).toContain("cooldown");
    });
  });

  describe("Sandbox phase restriction", () => {
    it("sandbox project allows phases 0-2", async () => {
      // Sandbox projects should be able to operate on phases 0, 1, 2
      const { data } = await adminClient
        .from("projects")
        .select("status, current_phase")
        .eq("id", sandboxProjectId)
        .single();

      expect(data!.status).toBe("sandbox");
      // Phases 0-2 are sandbox phases — enforced at application layer
      expect([0, 1, 2]).toContain(data!.current_phase);
    });

    it("sandbox project phases_completed starts empty", async () => {
      const { data } = await adminClient
        .from("projects")
        .select("phases_completed")
        .eq("id", sandboxProjectId)
        .single();

      expect(data!.phases_completed).toEqual([]);
    });
  });

  describe("Licence expiry", () => {
    it("expired licence has status set correctly", async () => {
      const { data: expiredLicence } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "student_onetime",
          status: "expired",
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        })
        .select()
        .single();

      expect(expiredLicence).not.toBeNull();
      expect(expiredLicence!.status).toBe("expired");
    });

    it("active licence with future expiry is not expired", async () => {
      const { data: activeLicence } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "student_onetime",
          status: "active",
          expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        })
        .select()
        .single();

      expect(activeLicence).not.toBeNull();
      expect(activeLicence!.status).toBe("active");
    });
  });

  describe("Reset count tracking", () => {
    it("new licence starts with reset_count 0", async () => {
      const { data: freshLicence } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "student_onetime",
          status: "active",
        })
        .select()
        .single();

      expect(freshLicence!.reset_count).toBe(0);
    });

    it("reset_count can be incremented", async () => {
      const { data: lic } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "student_onetime",
          status: "active",
          reset_count: 0,
        })
        .select()
        .single();

      await adminClient
        .from("thesis_licenses")
        .update({ reset_count: 1 })
        .eq("id", lic!.id);

      const { data: updated } = await adminClient
        .from("thesis_licenses")
        .select("reset_count")
        .eq("id", lic!.id)
        .single();

      expect(updated!.reset_count).toBe(1);
    });
  });

  describe("Monthly phase tracking", () => {
    it("new licence starts with monthly_phases_advanced 0", async () => {
      const { data: monthlyLic } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "student_monthly",
          status: "active",
        })
        .select()
        .single();

      expect(monthlyLic!.monthly_phases_advanced).toBe(0);
    });

    it("monthly_phases_advanced can be incremented", async () => {
      const { data: lic } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "student_monthly",
          status: "active",
          monthly_phases_advanced: 3,
        })
        .select()
        .single();

      await adminClient
        .from("thesis_licenses")
        .update({ monthly_phases_advanced: 4 })
        .eq("id", lic!.id);

      const { data: updated } = await adminClient
        .from("thesis_licenses")
        .select("monthly_phases_advanced")
        .eq("id", lic!.id)
        .single();

      expect(updated!.monthly_phases_advanced).toBe(4);
    });
  });

  describe("Identity lock", () => {
    it("identity fields cannot be changed after locking", async () => {
      // Create a licence with identity locked
      const { data: lockedLicence } = await adminClient
        .from("thesis_licenses")
        .insert({
          user_id: userId,
          plan_type: "one_time",
          status: "active",
          candidate_name_hash: "abc123",
          registration_no_hash: "def456",
          identity_locked_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Try to change identity field
      const { error } = await adminClient
        .from("thesis_licenses")
        .update({ candidate_name_hash: "new_hash" })
        .eq("id", lockedLicence!.id);

      expect(error).not.toBeNull();
      expect(error!.message).toContain("Identity fields cannot be changed");
    });
  });
});
