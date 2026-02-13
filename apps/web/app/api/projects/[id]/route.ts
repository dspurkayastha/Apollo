import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectUpdateSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !project) {
      return notFound("Project not found");
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects/[id]:", err);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const body = await request.json();
    const parsed = projectUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid update data", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const supabase = await createServerSupabaseClient();

    const { data: project, error } = await supabase
      .from("projects")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !project) {
      return notFound("Project not found");
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error("Unexpected error in PATCH /api/projects/[id]:", err);
    return internalError();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: project, error } = await supabase
      .from("projects")
      .update({ status: "archived" })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !project) {
      return notFound("Project not found");
    }

    return NextResponse.json({ data: project });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/projects/[id]:", err);
    return internalError();
  }
}
