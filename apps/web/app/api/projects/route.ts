import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const supabase = await createServerSupabaseClient();

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", authResult.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch projects:", error);
      return internalError("Failed to fetch projects");
    }

    return NextResponse.json({ data: projects });
  } catch (err) {
    console.error("Unexpected error in GET /api/projects:", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("Invalid project data", {
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const { user } = authResult;
    const supabase = await createServerSupabaseClient();

    // Sandbox project limit: max 1 sandbox project per user
    const { count: sandboxCount } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "sandbox");

    if ((sandboxCount ?? 0) >= 1) {
      return NextResponse.json(
        {
          error: {
            code: "SANDBOX_LIMIT",
            message:
              "You already have a sandbox project. Purchase a licence to unlock it, or delete it to start a new one.",
            action: "purchase_licence",
          },
        },
        { status: 402 }
      );
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        university_type: parsed.data.university_type,
        status: "sandbox",
        current_phase: 0,
        metadata_json: {},
        phases_completed: [],
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to create project:", error);
      return internalError("Failed to create project");
    }

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in POST /api/projects:", err);
    return internalError();
  }
}
