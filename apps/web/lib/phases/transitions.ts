import type { Project } from "@/lib/types/database";
import { getPhase, MAX_PHASE } from "./constants";

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
  code?: "LICENCE_REQUIRED" | "INVALID_TRANSITION";
}

/**
 * Check whether a project can advance from its current phase to the next.
 *
 * Section status validation is handled by the approve route itself (lines 76-93)
 * before calling this function, so we only check phase bounds + licence here.
 */
export function canAdvancePhase(
  project: Project,
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
      reason: "Active licence required to advance beyond Phase 2",
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
