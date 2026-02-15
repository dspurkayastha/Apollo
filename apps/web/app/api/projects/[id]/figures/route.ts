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
import { figureUploadSchema } from "@/lib/validation/figure-schemas";
import type { Figure } from "@/lib/types/database";

// ── GET /api/projects/:id/figures — List figures ────────────────────────────

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

    const { data: figures, error } = await supabase
      .from("figures")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch figures:", error);
      return internalError();
    }

    return NextResponse.json({ data: figures as Figure[] });
  } catch (err) {
    console.error("Unexpected error in GET figures:", err);
    return internalError();
  }
}

// ── POST /api/projects/:id/figures — Upload figure ──────────────────────────

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
    const metadataRaw = formData.get("metadata");

    if (!file || !(file instanceof File)) {
      return badRequest("No file provided");
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return validationError("Unsupported file type. Upload PNG, JPEG, SVG, or PDF.");
    }

    // Parse metadata
    let metadata = { caption: file.name, label: `fig:${Date.now()}`, width_pct: 100 };
    if (metadataRaw && typeof metadataRaw === "string") {
      try {
        const parsed = figureUploadSchema.safeParse(JSON.parse(metadataRaw));
        if (parsed.success) {
          metadata = { ...metadata, ...parsed.data };
        }
      } catch {
        // Use defaults
      }
    }

    // Determine format from content type
    const formatMap: Record<string, "png" | "pdf" | "svg"> = {
      "image/png": "png",
      "image/jpeg": "png", // store as png category
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
    };
    const format = formatMap[file.type] ?? "png";

    // Upload to R2 (placeholder URL for now)
    const fileUrl = `figures/${id}/${Date.now()}_${file.name}`;

    const { data: figure, error } = await supabase
      .from("figures")
      .insert({
        project_id: id,
        section_id: metadata.label ? undefined : null,
        figure_type: "upload",
        source_tool: "upload",
        source_code: null,
        file_url: fileUrl,
        caption: metadata.caption,
        label: metadata.label,
        width_pct: metadata.width_pct,
        dpi: 300,
        format,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert figure:", error);
      return internalError();
    }

    return NextResponse.json({ data: figure as Figure }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST figures:", err);
    return internalError();
  }
}
