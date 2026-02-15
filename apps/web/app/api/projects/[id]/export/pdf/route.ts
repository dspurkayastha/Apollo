import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, internalError } from "@/lib/api/errors";
import { checkLicenceGate } from "@/lib/api/licence-gate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const gateResult = await checkLicenceGate(id, authResult.user.id);
    if (gateResult instanceof NextResponse) return gateResult;

    const supabase = createAdminSupabaseClient();

    // Get latest successful compilation
    const { data: compilation } = await supabase
      .from("compilations")
      .select("pdf_url")
      .eq("project_id", id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!compilation?.pdf_url) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No compiled PDF available. Compile the thesis first." } },
        { status: 404 }
      );
    }

    // Stream the PDF from storage
    // In production this would fetch from R2; for now redirect to preview endpoint
    return NextResponse.redirect(
      new URL(`/api/projects/${id}/preview.pdf`, _request.url)
    );
  } catch (err) {
    console.error("PDF export error:", err);
    return internalError();
  }
}
