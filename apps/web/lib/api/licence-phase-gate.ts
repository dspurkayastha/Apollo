import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPlanConfig, isSandboxPhase, type PlanConfig } from "@/lib/pricing/config";
import { checkLicenceExpiry } from "./licence-expiry";
import type { Project, ThesisLicence } from "@/lib/types/database";

export type GateOperation = "generate" | "refine" | "compile";

export interface LicenceGateResult {
  allowed: true;
  project: Project;
  licence: ThesisLicence | null;
  planConfig: PlanConfig | null;
  expiryWarning: boolean;
  daysRemaining: number;
}

/**
 * Central licence enforcement for generate/refine/compile operations.
 * Returns the project and licence data if allowed, or a 402 NextResponse if not.
 */
export async function checkLicenceForPhase(
  projectId: string,
  userId: string,
  phaseNumber: number,
  operation: GateOperation
): Promise<LicenceGateResult | NextResponse> {
  // Dev bypass
  const devBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_LICENCE_BYPASS === "true";

  const supabase = createAdminSupabaseClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      { status: 404 }
    );
  }

  const typedProject = project as Project;

  // Sandbox projects: only allow sandbox phases
  if (typedProject.status === "sandbox") {
    if (!isSandboxPhase(phaseNumber)) {
      if (devBypass) {
        return {
          allowed: true,
          project: typedProject,
          licence: null,
          planConfig: null,
          expiryWarning: false,
          daysRemaining: Infinity,
        };
      }

      return NextResponse.json(
        {
          error: {
            code: "PAYMENT_REQUIRED",
            message:
              "A thesis licence is required for phases beyond Phase 2. Purchase a licence to continue.",
            action: "purchase_licence",
          },
        },
        { status: 402 }
      );
    }

    // Sandbox phase — allowed
    return {
      allowed: true,
      project: typedProject,
      licence: null,
      planConfig: null,
      expiryWarning: false,
      daysRemaining: Infinity,
    };
  }

  // Licensed or completed projects — fetch licence
  if (!typedProject.license_id) {
    if (devBypass) {
      return {
        allowed: true,
        project: typedProject,
        licence: null,
        planConfig: null,
        expiryWarning: false,
        daysRemaining: Infinity,
      };
    }

    return NextResponse.json(
      {
        error: {
          code: "PAYMENT_REQUIRED",
          message: "No licence attached to this project.",
          action: "purchase_licence",
        },
      },
      { status: 402 }
    );
  }

  const { data: licence } = await supabase
    .from("thesis_licenses")
    .select("*")
    .eq("id", typedProject.license_id)
    .single();

  if (!licence) {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENT_REQUIRED",
          message: "Licence not found.",
          action: "purchase_licence",
        },
      },
      { status: 402 }
    );
  }

  const typedLicence = licence as ThesisLicence;

  // Check expiry
  const expiry = await checkLicenceExpiry(typedLicence.id);
  if (expiry?.expired && !devBypass) {
    return NextResponse.json(
      {
        error: {
          code: "LICENCE_EXPIRED",
          message:
            "Your licence has expired. Please renew to continue working on your thesis.",
          action: "renew_licence",
        },
      },
      { status: 402 }
    );
  }

  let planConfig: PlanConfig;
  try {
    planConfig = getPlanConfig(typedLicence.plan_type);
  } catch {
    // Unknown plan type — allow as a safety net
    return {
      allowed: true,
      project: typedProject,
      licence: typedLicence,
      planConfig: null,
      expiryWarning: expiry?.warning ?? false,
      daysRemaining: expiry?.daysRemaining ?? Infinity,
    };
  }

  // Addon restriction: no generation allowed
  if (operation === "generate" && !planConfig.allowsGenerate && !devBypass) {
    return NextResponse.json(
      {
        error: {
          code: "PLAN_RESTRICTION",
          message:
            "Your add-on plan allows refining and compiling only. Upgrade to a full plan for AI generation.",
          action: "upgrade_plan",
        },
      },
      { status: 402 }
    );
  }

  // Monthly phase limit
  if (
    planConfig.maxPhasesPerMonth !== null &&
    typedLicence.monthly_phases_advanced >= planConfig.maxPhasesPerMonth &&
    !devBypass
  ) {
    return NextResponse.json(
      {
        error: {
          code: "MONTHLY_PHASE_LIMIT",
          message: `You have reached the maximum of ${planConfig.maxPhasesPerMonth} phases for this billing period. Your limit resets at the start of your next billing cycle.`,
          action: "wait_or_upgrade",
        },
      },
      { status: 402 }
    );
  }

  return {
    allowed: true,
    project: typedProject,
    licence: typedLicence,
    planConfig,
    expiryWarning: expiry?.warning ?? false,
    daysRemaining: expiry?.daysRemaining ?? Infinity,
  };
}
