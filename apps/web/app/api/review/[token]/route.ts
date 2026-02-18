import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createAdminSupabaseClient();

    // Validate token and check expiry
    const { data: reviewToken } = await supabase
      .from("review_tokens")
      .select("id, project_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!reviewToken) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid or expired review link" } },
        { status: 404 }
      );
    }

    if (new Date(reviewToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: "EXPIRED", message: "This review link has expired" } },
        { status: 410 }
      );
    }

    // Fetch project metadata (limited — no sensitive data)
    const { data: project } = await supabase
      .from("projects")
      .select("id, title, study_type, university_type, current_phase")
      .eq("id", reviewToken.project_id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 }
      );
    }

    // Fetch sections list (phase numbers + names only)
    const { data: sections } = await supabase
      .from("sections")
      .select("phase_number, phase_name, status, word_count")
      .eq("project_id", reviewToken.project_id)
      .in("status", ["approved", "review"])
      .order("phase_number");

    // Build PDF URL — token-scoped so unauthenticated reviewers can access
    const pdfUrl = `/api/review/${token}/preview.pdf`;

    return NextResponse.json({
      data: {
        project: {
          id: project.id,
          title: project.title,
          study_type: project.study_type,
          university_type: project.university_type,
          current_phase: project.current_phase,
        },
        sections: sections ?? [],
        pdf_url: pdfUrl,
        token_id: reviewToken.id,
      },
    });
  } catch (err) {
    console.error("Review token validation error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
