import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
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

    // In production, this would generate a signed R2 URL and redirect.
    // For local dev, read the PDF file from disk and stream it.
    try {
      const pdfBytes = await readFile(compilation.pdf_url);
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch {
      return notFound("PDF file not found on disk — recompile to regenerate");
    }
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]/preview.pdf:", err);
    return internalError();
  }
}
