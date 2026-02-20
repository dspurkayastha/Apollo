/**
 * Pricing configuration — single source of truth for all plan metadata.
 */

export type BillingType = "one_time" | "monthly";

export interface PlanConfig {
  id: string;
  name: string;
  billingType: BillingType;
  prices: { INR: number; USD: number }; // paise / cents
  validityDays: number;
  features: string[];
  allowsGenerate: boolean;
  maxPhasesPerMonth: number | null;
  modelTier: "sonnet" | "opus";
  sandboxPhases: number[];
  visible: boolean;
  comingSoon: boolean;
  label: string;
}

const SANDBOX_PHASES = [0, 1, 2];

export const PLANS: Record<string, PlanConfig> = {
  sandbox: {
    id: "sandbox",
    name: "Free Sandbox",
    billingType: "one_time",
    prices: { INR: 0, USD: 0 },
    validityDays: 0,
    features: [
      "Phases 0--2 (Orientation, Front Matter, Introduction)",
      "Watermarked PDF preview",
      "1 sandbox project",
    ],
    allowsGenerate: true,
    maxPhasesPerMonth: null,
    modelTier: "sonnet",
    sandboxPhases: SANDBOX_PHASES,
    visible: false,
    comingSoon: false,
    label: "Free Sandbox",
  },

  student_onetime: {
    id: "student_onetime",
    name: "Student One-Time",
    billingType: "one_time",
    prices: { INR: 1499900, USD: 17900 },
    validityDays: 90,
    features: [
      "Full 12-phase GOLD Standard workflow",
      "AI generation for all sections",
      "LaTeX compilation",
      "Citation verification",
      "Statistical analysis",
      "PDF + DOCX export",
      "90-day access",
    ],
    allowsGenerate: true,
    maxPhasesPerMonth: null,
    modelTier: "sonnet",
    sandboxPhases: SANDBOX_PHASES,
    visible: true,
    comingSoon: false,
    label: "Student One-Time",
  },

  student_monthly: {
    id: "student_monthly",
    name: "Student Monthly",
    billingType: "monthly",
    prices: { INR: 549900, USD: 6500 },
    validityDays: 30,
    features: [
      "Full 12-phase GOLD Standard workflow",
      "AI generation for all sections",
      "LaTeX compilation",
      "Citation verification",
      "Statistical analysis",
      "PDF + DOCX export",
      "Max 4 phases per billing period",
    ],
    allowsGenerate: true,
    maxPhasesPerMonth: 4,
    modelTier: "sonnet",
    sandboxPhases: SANDBOX_PHASES,
    visible: true,
    comingSoon: true,
    label: "Student Monthly",
  },

  professional_onetime: {
    id: "professional_onetime",
    name: "Professional One-Time",
    billingType: "one_time",
    prices: { INR: 3999900, USD: 44900 },
    validityDays: 180,
    features: [
      "Everything in Student",
      "PhD thesis support",
      "Opus model tier",
      "Priority compilation queue",
      "Supervisor dashboard",
      "Source LaTeX export",
      "180-day access",
    ],
    allowsGenerate: true,
    maxPhasesPerMonth: null,
    modelTier: "opus",
    sandboxPhases: SANDBOX_PHASES,
    visible: true,
    comingSoon: false,
    label: "Professional One-Time",
  },

  professional_monthly: {
    id: "professional_monthly",
    name: "Professional Monthly",
    billingType: "monthly",
    prices: { INR: 0, USD: 0 },
    validityDays: 30,
    features: [],
    allowsGenerate: true,
    maxPhasesPerMonth: null,
    modelTier: "opus",
    sandboxPhases: SANDBOX_PHASES,
    visible: true,
    comingSoon: true,
    label: "Professional Monthly",
  },

  addon: {
    id: "addon",
    name: "Add-on Thesis",
    billingType: "monthly",
    prices: { INR: 399900, USD: 4900 },
    validityDays: 30,
    features: [
      "Refine existing content",
      "Compile thesis",
      "No new AI generation",
      "30-day access",
    ],
    allowsGenerate: false,
    maxPhasesPerMonth: null,
    modelTier: "sonnet",
    sandboxPhases: SANDBOX_PHASES,
    visible: true,
    comingSoon: true,
    label: "Add-on Thesis",
  },
};

/** Map legacy plan IDs to new ones */
const LEGACY_MAP: Record<string, string> = {
  one_time: "student_onetime",
};

export function getPlanConfig(planType: string): PlanConfig {
  const mapped = LEGACY_MAP[planType] ?? planType;
  const config = PLANS[mapped];
  if (!config) {
    throw new Error(`Unknown plan type: ${planType}`);
  }
  return config;
}

export function getPlanPrice(
  planType: string,
  currency: "INR" | "USD"
): number {
  return getPlanConfig(planType).prices[currency];
}

export function getVisiblePlans(): PlanConfig[] {
  return Object.values(PLANS).filter((p) => p.visible);
}

export function isSandboxPhase(phase: number): boolean {
  return SANDBOX_PHASES.includes(phase);
}
