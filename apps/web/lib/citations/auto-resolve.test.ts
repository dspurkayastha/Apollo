import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSectionCitations } from "./auto-resolve";

// Mock dependencies
vi.mock("@/lib/latex/assemble", () => ({
  splitBibtex: vi.fn(),
}));

vi.mock("./resolve", () => ({
  resolveAllEntries: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveSectionCitations", () => {
  it("should resolve BibTeX trailer and upsert citations", async () => {
    const { splitBibtex } = await import("@/lib/latex/assemble");
    const { resolveAllEntries } = await import("./resolve");
    const { createAdminSupabaseClient } = await import(
      "@/lib/supabase/admin"
    );

    (splitBibtex as ReturnType<typeof vi.fn>).mockReturnValue({
      body: "\\section{Intro}",
      bib: "@article{smith2024, title = {Test}}",
    });

    (resolveAllEntries as ReturnType<typeof vi.fn>).mockResolvedValue({
      resolved: [
        {
          citeKey: "smith2024",
          bibtex: "@article{smith2024, title = {Verified}}",
          provenanceTier: "A",
          evidenceType: "doi",
          evidenceValue: "10.1234/test",
          sourceDoi: "10.1234/test",
          sourcePmid: null,
        },
      ],
      errors: [],
    });

    const mockUpsert = vi.fn().mockReturnValue({ error: null });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    (createAdminSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "citations") {
          return {
            select: mockSelect,
            upsert: mockUpsert,
          };
        }
        return {};
      }),
    });

    await resolveSectionCitations("project-1", "content---BIBTEX---bib");

    expect(splitBibtex).toHaveBeenCalledWith("content---BIBTEX---bib");
    expect(resolveAllEntries).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          project_id: "project-1",
          cite_key: "smith2024",
          provenance_tier: "A",
        }),
      ]),
      expect.objectContaining({ onConflict: "project_id,cite_key" })
    );
  });

  it("should skip when no BibTeX trailer exists", async () => {
    const { splitBibtex } = await import("@/lib/latex/assemble");
    const { resolveAllEntries } = await import("./resolve");

    (splitBibtex as ReturnType<typeof vi.fn>).mockReturnValue({
      body: "\\section{Intro}",
      bib: "",
    });

    await resolveSectionCitations("project-1", "content without bibtex");

    expect(resolveAllEntries).not.toHaveBeenCalled();
  });

  it("should not overwrite verified citations", async () => {
    const { splitBibtex } = await import("@/lib/latex/assemble");
    const { resolveAllEntries } = await import("./resolve");
    const { createAdminSupabaseClient } = await import(
      "@/lib/supabase/admin"
    );

    (splitBibtex as ReturnType<typeof vi.fn>).mockReturnValue({
      body: "",
      bib: "@article{verified2024, title = {Already Verified}}",
    });

    (resolveAllEntries as ReturnType<typeof vi.fn>).mockResolvedValue({
      resolved: [
        {
          citeKey: "verified2024",
          bibtex: "@article{verified2024, title = {New Version}}",
          provenanceTier: "A",
          evidenceType: "doi",
          evidenceValue: "10.1234/test",
          sourceDoi: "10.1234/test",
          sourcePmid: null,
        },
      ],
      errors: [],
    });

    const mockUpsert = vi.fn().mockReturnValue({ error: null });

    (createAdminSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  cite_key: "verified2024",
                  verified_at: "2024-01-01T00:00:00Z",
                  attested_at: null,
                },
              ],
            }),
          }),
        }),
        upsert: mockUpsert,
      })),
    });

    await resolveSectionCitations("project-1", "content---BIBTEX---bib");

    // Should NOT upsert because citation is already verified
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("should upsert new citations that are not in DB", async () => {
    const { splitBibtex } = await import("@/lib/latex/assemble");
    const { resolveAllEntries } = await import("./resolve");
    const { createAdminSupabaseClient } = await import(
      "@/lib/supabase/admin"
    );

    (splitBibtex as ReturnType<typeof vi.fn>).mockReturnValue({
      body: "",
      bib: "@article{new2024, title = {New}}",
    });

    (resolveAllEntries as ReturnType<typeof vi.fn>).mockResolvedValue({
      resolved: [
        {
          citeKey: "new2024",
          bibtex: "@article{new2024, title = {New}}",
          provenanceTier: "D",
          evidenceType: null,
          evidenceValue: null,
          sourceDoi: null,
          sourcePmid: null,
        },
      ],
      errors: [],
    });

    const mockUpsert = vi.fn().mockReturnValue({ error: null });

    (createAdminSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
        upsert: mockUpsert,
      })),
    });

    await resolveSectionCitations("project-1", "content---BIBTEX---bib");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cite_key: "new2024",
          provenance_tier: "D",
          verified_at: null,
        }),
      ]),
      expect.anything()
    );
  });
});
