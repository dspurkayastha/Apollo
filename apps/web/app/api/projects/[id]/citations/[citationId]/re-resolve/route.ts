import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveAllEntries } from "@/lib/citations/resolve";
import { searchCrossRef, lookupDOI } from "@/lib/citations/crossref";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; citationId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, citationId } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    // Fetch the citation
    const { data: citation, error: citationError } = await supabase
      .from("citations")
      .select("*")
      .eq("id", citationId)
      .eq("project_id", id)
      .single();

    if (citationError || !citation) {
      return notFound("Citation not found");
    }

    const citeKey = citation.cite_key as string;
    const existingBibtex = (citation.bibtex_entry as string) ?? "";

    // Strategy 1: Re-resolve from existing BibTeX if available
    if (existingBibtex.trim()) {
      const { resolved } = await resolveAllEntries(existingBibtex);
      if (resolved.length > 0 && resolved[0].provenanceTier !== "D") {
        const r = resolved[0];
        const now = new Date().toISOString();
        await supabase
          .from("citations")
          .update({
            bibtex_entry: r.bibtex,
            provenance_tier: r.provenanceTier,
            evidence_type: r.evidenceType,
            evidence_value: r.evidenceValue,
            source_doi: r.sourceDoi,
            source_pmid: r.sourcePmid,
            verified_at: r.provenanceTier === "A" ? now : null,
            updated_at: now,
          })
          .eq("id", citationId);

        return NextResponse.json({
          data: { tier: r.provenanceTier, doi: r.sourceDoi },
        });
      }
    }

    // Strategy 2: Search CrossRef by cite key pattern
    const keyMatch = citeKey.match(/^([a-zA-Z]+)(\d{4})/);
    if (keyMatch) {
      const searchQuery = `${keyMatch[1]} ${keyMatch[2]}`;
      const results = await searchCrossRef(searchQuery, 3);

      for (const item of results.items) {
        if (!item.doi) continue;
        const doiResult = await lookupDOI(item.doi);
        if (doiResult?.bibtex) {
          const bibtex = doiResult.bibtex.replace(
            /^(@\w+\{)[^,]+,/m,
            `$1${citeKey},`
          );
          const now = new Date().toISOString();
          await supabase
            .from("citations")
            .update({
              bibtex_entry: bibtex,
              provenance_tier: "B",
              evidence_type: "doi",
              evidence_value: item.doi,
              source_doi: item.doi,
              verified_at: null,
              updated_at: now,
            })
            .eq("id", citationId);

          return NextResponse.json({
            data: { tier: "B", doi: item.doi },
          });
        }
      }
    }

    // Strategy 3: No luck — still Tier D
    return NextResponse.json({
      data: { tier: "D", doi: null, message: "Could not resolve — please attest manually or replace" },
    });
  } catch (err) {
    console.error("Error in POST /citations/[citationId]/re-resolve:", err);
    return internalError();
  }
}
