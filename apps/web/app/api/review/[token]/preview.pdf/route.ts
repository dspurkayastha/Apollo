import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import os from "os";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateDownloadUrl } from "@/lib/r2/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createAdminSupabaseClient();

    // Validate review token
    const { data: reviewToken } = await supabase
      .from("review_tokens")
      .select("id, project_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!reviewToken) {
      return new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "Invalid or expired review link" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (new Date(reviewToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: { code: "EXPIRED", message: "This review link has expired" } }),
        { status: 410, headers: { "Content-Type": "application/json" } }
      );
    }

    const projectId = reviewToken.project_id;

    // Get latest successful compilation
    const { data: compilation, error } = await supabase
      .from("compilations")
      .select("pdf_url")
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !compilation?.pdf_url) {
      return new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "No compiled PDF available" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // If pdf_url is an R2 key, redirect to signed URL
    if (compilation.pdf_url.startsWith("projects/")) {
      try {
        const signedUrl = await generateDownloadUrl(compilation.pdf_url);
        return Response.redirect(signedUrl, 302);
      } catch {
        return new Response(
          JSON.stringify({ error: { code: "NOT_FOUND", message: "PDF file not found in storage" } }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: local disk path (dev/test)
    let pdfBytes: Uint8Array | null = null;
    for (const candidate of [
      compilation.pdf_url,
      path.join(os.tmpdir(), "apollo-pdfs", `${projectId}.pdf`),
    ]) {
      try {
        pdfBytes = await readFile(candidate);
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!pdfBytes) {
      return new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "PDF file not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("Review PDF access error:", err);
    return new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
