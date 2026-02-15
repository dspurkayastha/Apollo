import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditCitations } from "@/lib/citations/audit";
import type { Section, Citation } from "@/lib/types/database";

// ── POST /api/projects/:id/citations/audit — Run integrity audit ────────────

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
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Fetch all sections and citations
    const [sectionsResult, citationsResult] = await Promise.all([
      supabase
        .from("sections")
        .select("*")
        .eq("project_id", id)
        .order("phase_number", { ascending: true }),
      supabase
        .from("citations")
        .select("*")
        .eq("project_id", id),
    ]);

    if (sectionsResult.error || citationsResult.error) {
      console.error(
        "Failed to fetch data for audit:",
        sectionsResult.error,
        citationsResult.error
      );
      return internalError();
    }

    const sections = (sectionsResult.data ?? []) as Section[];
    const citations = (citationsResult.data ?? []) as Citation[];

    const result = auditCitations(sections, citations);

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Unexpected error in POST citations/audit:", err);
    return internalError();
  }
}
