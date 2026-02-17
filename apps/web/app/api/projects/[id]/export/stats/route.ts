import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { checkLicenceGate } from "@/lib/api/licence-gate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const gateResult = await checkLicenceGate(id, authResult.user.id);
    if (gateResult instanceof NextResponse) return gateResult;

    // Block downloads for licensed projects before Phase 6
    if (gateResult.status === "licensed" && gateResult.currentPhase < 6) {
      return NextResponse.json(
        {
          error: {
            code: "DOWNLOAD_RESTRICTED",
            message: "Stats download available from Phase 6 onwards. Use the preview panel.",
          },
        },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();

    // Fetch analyses with R scripts and datasets
    const [analysesRes, datasetsRes] = await Promise.all([
      supabase
        .from("analyses")
        .select("analysis_type, r_script, results_json, parameters_json, status")
        .eq("project_id", id)
        .eq("status", "completed"),
      supabase
        .from("datasets")
        .select("file_url, row_count, columns_json, rows_json")
        .eq("project_id", id),
    ]);

    const analyses = analysesRes.data ?? [];
    const datasets = datasetsRes.data ?? [];

    // Build stats bundle
    const statsBundle: Record<string, unknown> = {
      analyses: analyses.map((a) => ({
        type: a.analysis_type,
        r_script: a.r_script,
        results: a.results_json,
        parameters: a.parameters_json,
      })),
      datasets: datasets.map((d) => ({
        file: d.file_url,
        row_count: d.row_count,
        columns: d.columns_json,
        // Include first 10 rows as sample
        sample_rows: ((d.rows_json as Record<string, unknown>[] | null) ?? []).slice(0, 10),
      })),
    };

    return NextResponse.json(
      { data: statsBundle },
      {
        headers: {
          "Content-Disposition": `attachment; filename="thesis-stats.json"`,
        },
      }
    );
  } catch (err) {
    console.error("Stats export error:", err);
    return internalError();
  }
}
