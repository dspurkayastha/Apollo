import { describe, it, expect, vi } from "vitest";
import { canAdvancePhase, isValidPhase } from "./transitions";
import type { Project } from "@/lib/types/database";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-id",
    user_id: "user-id",
    organisation_id: null,
    status: "sandbox",
    license_id: null,
    title: "Test Project",
    synopsis_text: null,
    study_type: null,
    university_type: "wbuhs",
    metadata_json: {},
    current_phase: 0,
    phases_completed: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("canAdvancePhase", () => {
  it("should allow advancing from Phase 0 to Phase 1 when section is approved (sandbox)", () => {
    const project = makeProject({ current_phase: 0, status: "sandbox" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(true);
  });

  it("should deny advancing when section is not approved", () => {
    const project = makeProject({ current_phase: 0 });
    const result = canAdvancePhase(project, "draft");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SECTION_NOT_APPROVED");
  });

  it("should deny advancing when section status is null", () => {
    const project = makeProject({ current_phase: 0 });
    const result = canAdvancePhase(project, null);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SECTION_NOT_APPROVED");
  });

  it("should deny advancing from Phase 1 to Phase 2 without licence", () => {
    const project = makeProject({ current_phase: 1, status: "sandbox" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LICENCE_REQUIRED");
  });

  it("should allow advancing from Phase 1 to Phase 2 with licence", () => {
    const project = makeProject({ current_phase: 1, status: "licensed" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(true);
  });

  it("should allow approving the final phase (Phase 11) to complete the thesis", () => {
    const project = makeProject({ current_phase: 11, status: "licensed" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(true);
  });

  it("should deny advancing beyond the final phase", () => {
    const project = makeProject({ current_phase: 12, status: "completed" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("INVALID_TRANSITION");
  });

  it("should allow licensed projects to advance through middle phases", () => {
    const project = makeProject({ current_phase: 5, status: "licensed" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(true);
  });

  it("should deny DEV_LICENCE_BYPASS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LICENCE_BYPASS", "true");
    const project = makeProject({ current_phase: 1, status: "sandbox" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("LICENCE_REQUIRED");
    vi.unstubAllEnvs();
  });

  it("should allow DEV_LICENCE_BYPASS in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LICENCE_BYPASS", "true");
    const project = makeProject({ current_phase: 1, status: "sandbox" });
    const result = canAdvancePhase(project, "approved");
    expect(result.allowed).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("isValidPhase", () => {
  it("should accept valid phase numbers", () => {
    for (let i = 0; i <= 11; i++) {
      expect(isValidPhase(i)).toBe(true);
    }
  });

  it("should reject negative numbers", () => {
    expect(isValidPhase(-1)).toBe(false);
  });

  it("should reject numbers above MAX_PHASE", () => {
    expect(isValidPhase(12)).toBe(false);
  });

  it("should reject non-integers", () => {
    expect(isValidPhase(1.5)).toBe(false);
  });
});
