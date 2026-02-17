import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  badRequest,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveAllEntries } from "@/lib/citations/resolve";
import { searchCrossRef, lookupDOI } from "@/lib/citations/crossref";

const AMERICAN_TO_BRITISH: [RegExp, string][] = [
  [/\banalyze\b/gi, "analyse"],
  [/\banalyzed\b/gi, "analysed"],
  [/\banalyzing\b/gi, "analysing"],
  [/\bbehavior\b/gi, "behaviour"],
  [/\bcolor\b/gi, "colour"],
  [/\bcenter\b/gi, "centre"],
  [/\brandomized\b/gi, "randomised"],
  [/\borganize\b/gi, "organise"],
  [/\borganized\b/gi, "organised"],
  [/\brecognize\b/gi, "recognise"],
  [/\brecognized\b/gi, "recognised"],
  [/\bspecialized\b/gi, "specialised"],
  [/\bfavor\b/gi, "favour"],
  [/\bhonor\b/gi, "honour"],
  [/\blabor\b/gi, "labour"],
  [/\btumor\b/gi, "tumour"],
  [/\bfetus\b/gi, "foetus"],
  [/\bpediatric\b/gi, "paediatric"],
  [/\banesthesia\b/gi, "anaesthesia"],
  [/\bhemoglobin\b/gi, "haemoglobin"],
  [/\besophagus\b/gi, "oesophagus"],
];

interface FixRequest {
  action: "re-resolve-citations" | "auto-fix-spelling" | "expand-section";
  phaseNumber?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const body = (await request.json()) as FixRequest;

    if (!body.action) {
      return badRequest("Missing action parameter");
    }

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

    switch (body.action) {
      case "re-resolve-citations": {
        // Batch re-resolve all Tier D citations
        const { data: tierDCitations } = await supabase
          .from("citations")
          .select("*")
          .eq("project_id", id)
          .eq("provenance_tier", "D");

        let resolved = 0;
        let failed = 0;

        for (const citation of tierDCitations ?? []) {
          const citeKey = citation.cite_key as string;
          const bibtex = (citation.bibtex_entry as string) ?? "";

          // Try re-resolving from existing BibTeX
          if (bibtex.trim()) {
            const { resolved: entries } = await resolveAllEntries(bibtex);
            if (entries.length > 0 && entries[0].provenanceTier !== "D") {
              const r = entries[0];
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
                .eq("id", citation.id);
              resolved++;
              continue;
            }
          }

          // Try CrossRef search
          const keyMatch = citeKey.match(/^([a-zA-Z]+)(\d{4})/);
          if (keyMatch) {
            const results = await searchCrossRef(
              `${keyMatch[1]} ${keyMatch[2]}`,
              1
            );
            if (results.items.length > 0 && results.items[0].doi) {
              const doiResult = await lookupDOI(results.items[0].doi);
              if (doiResult?.bibtex) {
                const now = new Date().toISOString();
                await supabase
                  .from("citations")
                  .update({
                    bibtex_entry: doiResult.bibtex.replace(
                      /^(@\w+\{)[^,]+,/m,
                      `$1${citeKey},`
                    ),
                    provenance_tier: "B",
                    evidence_type: "doi",
                    evidence_value: results.items[0].doi,
                    source_doi: results.items[0].doi,
                    verified_at: null,
                    updated_at: now,
                  })
                  .eq("id", citation.id);
                resolved++;
                continue;
              }
            }
          }

          failed++;
        }

        return NextResponse.json({
          data: {
            action: "re-resolve-citations",
            resolved,
            failed,
            total: (tierDCitations ?? []).length,
          },
        });
      }

      case "auto-fix-spelling": {
        // Replace American spellings with British across all sections
        const { data: sections } = await supabase
          .from("sections")
          .select("id, phase_number, latex_content")
          .eq("project_id", id)
          .in("status", ["review", "draft"]);

        let totalReplacements = 0;

        for (const section of sections ?? []) {
          if (!section.latex_content) continue;
          let content = section.latex_content as string;
          let changed = false;

          for (const [pattern, replacement] of AMERICAN_TO_BRITISH) {
            const newContent = content.replace(pattern, replacement);
            if (newContent !== content) {
              changed = true;
              totalReplacements++;
              content = newContent;
            }
          }

          if (changed) {
            await supabase
              .from("sections")
              .update({
                latex_content: content,
                updated_at: new Date().toISOString(),
              })
              .eq("id", section.id);
          }
        }

        return NextResponse.json({
          data: {
            action: "auto-fix-spelling",
            replacements: totalReplacements,
          },
        });
      }

      case "expand-section": {
        // Placeholder — triggers AI expansion (would be a streaming endpoint)
        // For now, return info about which section needs expansion
        if (!body.phaseNumber) {
          return badRequest("phaseNumber required for expand-section action");
        }

        return NextResponse.json({
          data: {
            action: "expand-section",
            phaseNumber: body.phaseNumber,
            message: "Use the Refine endpoint to expand this section",
            endpoint: `/api/projects/${id}/sections/${body.phaseNumber}/refine`,
          },
        });
      }

      default:
        return badRequest(`Unknown fix action: ${body.action}`);
    }
  } catch (err) {
    console.error("Error in POST /api/projects/[id]/qc/fix:", err);
    return internalError();
  }
}
