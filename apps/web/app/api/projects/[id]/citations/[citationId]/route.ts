import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { citationUpdateSchema } from "@/lib/validation/citation-schemas";
import type { Citation } from "@/lib/types/database";

type RouteParams = { params: Promise<{ id: string; citationId: string }> };

// ── PUT /api/projects/:id/citations/:citationId — Update a citation ─────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, citationId } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Verify citation belongs to project
    const { data: existing } = await supabase
      .from("citations")
      .select("id, provenance_tier")
      .eq("id", citationId)
      .eq("project_id", id)
      .single();

    if (!existing) return notFound("Citation not found");

    const body = await request.json();
    const parsed = citationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid update data", {
        issues: parsed.error.issues,
      });
    }

    const { attested, ...rest } = parsed.data;
    const now = new Date().toISOString();

    const update: Record<string, unknown> = { ...rest };

    // Handle attestation: student confirms citation → promote to Tier B or C
    if (attested) {
      update.attested_by_user_id = authResult.user.id;
      update.attested_at = now;

      // Promote Tier D → C (student-confirmed without external evidence)
      // Promote to B if evidence_type is isbn or url
      if (!update.provenance_tier) {
        const evidenceType = rest.evidence_type ?? null;
        if (evidenceType === "isbn" || evidenceType === "url") {
          update.provenance_tier = "B";
        } else if (
          (existing.provenance_tier as string) === "D" ||
          evidenceType === "manual"
        ) {
          update.provenance_tier = "C";
        }
      }
    }

    const { data: citation, error } = await supabase
      .from("citations")
      .update(update)
      .eq("id", citationId)
      .eq("project_id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update citation:", error);
      return internalError();
    }

    return NextResponse.json({ data: citation as Citation });
  } catch (err) {
    console.error("Unexpected error in PUT citation:", err);
    return internalError();
  }
}

// ── DELETE /api/projects/:id/citations/:citationId ──────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id, citationId } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const { error } = await supabase
      .from("citations")
      .delete()
      .eq("id", citationId)
      .eq("project_id", id);

    if (error) {
      console.error("Failed to delete citation:", error);
      return internalError();
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("Unexpected error in DELETE citation:", err);
    return internalError();
  }
}
