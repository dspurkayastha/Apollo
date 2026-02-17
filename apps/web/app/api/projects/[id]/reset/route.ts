import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Fetch project
    const { data: project } = await supabase
      .from("projects")
      .select("id, status, license_id, current_phase, user_id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Must be licensed
    if (project.status !== "licensed") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "Only licensed projects can be reset.",
          },
        },
        { status: 400 }
      );
    }

    // Must be before Phase 4
    if ((project.current_phase as number) >= 4) {
      return NextResponse.json(
        {
          error: {
            code: "PHASE_TOO_ADVANCED",
            message:
              "Projects can only be reset before Phase 4 (Review of Literature). Your project is too far along.",
          },
        },
        { status: 400 }
      );
    }

    // Check reset count on licence
    if (!project.license_id) {
      return NextResponse.json(
        {
          error: {
            code: "NO_LICENCE",
            message: "No licence attached to this project.",
          },
        },
        { status: 400 }
      );
    }

    const { data: licence } = await supabase
      .from("thesis_licenses")
      .select("id, reset_count")
      .eq("id", project.license_id)
      .single();

    if (!licence) {
      return NextResponse.json(
        {
          error: {
            code: "LICENCE_NOT_FOUND",
            message: "Licence not found.",
          },
        },
        { status: 400 }
      );
    }

    if ((licence.reset_count as number) >= 1) {
      return NextResponse.json(
        {
          error: {
            code: "RESET_EXHAUSTED",
            message: "You have already used your free reset for this licence.",
          },
        },
        { status: 400 }
      );
    }

    // Delete all project data
    const deletions = await Promise.allSettled([
      supabase.from("sections").delete().eq("project_id", id),
      supabase.from("citations").delete().eq("project_id", id),
      supabase.from("figures").delete().eq("project_id", id),
      supabase.from("analyses").delete().eq("project_id", id),
      supabase.from("compilations").delete().eq("project_id", id),
      supabase.from("ai_conversations").delete().eq("project_id", id),
      supabase.from("datasets").delete().eq("project_id", id),
      supabase.from("abbreviations").delete().eq("project_id", id),
      supabase.from("compliance_checks").delete().eq("project_id", id),
    ]);

    const failures = deletions.filter((d) => d.status === "rejected");
    if (failures.length > 0) {
      console.error("Some reset deletions failed:", failures);
    }

    // Reset project to phase 0
    await supabase
      .from("projects")
      .update({
        current_phase: 0,
        phases_completed: [],
        synopsis_text: null,
        study_type: null,
        metadata_json: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Increment reset count on licence
    await supabase
      .from("thesis_licenses")
      .update({ reset_count: (licence.reset_count as number) + 1 })
      .eq("id", licence.id);

    return NextResponse.json({
      data: { message: "Project reset to Phase 0 successfully." },
    });
  } catch (err) {
    console.error("Unexpected error in POST /api/projects/[id]/reset:", err);
    return internalError();
  }
}
