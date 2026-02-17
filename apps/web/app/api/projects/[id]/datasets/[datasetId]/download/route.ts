import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; datasetId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, datasetId } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    // Fetch dataset and verify it belongs to this project
    const { data: dataset, error: datasetError } = await supabase
      .from("datasets")
      .select("columns_json, rows_json, file_url")
      .eq("id", datasetId)
      .eq("project_id", id)
      .single();

    if (datasetError || !dataset) {
      return notFound("Dataset not found");
    }

    const columns = dataset.columns_json as { name: string }[];
    const rows = dataset.rows_json as Record<string, unknown>[] | null;

    if (!columns || columns.length === 0) {
      return notFound("Dataset has no column definitions");
    }

    // Build CSV
    const headerRow = columns
      .map((col) => escapeCsvField(col.name))
      .join(",");

    const dataRows = (rows ?? []).map((row) =>
      columns
        .map((col) => {
          const val = row[col.name];
          return escapeCsvField(val == null ? "" : String(val));
        })
        .join(",")
    );

    const csv = [headerRow, ...dataRows].join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dataset.csv"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error(
      "Unexpected error in GET /api/projects/[id]/datasets/[datasetId]/download:",
      err
    );
    return internalError();
  }
}
