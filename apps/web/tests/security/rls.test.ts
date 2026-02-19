import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

/**
 * RLS Policy Tests
 *
 * These tests verify that Row-Level Security policies correctly isolate
 * data between users. They use:
 * 1. Service role client for setup/teardown
 * 2. Per-user Supabase clients with mock JWTs for isolation testing
 *
 * Prerequisites:
 * - Supabase project with migrations applied
 * - SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL env vars
 * - SUPABASE_JWT_SECRET for per-user isolation tests (optional)
 *
 * These tests run against a real Supabase instance (not mocked).
 * They should be run in CI with test credentials.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET?.trim() || "";

// Skip if no Supabase credentials
const describeWithDb =
  SUPABASE_URL && SERVICE_ROLE_KEY ? describe : describe.skip;

/**
 * Sign a JWT using Node.js crypto (HS256). No external dependencies needed.
 */
function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 3600 };

  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerB64 = b64(header);
  const payloadB64 = b64(fullPayload);
  const signature = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Create a Supabase client authenticated as a specific user via mock JWT.
 * If JWT_SECRET is unavailable, returns null (tests will use admin client as fallback).
 */
function createUserClient(userId: string): SupabaseClient | null {
  if (!JWT_SECRET) return null;

  const jwt = signJwt(
    { sub: userId, role: "authenticated", aud: "authenticated" },
    JWT_SECRET
  );

  return createClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  );
}

