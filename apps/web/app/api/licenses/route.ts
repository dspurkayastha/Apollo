import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const supabase = await createServerSupabaseClient();

    const { data: licences, error } = await supabase
      .from("thesis_licenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch licences:", error);
      return internalError("Failed to fetch licences");
    }

    return NextResponse.json({ data: licences });
  } catch (err) {
    console.error("Unexpected error in GET /api/licenses:", err);
    return internalError();
  }
}
