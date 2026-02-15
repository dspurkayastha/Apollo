import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, validationError, internalError } from "@/lib/api/errors";
import { citationSearchSchema } from "@/lib/validation/citation-schemas";
import { searchCrossRef } from "@/lib/citations/crossref";
import { searchPubMed } from "@/lib/citations/pubmed";

// ── GET /api/citations/search?q=...&source=...&limit=... ────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { searchParams } = new URL(request.url);
    const parsed = citationSearchSchema.safeParse({
      q: searchParams.get("q"),
      source: searchParams.get("source") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return validationError("Invalid search parameters", {
        issues: parsed.error.issues,
      });
    }

    const { q, source, limit } = parsed.data;

    if (source === "crossref") {
      const result = await searchCrossRef(q, limit);
      return NextResponse.json({
        data: {
          source: "crossref",
          items: result.items.map((item) => ({
            doi: item.doi,
            title: item.title,
            authors: item.authors,
            journal: item.journal,
            year: item.year,
            volume: item.volume,
            issue: item.issue,
            pages: item.pages,
          })),
          totalResults: result.totalResults,
        },
      });
    }

    // Default: PubMed
    const result = await searchPubMed(q, limit);
    return NextResponse.json({
      data: {
        source: "pubmed",
        items: result.items.map((item) => ({
          pmid: item.pmid,
          doi: item.doi,
          title: item.title,
          authors: item.authors,
          journal: item.journal,
          year: item.year,
          volume: item.volume,
          issue: item.issue,
          pages: item.pages,
        })),
        totalResults: result.totalResults,
      },
    });
  } catch (err) {
    console.error("Unexpected error in GET citations/search:", err);
    return internalError();
  }
}
