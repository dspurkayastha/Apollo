import type { Project, SectionStatus } from "@/lib/types/database";
import { getPhase, MAX_PHASE } from "./constants";

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
  code?: "LICENCE_REQUIRED" | "INVALID_TRANSITION" | "SECTION_NOT_APPROVED";
}

/**
 * Check whether a project can advance from its current phase to the next.
 */
export function canAdvancePhase(
  project: Project,
  currentSectionStatus: SectionStatus | null
): TransitionCheck {
  const { current_phase, status } = project;

  // Cannot go beyond the final phase (but final phase itself CAN be approved)
  if (current_phase > MAX_PHASE) {
    return {
      allowed: false,
      reason: "Already beyond the final phase",
      code: "INVALID_TRANSITION",
    };
  }

  // Current section must be approved before advancing
  if (currentSectionStatus !== "approved") {
    return {
      allowed: false,
      reason: `Phase ${current_phase} section must be approved before advancing`,
      code: "SECTION_NOT_APPROVED",
    };
  }

  // Final phase — no next phase to check licence for, just allow completion
  if (current_phase === MAX_PHASE) {
    return { allowed: true };
  }

  // Check if next phase requires a licence
  const nextPhase = getPhase(current_phase + 1);
  const devBypass = process.env.NODE_ENV !== "production" && process.env.DEV_LICENCE_BYPASS === "true";
  if (
    nextPhase?.requiresLicence &&
    status !== "licensed" &&
    status !== "completed" &&
    !devBypass
  ) {
    return {
      allowed: false,
      reason: "Active licence required to advance beyond Phase 1",
      code: "LICENCE_REQUIRED",
    };
  }

  return { allowed: true };
}

/**
 * Check if a phase number is valid.
 */
export function isValidPhase(phase: number): boolean {
  return Number.isInteger(phase) && phase >= 0 && phase <= MAX_PHASE;
}
