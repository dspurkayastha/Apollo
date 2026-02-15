import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { citationCreateSchema } from "@/lib/validation/citation-schemas";
import { lookupDOI } from "@/lib/citations/crossref";
import { lookupPMID, pubmedArticleToBibtex } from "@/lib/citations/pubmed";
import { resolveEntry, parseBibtexEntries } from "@/lib/citations/resolve";
import type { Citation } from "@/lib/types/database";

// ── GET /api/projects/:id/citations — List all citations ────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: citations, error } = await supabase
      .from("citations")
      .select("*")
      .eq("project_id", id)
      .order("serial_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch citations:", error);
      return internalError();
    }

    return NextResponse.json({ data: citations as Citation[] });
  } catch (err) {
    console.error("Unexpected error in GET citations:", err);
    return internalError();
  }
}

// ── POST /api/projects/:id/citations — Add/resolve a citation ───────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const body = await request.json();
    const parsed = citationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid citation data", {
        issues: parsed.error.issues,
      });
    }

    const { doi, pmid, cite_key, bibtex_entry } = parsed.data;
    const now = new Date().toISOString();

    // Route 1: DOI lookup → Tier A
    if (doi) {
      const result = await lookupDOI(doi);
      if (!result) {
        return validationError("DOI could not be resolved");
      }

      const citeKey = cite_key ?? generateCiteKey(result.work.authors, result.work.year);
      const bibtex = result.bibtex.replace(
        /^(@\w+\{)[^,]+,/m,
        `$1${citeKey},`
      );

      const { data: citation, error } = await supabase
        .from("citations")
        .upsert(
          {
            project_id: id,
            cite_key: citeKey,
            bibtex_entry: bibtex,
            provenance_tier: "A",
            evidence_type: "doi",
            evidence_value: doi,
            source_doi: doi,
            verified_at: now,
          },
          { onConflict: "project_id,cite_key" }
        )
        .select("*")
        .single();

      if (error) {
        console.error("Failed to upsert citation:", error);
        return internalError();
      }

      return NextResponse.json({ data: citation as Citation }, { status: 201 });
    }

    // Route 2: PMID lookup → Tier A
    if (pmid) {
      const article = await lookupPMID(pmid);
      if (!article) {
        return validationError("PMID could not be resolved");
      }

      const citeKey = cite_key ?? generateCiteKey(article.authors, article.year);
      const bibtex = await pubmedArticleToBibtex(article, citeKey);

      const { data: citation, error } = await supabase
        .from("citations")
        .upsert(
          {
            project_id: id,
            cite_key: citeKey,
            bibtex_entry: bibtex,
            provenance_tier: "A",
            evidence_type: "pmid",
            evidence_value: pmid,
            source_doi: article.doi,
            source_pmid: pmid,
            verified_at: now,
          },
          { onConflict: "project_id,cite_key" }
        )
        .select("*")
        .single();

      if (error) {
        console.error("Failed to upsert citation:", error);
        return internalError();
      }

      return NextResponse.json({ data: citation as Citation }, { status: 201 });
    }

    // Route 3: Raw BibTeX → auto-classify via resolveEntry
    if (bibtex_entry) {
      const entries = parseBibtexEntries(bibtex_entry);

      if (entries.size === 0) {
        return validationError("Could not parse BibTeX entry");
      }

      // Take the first entry
      const [parsedKey, rawEntry] = entries.entries().next().value!;
      const citeKey = cite_key ?? parsedKey;

      const resolved = await resolveEntry(citeKey, rawEntry);

      const { data: citation, error } = await supabase
        .from("citations")
        .upsert(
          {
            project_id: id,
            cite_key: resolved.citeKey,
            bibtex_entry: resolved.bibtex,
            provenance_tier: resolved.provenanceTier,
            evidence_type: resolved.evidenceType,
            evidence_value: resolved.evidenceValue,
            source_doi: resolved.sourceDoi,
            source_pmid: resolved.sourcePmid,
            verified_at: resolved.provenanceTier === "A" ? now : null,
          },
          { onConflict: "project_id,cite_key" }
        )
        .select("*")
        .single();

      if (error) {
        console.error("Failed to upsert citation:", error);
        return internalError();
      }

      return NextResponse.json({ data: citation as Citation }, { status: 201 });
    }

    // Should not reach here due to schema refine
    return validationError("Provide doi, pmid, or bibtex_entry");
  } catch (err) {
    console.error("Unexpected error in POST citations:", err);
    return internalError();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a cite key from first author surname + year (e.g. "smith2024").
 */
function generateCiteKey(
  authors: string[],
  year: number | null
): string {
  const firstAuthor = authors[0] ?? "unknown";
  const surname = firstAuthor.split(/\s+/).pop() ?? "unknown";
  const cleanSurname = surname
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 20);
  return `${cleanSurname || "ref"}${year ?? "nd"}`;
}
