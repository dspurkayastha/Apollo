import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { complianceRunSchema } from "@/lib/validation/compliance-schemas";
import { runComplianceCheck } from "@/lib/compliance/checker";
import { checkNBEMS } from "@/lib/compliance/nbems";
import { generatePRISMAFlowMermaid } from "@/lib/compliance/prisma-flow";
import type { ComplianceCheck, Section } from "@/lib/types/database";

// ── GET /api/projects/:id/compliance — Get compliance dashboard ─────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Fetch all compliance checks for this project
    const { data: checks, error } = await supabase
      .from("compliance_checks")
      .select("*")
      .eq("project_id", id)
      .order("last_checked_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch compliance checks:", error);
      return internalError();
    }

    // Also compute NBEMS check (always fresh, based on current sections)
    const { data: sectionsData } = await supabase
      .from("sections")
      .select("*")
      .eq("project_id", id);

    const nbems = checkNBEMS((sectionsData ?? []) as Section[]);

    return NextResponse.json({
      data: {
        checks: checks as ComplianceCheck[],
        nbems,
      },
    });
  } catch (err) {
    console.error("Unexpected error in GET compliance:", err);
    return internalError();
  }
}

// ── POST /api/projects/:id/compliance — Run compliance check ────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    const body = await request.json();
    const parsed = complianceRunSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid compliance check parameters", {
        issues: parsed.error.issues,
      });
    }

    // Fetch all sections
    const { data: sectionsData } = await supabase
      .from("sections")
      .select("*")
      .eq("project_id", id);

    const sections = (sectionsData ?? []) as Section[];

    // Run the compliance check
    const result = await runComplianceCheck(
      id,
      parsed.data.guideline_type,
      sections
    );

    // Generate PRISMA flow diagram if applicable
    const prismaFlowMermaid =
      parsed.data.guideline_type === "PRISMA"
        ? generatePRISMAFlowMermaid(sections)
        : undefined;

    // Upsert compliance check result
    const now = new Date().toISOString();
    const payload = {
      project_id: id,
      guideline_type: parsed.data.guideline_type,
      checklist_json: result.items,
      overall_score: result.overall_score,
      last_checked_at: now,
    };

    let check: ComplianceCheck | null = null;

    const { data: upsertData, error: upsertError } = await supabase
      .from("compliance_checks")
      .upsert(payload, { onConflict: "project_id,guideline_type" })
      .select("*")
      .single();

    if (upsertError) {
      // Fallback: select→update/insert when upsert fails (e.g. missing unique constraint)
      console.error("Upsert failed, falling back to select→update/insert:", {
        code: upsertError.code,
        message: upsertError.message,
        hint: upsertError.hint,
      });

      const { data: existing } = await supabase
        .from("compliance_checks")
        .select("id")
        .eq("project_id", id)
        .eq("guideline_type", parsed.data.guideline_type)
        .maybeSingle();

      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from("compliance_checks")
          .update({
            checklist_json: result.items,
            overall_score: result.overall_score,
            last_checked_at: now,
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (updateError) {
          console.error("Fallback update failed:", {
            code: updateError.code,
            message: updateError.message,
            hint: updateError.hint,
          });
          return internalError();
        }
        check = updated as ComplianceCheck;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("compliance_checks")
          .insert(payload)
          .select("*")
          .single();

        if (insertError) {
          console.error("Fallback insert failed:", {
            code: insertError.code,
            message: insertError.message,
            hint: insertError.hint,
          });
          return internalError();
        }
        check = inserted as ComplianceCheck;
      }
    } else {
      check = upsertData as ComplianceCheck;
    }

    return NextResponse.json({
      data: {
        ...(check as ComplianceCheck),
        prisma_flow_mermaid: prismaFlowMermaid,
      },
    });
  } catch (err) {
    console.error("Unexpected error in POST compliance:", err);
    return internalError();
  }
}