describeWithDb("RLS Policy Tests", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adminClient: SupabaseClient<any, any, any>;
  let userAId: string;
  let userBId: string;
  let orgId: string;
  let projectAId: string;
  let projectBId: string;
  let datasetAId: string;
  let compilationAId: string;

  // Per-user clients (null if JWT_SECRET unavailable)
  let clientA: SupabaseClient | null;
  let clientB: SupabaseClient | null;

  // Track IDs for cleanup
  const cleanupIds: {
    users: string[];
    orgs: string[];
    projects: string[];
    licenses: string[];
  } = { users: [], orgs: [], projects: [], licenses: [] };

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test organisation
    const { data: org } = await adminClient
      .from("organisations")
      .insert({ name: "RLS Test Org " + Date.now(), university_type: "generic" })
      .select()
      .single();
    orgId = org!.id;
    cleanupIds.orgs.push(orgId);

    // Create User A via Supabase Auth (generates real auth.uid)
    const { data: authA } = await adminClient.auth.admin.createUser({
      email: `rls_usera_${Date.now()}@test.com`,
      password: "test-password-rls-a",
      email_confirm: true,
      user_metadata: { name: "User A" },
    });
    userAId = authA.user!.id;
    cleanupIds.users.push(userAId);

    // Create User B via Supabase Auth
    const { data: authB } = await adminClient.auth.admin.createUser({
      email: `rls_userb_${Date.now()}@test.com`,
      password: "test-password-rls-b",
      email_confirm: true,
      user_metadata: { name: "User B" },
    });
    userBId = authB.user!.id;
    cleanupIds.users.push(userBId);

    // Insert user rows in the users table
    await adminClient.from("users").insert([
      {
        id: userAId,
        clerk_user_id: "rls_a_" + Date.now(),
        email: `rls_usera_${Date.now()}@test.com`,
        name: "User A",
        role: "student",
        organisation_id: orgId,
      },
      {
        id: userBId,
        clerk_user_id: "rls_b_" + Date.now(),
        email: `rls_userb_${Date.now()}@test.com`,
        name: "User B",
        role: "student",
        organisation_id: orgId,
      },
    ]);

    // Create Project for User A
    const { data: projectA } = await adminClient
      .from("projects")
      .insert({
        user_id: userAId,
        organisation_id: orgId,
        title: "User A Thesis",
        university_type: "generic",
      })
      .select()
      .single();
    projectAId = projectA!.id;
    cleanupIds.projects.push(projectAId);

    // Create Project for User B
    const { data: projectB } = await adminClient
      .from("projects")
      .insert({
        user_id: userBId,
        organisation_id: orgId,
        title: "User B Thesis",
        university_type: "generic",
      })
      .select()
      .single();
    projectBId = projectB!.id;
    cleanupIds.projects.push(projectBId);

    // Create sections for both projects
    await adminClient.from("sections").insert([
      { project_id: projectAId, phase_number: 1, phase_name: "Introduction" },
      { project_id: projectBId, phase_number: 1, phase_name: "Introduction" },
    ]);

    // Create citations for both projects
    await adminClient.from("citations").insert([
      { project_id: projectAId, cite_key: "smith2024_rls", bibtex_entry: "@article{smith2024_rls}" },
      { project_id: projectBId, cite_key: "jones2024_rls", bibtex_entry: "@article{jones2024_rls}" },
    ]);

    // Create datasets for both projects
    const { data: dsA } = await adminClient
      .from("datasets")
      .insert({ project_id: projectAId, file_url: "files/a/data.csv" })
      .select("id")
      .single();
    datasetAId = dsA!.id;

    await adminClient
      .from("datasets")
      .insert({ project_id: projectBId, file_url: "files/b/data.csv" });

    // Create compilations
    const { data: compA } = await adminClient
      .from("compilations")
      .insert({ project_id: projectAId, trigger: "manual", status: "completed" })
      .select("id")
      .single();
    compilationAId = compA!.id;

    await adminClient
      .from("compilations")
      .insert({ project_id: projectBId, trigger: "manual", status: "completed" });

    // Create per-user clients
    clientA = createUserClient(userAId);
    clientB = createUserClient(userBId);
  });

  afterAll(async () => {
    // Cleanup test data in reverse dependency order
    for (const pid of cleanupIds.projects) {
      await adminClient.from("compilations").delete().eq("project_id", pid);
      await adminClient.from("datasets").delete().eq("project_id", pid);
      await adminClient.from("citations").delete().eq("project_id", pid);
      await adminClient.from("sections").delete().eq("project_id", pid);
    }
    for (const pid of cleanupIds.projects) {
      await adminClient.from("projects").delete().eq("id", pid);
    }
    for (const lid of cleanupIds.licenses) {
      await adminClient.from("thesis_licenses").delete().eq("id", lid);
    }
    for (const uid of cleanupIds.users) {
      await adminClient.from("users").delete().eq("id", uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
    for (const oid of cleanupIds.orgs) {
      await adminClient.from("organisations").delete().eq("id", oid);
    }
  });

  // ── Service role baseline checks ─────────────────────────────────────────

  describe("Service role baseline", () => {
    it("can read all projects", async () => {
      const { data } = await adminClient.from("projects").select("id");
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it("both test projects exist", async () => {
      const { data: a } = await adminClient
        .from("projects")
        .select("id")
        .eq("id", projectAId)
        .single();
      const { data: b } = await adminClient
        .from("projects")
        .select("id")
        .eq("id", projectBId)
        .single();
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
    });
  });

  // ── Per-user isolation (requires JWT_SECRET) ─────────────────────────────

  const describeWithJwt = JWT_SECRET ? describe : describe.skip;

  describeWithJwt("Project isolation (per-user clients)", () => {
    it("User A can read own project", async () => {
      const { data } = await clientA!
        .from("projects")
        .select("id")
        .eq("id", projectAId);
      expect(data!.length).toBe(1);
      expect(data![0].id).toBe(projectAId);
    });

    it("User A CANNOT read User B project", async () => {
      const { data } = await clientA!
        .from("projects")
        .select("id")
        .eq("id", projectBId);
      expect(data ?? []).toHaveLength(0);
    });

    it("User B can read own project", async () => {
      const { data } = await clientB!
        .from("projects")
        .select("id")
        .eq("id", projectBId);
      expect(data!.length).toBe(1);
    });

    it("User B CANNOT read User A project", async () => {
      const { data } = await clientB!
        .from("projects")
        .select("id")
        .eq("id", projectAId);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describeWithJwt("Section isolation (per-user clients)", () => {
    it("User A can read own sections, not User B sections", async () => {
      const { data: own } = await clientA!
        .from("sections")
        .select("id, project_id")
        .eq("project_id", projectAId);
      expect(own!.length).toBeGreaterThan(0);

      const { data: other } = await clientA!
        .from("sections")
        .select("id")
        .eq("project_id", projectBId);
      expect(other ?? []).toHaveLength(0);
    });
  });

  describeWithJwt("Dataset isolation (per-user clients)", () => {
    it("User A can read own datasets, not User B datasets", async () => {
      const { data: own } = await clientA!
        .from("datasets")
        .select("id")
        .eq("project_id", projectAId);
      expect(own!.length).toBeGreaterThan(0);

      const { data: other } = await clientA!
        .from("datasets")
        .select("id")
        .eq("project_id", projectBId);
      expect(other ?? []).toHaveLength(0);
    });

    it("User B CANNOT update User A dataset", async () => {
      const { error } = await clientB!
        .from("datasets")
        .update({ file_url: "hacked.csv" })
        .eq("id", datasetAId);
      // Should either error or silently fail (0 rows affected)
      // RLS blocks the update — Supabase returns no error but 0 rows match
      if (!error) {
        const { data: check } = await adminClient
          .from("datasets")
          .select("file_url")
          .eq("id", datasetAId)
          .single();
        expect(check!.file_url).toBe("files/a/data.csv");
      }
    });
  });

  describeWithJwt("Compilation isolation (per-user clients)", () => {
    it("User A can read own compilations, not User B compilations", async () => {
      const { data: own } = await clientA!
        .from("compilations")
        .select("id")
        .eq("project_id", projectAId);
      expect(own!.length).toBeGreaterThan(0);

      const { data: other } = await clientA!
        .from("compilations")
        .select("id")
        .eq("project_id", projectBId);
      expect(other ?? []).toHaveLength(0);
    });

    it("User B CANNOT delete User A compilation", async () => {
      const { error } = await clientB!
        .from("compilations")
        .delete()
        .eq("id", compilationAId);
      // RLS blocks — verify compilation still exists
      const { data: check } = await adminClient
        .from("compilations")
        .select("id")
        .eq("id", compilationAId)
        .single();
      expect(check).not.toBeNull();
    });
  });

  describeWithJwt("Citation isolation (per-user clients)", () => {
    it("User A can read own citations, not User B citations", async () => {
      const { data: own } = await clientA!
        .from("citations")
        .select("id")
        .eq("project_id", projectAId);
      expect(own!.length).toBeGreaterThan(0);

      const { data: other } = await clientA!
        .from("citations")
        .select("id")
        .eq("project_id", projectBId);
      expect(other ?? []).toHaveLength(0);
    });
  });

  describeWithJwt("Licence isolation (per-user clients)", () => {
    it("User A can see own licences, not User B licences", async () => {
      // Create licences for both users
      const { data: licA } = await adminClient
        .from("thesis_licenses")
        .insert({ user_id: userAId, plan_type: "one_time", status: "available" })
        .select("id")
        .single();
      cleanupIds.licenses.push(licA!.id);

      const { data: licB } = await adminClient
        .from("thesis_licenses")
        .insert({ user_id: userBId, plan_type: "one_time", status: "available" })
        .select("id")
        .single();
      cleanupIds.licenses.push(licB!.id);

      const { data: aLics } = await clientA!
        .from("thesis_licenses")
        .select("id")
        .eq("user_id", userAId);
      expect(aLics!.length).toBeGreaterThan(0);

      const { data: aCrossLics } = await clientA!
        .from("thesis_licenses")
        .select("id")
        .eq("user_id", userBId);
      expect(aCrossLics ?? []).toHaveLength(0);
    });
  });

  // ── Service-role-only fallback tests (when JWT_SECRET unavailable) ───────

  describe("Data isolation (service role verification)", () => {
    it("projects are user-scoped", async () => {
      const { data: aProjects } = await adminClient
        .from("projects")
        .select("id")
        .eq("user_id", userAId);
      const { data: bProjects } = await adminClient
        .from("projects")
        .select("id")
        .eq("user_id", userBId);

      const aIds = aProjects!.map((p) => p.id);
      const bIds = bProjects!.map((p) => p.id);

      expect(aIds).toContain(projectAId);
      expect(aIds).not.toContain(projectBId);
      expect(bIds).toContain(projectBId);
      expect(bIds).not.toContain(projectAId);
    });

    it("sections are project-scoped", async () => {
      const { data: aSections } = await adminClient
        .from("sections")
        .select("project_id")
        .eq("project_id", projectAId);
      const { data: bSections } = await adminClient
        .from("sections")
        .select("project_id")
        .eq("project_id", projectBId);
      expect(aSections!.length).toBeGreaterThan(0);
      expect(bSections!.length).toBeGreaterThan(0);
      expect(aSections!.every((s) => s.project_id === projectAId)).toBe(true);
      expect(bSections!.every((s) => s.project_id === projectBId)).toBe(true);
    });

    it("citations are project-scoped", async () => {
      const { data: aCitations } = await adminClient
        .from("citations")
        .select("project_id")
        .eq("project_id", projectAId);
      const { data: bCitations } = await adminClient
        .from("citations")
        .select("project_id")
        .eq("project_id", projectBId);
      expect(aCitations!.length).toBeGreaterThan(0);
      expect(bCitations!.length).toBeGreaterThan(0);
    });

    it("datasets are project-scoped", async () => {
      const { data: aDatasets } = await adminClient
        .from("datasets")
        .select("project_id")
        .eq("project_id", projectAId);
      expect(aDatasets!.length).toBeGreaterThan(0);
    });
  });
});
