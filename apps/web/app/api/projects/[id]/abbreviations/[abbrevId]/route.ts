import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { abbreviationUpdateSchema } from "@/lib/validation/abbreviation-schemas";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; abbrevId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, abbrevId } = await params;

    const body = await request.json();
    const parsed = abbreviationUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid abbreviation data", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

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

    // Verify abbreviation exists and belongs to project
    const { data: existing, error: existingError } = await supabase
      .from("abbreviations")
      .select("id")
      .eq("id", abbrevId)
      .eq("project_id", id)
      .single();

    if (existingError || !existing) {
      return notFound("Abbreviation not found");
    }

    const { data: abbreviation, error } = await supabase
      .from("abbreviations")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", abbrevId)
      .select("*")
      .single();

    if (error || !abbreviation) {
      console.error("Failed to update abbreviation:", error);
      return internalError("Failed to update abbreviation");
    }

    return NextResponse.json({ data: abbreviation });
  } catch (err) {
    console.error("Unexpected error in PUT /api/projects/[id]/abbreviations/[abbrevId]:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; abbrevId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, abbrevId } = await params;

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

    // Verify abbreviation exists and belongs to project
    const { data: existing, error: existingError } = await supabase
      .from("abbreviations")
      .select("id")
      .eq("id", abbrevId)
      .eq("project_id", id)
      .single();

    if (existingError || !existing) {
      return notFound("Abbreviation not found");
    }

    const { error } = await supabase
      .from("abbreviations")
      .delete()
      .eq("id", abbrevId);

    if (error) {
      console.error("Failed to delete abbreviation:", error);
      return internalError("Failed to delete abbreviation");
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/projects/[id]/abbreviations/[abbrevId]:", err);
    return internalError();
  }
}
