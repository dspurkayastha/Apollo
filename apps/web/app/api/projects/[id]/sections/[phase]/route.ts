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

    // Upsert the section
    const updateData = {
      ...parsed.data,
      ...(parsed.data.latex_content !== undefined
        ? { word_count: countWords(parsed.data.latex_content) }
        : {}),
    };

    const { data: section, error } = await supabase
      .from("sections")
      .upsert(
        {
          project_id: id,
          phase_number: phaseNumber,
          phase_name: phaseDef?.name ?? `phase_${phaseNumber}`,
          latex_content: "",
          word_count: 0,
          citation_keys: [],
          status: "draft",
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
