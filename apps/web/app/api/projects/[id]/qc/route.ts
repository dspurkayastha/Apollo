import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { finalQC } from "@/lib/qc/final-qc";
import type { Section, Citation } from "@/lib/types/database";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    // Fetch all sections and citations
    const [{ data: sections }, { data: citations }, { data: compilation }] =
      await Promise.all([
        supabase
          .from("sections")
          .select("*")
          .eq("project_id", id)
          .order("phase_number", { ascending: true }),
        supabase.from("citations").select("*").eq("project_id", id),
        supabase
          .from("compilations")
          .select("compile_log")
          .eq("project_id", id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const compileLog = (compilation?.compile_log as string) ?? null;
    const report = finalQC(
      (sections ?? []) as Section[],
      (citations ?? []) as Citation[],
      compileLog
    );

    // Store QC results in Phase 11 section
    const reportJson = JSON.stringify(report);
    await supabase.from("sections").upsert(
      {
        project_id: id,
        phase_number: 11,
        phase_name: "final_qc",
        latex_content: reportJson,
        word_count: 0,
        citation_keys: [],
        status: "review",
      },
      { onConflict: "project_id,phase_number" }
    );

    return NextResponse.json({ data: report });
  } catch (err) {
    console.error("Error in POST /api/projects/[id]/qc:", err);
    return internalError();
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (projectError || !project) {
      return notFound("Project not found");
    }

    // Get Phase 11 section with stored QC report
    const { data: section } = await supabase
      .from("sections")
      .select("latex_content")
      .eq("project_id", id)
      .eq("phase_number", 11)
      .maybeSingle();

    if (!section?.latex_content) {
      return NextResponse.json({ data: null });
    }

    try {
      const report = JSON.parse(section.latex_content as string);
      return NextResponse.json({ data: report });
    } catch {
      return NextResponse.json({ data: null });
    }
  } catch (err) {
    console.error("Error in GET /api/projects/[id]/qc:", err);
    return internalError();
  }
}
