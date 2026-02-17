import { describe, it, expect } from "vitest";
import {
  PLANS,
  getPlanConfig,
  getPlanPrice,
  getVisiblePlans,
  isSandboxPhase,
} from "@/lib/pricing/config";

describe("Pricing Config", () => {
  describe("PLANS", () => {
    it("contains all expected plan IDs", () => {
      const ids = Object.keys(PLANS);
      expect(ids).toContain("sandbox");
      expect(ids).toContain("student_onetime");
      expect(ids).toContain("student_monthly");
      expect(ids).toContain("professional_onetime");
      expect(ids).toContain("professional_monthly");
      expect(ids).toContain("addon");
    });

    it("student_onetime has correct prices", () => {
      const plan = PLANS.student_onetime;
      expect(plan.prices.INR).toBe(1499900); // Rs 14,999
      expect(plan.prices.USD).toBe(17900); // $179
      expect(plan.validityDays).toBe(90);
    });

    it("student_monthly has correct prices and phase limit", () => {
      const plan = PLANS.student_monthly;
      expect(plan.prices.INR).toBe(549900); // Rs 5,499
      expect(plan.prices.USD).toBe(6500); // $65
      expect(plan.validityDays).toBe(30);
      expect(plan.maxPhasesPerMonth).toBe(4);
    });

    it("professional_onetime has correct prices and opus tier", () => {
      const plan = PLANS.professional_onetime;
      expect(plan.prices.INR).toBe(3999900); // Rs 39,999
      expect(plan.prices.USD).toBe(44900); // $449
      expect(plan.validityDays).toBe(180);
      expect(plan.modelTier).toBe("opus");
    });

    it("professional_monthly is marked coming soon", () => {
      expect(PLANS.professional_monthly.comingSoon).toBe(true);
      expect(PLANS.professional_monthly.prices.INR).toBe(0);
    });

    it("addon disallows generate", () => {
      const plan = PLANS.addon;
      expect(plan.allowsGenerate).toBe(false);
      expect(plan.prices.INR).toBe(399900); // Rs 3,999
      expect(plan.prices.USD).toBe(4900); // $49
    });

    it("sandbox has zero cost and is not visible", () => {
      const plan = PLANS.sandbox;
      expect(plan.prices.INR).toBe(0);
      expect(plan.prices.USD).toBe(0);
      expect(plan.visible).toBe(false);
    });
  });

  describe("getPlanConfig", () => {
    it("returns config for known plan IDs", () => {
      expect(getPlanConfig("student_onetime").name).toBe("Student One-Time");
      expect(getPlanConfig("addon").name).toBe("Add-on Thesis");
    });

    it("maps legacy one_time to student_onetime", () => {
      const config = getPlanConfig("one_time");
      expect(config.id).toBe("student_onetime");
      expect(config.name).toBe("Student One-Time");
    });

    it("throws for unknown plan type", () => {
      expect(() => getPlanConfig("nonexistent")).toThrow(
        "Unknown plan type: nonexistent"
      );
    });
  });

  describe("getPlanPrice", () => {
    it("returns correct INR price", () => {
      expect(getPlanPrice("student_onetime", "INR")).toBe(1499900);
    });

    it("returns correct USD price", () => {
      expect(getPlanPrice("professional_onetime", "USD")).toBe(44900);
    });

    it("handles legacy plan ID", () => {
      expect(getPlanPrice("one_time", "INR")).toBe(1499900);
    });
  });

  describe("getVisiblePlans", () => {
    it("returns only visible plans", () => {
      const visible = getVisiblePlans();
      const ids = visible.map((p) => p.id);
      expect(ids).not.toContain("sandbox");
      expect(ids).toContain("student_onetime");
      expect(ids).toContain("student_monthly");
      expect(ids).toContain("professional_onetime");
      expect(ids).toContain("professional_monthly");
      expect(ids).toContain("addon");
    });

    it("includes coming-soon plans in visible list", () => {
      const visible = getVisiblePlans();
      const proMonthly = visible.find(
        (p) => p.id === "professional_monthly"
      );
      expect(proMonthly).toBeDefined();
      expect(proMonthly!.comingSoon).toBe(true);
    });
  });

  describe("isSandboxPhase", () => {
    it("phases 0, 1, 2 are sandbox phases", () => {
      expect(isSandboxPhase(0)).toBe(true);
      expect(isSandboxPhase(1)).toBe(true);
      expect(isSandboxPhase(2)).toBe(true);
    });

    it("phases 3+ are not sandbox phases", () => {
      expect(isSandboxPhase(3)).toBe(false);
      expect(isSandboxPhase(6)).toBe(false);
      expect(isSandboxPhase(11)).toBe(false);
    });
  });
});
