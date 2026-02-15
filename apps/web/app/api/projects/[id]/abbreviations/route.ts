import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { abbreviationCreateSchema } from "@/lib/validation/abbreviation-schemas";

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

    const { data: abbreviations, error } = await supabase
      .from("abbreviations")
      .select("*")
      .eq("project_id", id)
      .order("short_form", { ascending: true });

    if (error) {
      console.error("Failed to fetch abbreviations:", error);
      return internalError("Failed to fetch abbreviations");
    }

    return NextResponse.json({ data: abbreviations });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]/abbreviations:", err);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;

    const body = await request.json();
    const parsed = abbreviationCreateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid abbreviation data", {
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

    const { data: abbreviation, error } = await supabase
      .from("abbreviations")
      .insert({
        project_id: id,
        short_form: parsed.data.short_form,
        long_form: parsed.data.long_form,
      })
      .select("*")
      .single();

    if (error || !abbreviation) {
      console.error("Failed to create abbreviation:", error);
      return internalError("Failed to create abbreviation");
    }

    return NextResponse.json({ data: abbreviation }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST /api/projects/[id]/abbreviations:", err);
    return internalError();
  }
}
