import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import os from "os";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
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

    // Get latest successful compilation
    const { data: compilation, error } = await supabase
      .from("compilations")
      .select("pdf_url")
      .eq("project_id", id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !compilation?.pdf_url) {
      return notFound("No compiled PDF available — trigger a compilation first");
    }

    const download = request.nextUrl.searchParams.get("download") === "1";
    const disposition = download
      ? `attachment; filename="thesis.pdf"`
      : "inline";

    // In production, this would generate a signed R2 URL and redirect.
    // For local dev, read the PDF file from disk and stream it.
    // Try the stored path first, then deterministic fallback path.
    let pdfBytes: Uint8Array | null = null;
    for (const candidate of [
      compilation.pdf_url,
      path.join(os.tmpdir(), "apollo-pdfs", `${id}.pdf`),
    ]) {
      try {
        pdfBytes = await readFile(candidate);
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!pdfBytes) {
      return notFound("PDF file not found on disk — recompile to regenerate");
    }

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]/preview.pdf:", err);
    return internalError();
  }
}
