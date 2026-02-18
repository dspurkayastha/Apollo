import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * POST /api/account/delete — Request account deletion (7-day cooling-off).
 */
export async function POST() {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const supabase = createAdminSupabaseClient();

    // Idempotent: only set if not already requested (prevents resetting the 7-day clock)
    if (authResult.user.deletion_requested_at) {
      return NextResponse.json({
        data: {
          message:
            "Account deletion already requested. Your data will be permanently deleted after 7 days. Contact support@sciscribesolutions.com to cancel.",
        },
      });
    }

    const { error } = await supabase
      .from("users")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("id", authResult.user.id)
      .is("deletion_requested_at", null);

    if (error) {
      console.error("Failed to request account deletion:", error);
      return internalError("Failed to request account deletion");
    }

    return NextResponse.json({
      data: {
        message:
          "Account deletion requested. Your data will be permanently deleted after 7 days. Contact support@sciscribesolutions.com to cancel.",
      },
    });
  } catch (err) {
    console.error("Unexpected error in POST /api/account/delete:", err);
    return internalError();
  }
}

/**
 * DELETE /api/account/delete — Cancel a pending account deletion request.
 */
export async function DELETE() {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
      .from("users")
      .update({ deletion_requested_at: null })
      .eq("id", authResult.user.id)
      .not("deletion_requested_at", "is", null);

    if (error) {
      console.error("Failed to cancel account deletion:", error);
      return internalError("Failed to cancel deletion request");
    }

    return NextResponse.json({
      data: { message: "Account deletion cancelled." },
    });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/account/delete:", err);
    return internalError();
  }
}
