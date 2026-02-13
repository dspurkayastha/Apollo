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

  // Cannot go beyond the final phase
  if (current_phase >= MAX_PHASE) {
    return {
      allowed: false,
      reason: "Already at the final phase",
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

  // Check if next phase requires a licence
  const nextPhase = getPhase(current_phase + 1);
  if (nextPhase?.requiresLicence && status !== "licensed" && status !== "completed") {
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
