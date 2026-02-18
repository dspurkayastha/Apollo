import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, validationError, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/account/preferences — Update user preferences (analytics consent).
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const body = await request.json();

    if (typeof body.analytics_consent !== "boolean") {
      return validationError("analytics_consent must be a boolean");
    }

    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
      .from("users")
      .update({ analytics_consent: body.analytics_consent })
      .eq("id", authResult.user.id);

    if (error) {
      console.error("Failed to update preferences:", error);
      return internalError("Failed to update preferences");
    }

    return NextResponse.json({ data: { analytics_consent: body.analytics_consent } });
  } catch (err) {
    console.error("Unexpected error in PATCH /api/account/preferences:", err);
    return internalError();
  }
}
