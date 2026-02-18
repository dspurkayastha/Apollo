import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
  badRequest,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { datasetColumnsSchema } from "@/lib/validation/dataset-schemas";
import { parseCSV, parseExcel } from "@/lib/datasets/parse";
import type { Dataset } from "@/lib/types/database";

// ── GET /api/projects/:id/datasets — List datasets ──────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { data: datasets, error } = await supabase
      .from("datasets")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch datasets:", error);
      return internalError();
    }

    return NextResponse.json({ data: datasets as Dataset[] });
  } catch (err) {
    console.error("Unexpected error in GET datasets:", err);
    return internalError();
  }
}

// ── POST /api/projects/:id/datasets — Upload dataset ────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const formData = await request.formData();
    const file = formData.get("file");
    const columnsRaw = formData.get("columns");

    if (!file || !(file instanceof File)) {
      return badRequest("No file provided");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type;

    // Parse file based on content type
    let parsed;
    try {
      if (
        contentType === "text/csv" ||
        file.name.endsWith(".csv")
      ) {
        parsed = parseCSV(buffer);
      } else if (
        contentType ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.name.endsWith(".xlsx")
      ) {
        parsed = parseExcel(buffer);
      } else {
        return validationError("Unsupported file type. Upload CSV or XLSX.");
      }
    } catch (parseErr) {
      return validationError(
        parseErr instanceof Error ? parseErr.message : "Failed to parse file"
      );
    }

    // Optionally apply column metadata from client
    let columnsJson = parsed.columns.map((c) => ({
      name: c.name,
      type: c.type,
    }));

    if (columnsRaw && typeof columnsRaw === "string") {
      try {
        const colParsed = datasetColumnsSchema.safeParse(
          JSON.parse(columnsRaw)
        );
        if (colParsed.success) {
          columnsJson = colParsed.data.columns;
        }
      } catch {
        // Ignore invalid column metadata — use auto-detected
      }
    }

    // Upload to R2 (or store URL reference)
    // For now store a data URI placeholder — real R2 upload in production
    const fileUrl = `datasets/${id}/${Date.now()}_${file.name}`;

    const { data: dataset, error } = await supabase
      .from("datasets")
      .insert({
        project_id: id,
        file_url: fileUrl,
        row_count: parsed.rowCount,
        columns_json: columnsJson,
        rows_json: parsed.rows,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert dataset:", error);
      return internalError();
    }

    // Reset analysis plan if dataset changed (columns may differ)
    await supabase
      .from("projects")
      .update({ analysis_plan_status: "pending", analysis_plan_json: [] })
      .eq("id", id)
      .neq("analysis_plan_status", "pending");

    return NextResponse.json(
      {
        data: {
          ...(dataset as Dataset),
          preview: {
            headers: parsed.headers,
            rows: parsed.rows.slice(0, 10),
            totalRows: parsed.rowCount,
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected error in POST datasets:", err);
    return internalError();
  }
}
