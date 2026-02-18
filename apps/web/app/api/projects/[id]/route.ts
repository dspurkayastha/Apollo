import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { projectUpdateSchema } from "@/lib/validation/schemas";
import { deleteR2Prefix } from "@/lib/r2/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !project) {
      return notFound("Project not found");
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]:", err);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const body = await request.json();
    const parsed = projectUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid update data", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const supabase = await createServerSupabaseClient();

    const { data: project, error } = await supabase
      .from("projects")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !project) {
      return notFound("Project not found");
    }

    // Record AI consent timestamp on first synopsis upload (9.3)
    if (
      parsed.data.synopsis_text &&
      !authResult.user.ai_consent_accepted_at
    ) {
      const adminDb = createAdminSupabaseClient();
      await adminDb
        .from("users")
        .update({ ai_consent_accepted_at: new Date().toISOString() })
        .eq("id", authResult.user.id)
        .is("ai_consent_accepted_at", null);
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error("Unexpected error in PATCH /api/projects/[id]:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify project exists and belongs to user (RLS handles ownership)
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !project) {
      return notFound("Project not found");
    }

    // Clean R2 objects for this project (9.9)
    try {
      await deleteR2Prefix(`projects/${id}/`);
    } catch (r2Err) {
      console.error(`R2 cleanup failed for project ${id}:`, r2Err);
      // Continue with DB deletion even if R2 cleanup fails
    }

    // Hard-delete project (CASCADE handles child tables + audit_log)
    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete project:", deleteError);
      return internalError("Failed to delete project");
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/projects/[id]:", err);
    return internalError();
  }
}
