import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  conflict,
  internalError,
} from "@/lib/api/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ lid: string; pid: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { lid, pid } = await params;
    const { user } = authResult;
    const supabase = await createServerSupabaseClient();

    // Verify licence belongs to user and is available
    const { data: licence, error: licenceError } = await supabase
      .from("thesis_licenses")
      .select("*")
      .eq("id", lid)
      .eq("user_id", user.id)
      .single();

    if (licenceError || !licence) {
      return notFound("Licence not found");
    }

    if (licence.status !== "available") {
      return conflict(
        "Licence is not available. Current status: " + licence.status
      );
    }

    // Verify project belongs to user and is in sandbox status
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", pid)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    if (project.status !== "sandbox") {
      return conflict(
        "Project is not in sandbox status. Current status: " + project.status
      );
    }

    // Update licence: attach to project, set active
    const { error: updateLicenceError } = await supabase
      .from("thesis_licenses")
      .update({
        project_id: pid,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", lid);

    if (updateLicenceError) {
      console.error("Failed to update licence:", updateLicenceError);
      return internalError("Failed to attach licence");
    }

    // Update project: set license_id, status to licensed
    const { data: updatedProject, error: updateProjectError } = await supabase
      .from("projects")
      .update({
        license_id: lid,
        status: "licensed",
      })
      .eq("id", pid)
      .select("*")
      .single();

    if (updateProjectError) {
      console.error("Failed to update project:", updateProjectError);
      return internalError("Failed to update project with licence");
    }

    return NextResponse.json({ data: updatedProject });
  } catch (err) {
    console.error(
      "Unexpected error in POST /api/licenses/[lid]/attach/[pid]:",
      err
    );
    return internalError();
  }
}
