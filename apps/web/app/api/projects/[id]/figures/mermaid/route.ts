import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { mermaidGenerateSchema } from "@/lib/validation/figure-schemas";
import type { Figure } from "@/lib/types/database";

// ── POST /api/projects/:id/figures/mermaid — Save Mermaid diagram ───────────

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

    const body = await request.json();
    const parsed = mermaidGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid Mermaid diagram data", {
        issues: parsed.error.issues,
      });
    }

    const { source_code, caption, label, figure_type } = parsed.data;

    // Store the Mermaid source code — rendering happens client-side
    const { data: figure, error } = await supabase
      .from("figures")
      .insert({
        project_id: id,
        figure_type: figure_type,
        source_tool: "mermaid",
        source_code: source_code,
        file_url: null, // Mermaid renders client-side; no file storage needed
        caption,
        label,
        width_pct: 100,
        dpi: 300,
        format: "svg",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert Mermaid figure:", error);
      return internalError();
    }

    return NextResponse.json({ data: figure as Figure }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST figures/mermaid:", err);
    return internalError();
  }
}
