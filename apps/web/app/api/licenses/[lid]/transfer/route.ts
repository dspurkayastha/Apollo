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
  { params }: { params: Promise<{ lid: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { lid } = await params;
    const { user } = authResult;
    const supabase = await createServerSupabaseClient();

    // Verify licence belongs to user and is active
    const { data: licence, error: licenceError } = await supabase
      .from("thesis_licenses")
      .select("*")
      .eq("id", lid)
      .eq("user_id", user.id)
      .single();

    if (licenceError || !licence) {
      return notFound("Licence not found");
    }

    if (licence.status !== "active") {
      return conflict(
        "Only active licences can be transferred. Current status: " +
          licence.status
      );
    }

    const projectId = licence.project_id;

    // Set licence status to transferred (DB trigger handles 6-month cooldown)
    const { data: updatedLicence, error: updateLicenceError } = await supabase
      .from("thesis_licenses")
      .update({
        status: "transferred",
      })
      .eq("id", lid)
      .select("*")
      .single();

    if (updateLicenceError) {
      console.error("Failed to transfer licence:", updateLicenceError);
      return internalError("Failed to transfer licence");
    }

    // Set project back to sandbox, remove license_id
    if (projectId) {
      const { error: updateProjectError } = await supabase
        .from("projects")
        .update({
          status: "sandbox",
          license_id: null,
        })
        .eq("id", projectId);

      if (updateProjectError) {
        console.error("Failed to update project:", updateProjectError);
        return internalError("Failed to update project after licence transfer");
      }
    }

    return NextResponse.json({ data: updatedLicence });
  } catch (err) {
    console.error(
      "Unexpected error in POST /api/licenses/[lid]/transfer:",
      err
    );
    return internalError();
  }
}
