import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
  badRequest,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sectionUpdateSchema } from "@/lib/validation/section-schemas";
import { isValidPhase } from "@/lib/phases/transitions";
import { getPhase } from "@/lib/phases/constants";
import { tiptapToLatex } from "@/lib/latex/tiptap-to-latex";
import { extractCiteKeys } from "@/lib/citations/extract-keys";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, phase } = await params;
    const phaseNumber = parseInt(phase, 10);

    if (!isValidPhase(phaseNumber)) {
      return badRequest("Invalid phase number");
    }

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

    const { data: section, error } = await supabase
      .from("sections")
      .select("*")
      .eq("project_id", id)
      .eq("phase_number", phaseNumber)
      .single();

    if (error || !section) {
      return notFound("Section not found");
    }

    return NextResponse.json({ data: section });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]/sections/[phase]:", err);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, phase } = await params;
    const phaseNumber = parseInt(phase, 10);

    if (!isValidPhase(phaseNumber)) {
      return badRequest("Invalid phase number");
    }

    const body = await request.json();
    const parsed = sectionUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid section data", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

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

    const phaseDef = getPhase(phaseNumber);

    // Fetch existing section to preserve status and other fields on save
    const { data: existingSection } = await supabase
      .from("sections")
      .select("status, citation_keys")
      .eq("project_id", id)
      .eq("phase_number", phaseNumber)
      .single();

    // Build update payload based on save mode
    let updateData: Record<string, unknown> = {};
    let hasContent = false;

    if (parsed.data.rich_content_json) {
      // Rich text save: convert Tiptap JSON → LaTeX
      const result = tiptapToLatex(
        parsed.data.rich_content_json as unknown as Parameters<typeof tiptapToLatex>[0]
      );
      updateData = {
        rich_content_json: parsed.data.rich_content_json,
        latex_content: result.latex,
        word_count: countWords(result.latex),
        citation_keys: result.citationKeys,
      };
      hasContent = result.latex.trim().length > 0;
    } else if (parsed.data.latex_content !== undefined) {
      // Source view save: raw LaTeX — invalidate rich_content_json
      updateData = {
        latex_content: parsed.data.latex_content,
        rich_content_json: null,
        word_count: countWords(parsed.data.latex_content),
        citation_keys: extractCiteKeys(parsed.data.latex_content),
      };
      hasContent = parsed.data.latex_content.trim().length > 0;
    }

    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }

    // Determine status: preserve existing, but promote "draft" → "review"
    // when saving meaningful content (so the Approve button appears)
    let resolvedStatus = existingSection?.status ?? "draft";
    if (
      updateData.status === undefined &&
      resolvedStatus === "draft" &&
      hasContent
    ) {
      resolvedStatus = "review";
    }

    const { data: section, error } = await supabase
      .from("sections")
      .upsert(
        {
          project_id: id,
          phase_number: phaseNumber,
          phase_name: phaseDef?.name ?? `phase_${phaseNumber}`,
          latex_content: "",
          rich_content_json: null,
          word_count: 0,
          citation_keys: existingSection?.citation_keys ?? [],
          status: resolvedStatus,
          ...updateData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,phase_number" }
      )
      .select("*")
      .single();

    if (error || !section) {
      console.error("Failed to update section:", error);
      return internalError("Failed to update section");
    }

    return NextResponse.json({ data: section });
  } catch (err) {
    console.error("Unexpected error in PUT /api/projects/[id]/sections/[phase]:", err);
    return internalError();
  }
}

function countWords(latex: string): number {
  // Strip LaTeX commands and count remaining words
  const stripped = latex
    .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, " ")
    .replace(/[{}\\%$&_^~#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped ? stripped.split(" ").length : 0;
}
