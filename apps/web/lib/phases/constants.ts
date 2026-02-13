/**
 * GOLD Standard 12-phase thesis generation pipeline.
 */

export interface PhaseDefinition {
  number: number;
  name: string;
  label: string;
  requiresLicence: boolean;
}

export const PHASES: PhaseDefinition[] = [
  { number: 0, name: "orientation", label: "Orientation", requiresLicence: false },
  { number: 1, name: "front_matter", label: "Front Matter", requiresLicence: false },
  { number: 2, name: "introduction", label: "Introduction", requiresLicence: true },
  { number: 3, name: "aims", label: "Aims & Objectives", requiresLicence: true },
  { number: 4, name: "review_of_literature", label: "Review of Literature", requiresLicence: true },
  { number: 5, name: "materials_methods", label: "Materials & Methods", requiresLicence: true },
  { number: 6, name: "results", label: "Results", requiresLicence: true },
  { number: 7, name: "discussion", label: "Discussion", requiresLicence: true },
  { number: 8, name: "conclusion", label: "Conclusion", requiresLicence: true },
  { number: 9, name: "references", label: "References", requiresLicence: true },
  { number: 10, name: "appendices", label: "Appendices", requiresLicence: true },
  { number: 11, name: "final_qc", label: "Final QC", requiresLicence: true },
];

export const PHASE_MAP = new Map(PHASES.map((p) => [p.number, p]));

export const MAX_PHASE = 11;

export function getPhase(phaseNumber: number): PhaseDefinition | undefined {
  return PHASE_MAP.get(phaseNumber);
}
