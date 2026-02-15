import { describe, expect, it } from "vitest";

import {
  getWordCountTarget,
  getWordCountStatus,
} from "./word-count-targets";

describe("getWordCountTarget", () => {
  it.each([0, 1, 9, 10, 11])(
    "returns null for phase %i (no target)",
    (phase) => {
      expect(getWordCountTarget(phase)).toBeNull();
    },
  );

  it("returns correct target for introduction (phase 2)", () => {
    expect(getWordCountTarget(2)).toEqual({ min: 750, max: 1200 });
  });

  it("returns correct target for aims (phase 3)", () => {
    expect(getWordCountTarget(3)).toEqual({ min: 200, max: 500 });
  });

  it("returns correct target for review of literature (phase 4)", () => {
    expect(getWordCountTarget(4)).toEqual({ min: 3500, max: 4500 });
  });

  it("returns correct target for materials & methods (phase 5)", () => {
    expect(getWordCountTarget(5)).toEqual({ min: 1500, max: 3000 });
  });

  it("returns correct target for results (phase 6)", () => {
    expect(getWordCountTarget(6)).toEqual({ min: 1500, max: 3000 });
  });

  it("returns correct target for discussion (phase 7)", () => {
    expect(getWordCountTarget(7)).toEqual({ min: 2000, max: 3500 });
  });

  it("returns correct target for conclusion (phase 8)", () => {
    expect(getWordCountTarget(8)).toEqual({ min: 400, max: 800 });
  });
});

describe("getWordCountStatus", () => {
  it('returns "under" when word count is below minimum', () => {
    // Phase 2 (introduction): min 750
    expect(getWordCountStatus(2, 400)).toBe("under");
    expect(getWordCountStatus(2, 0)).toBe("under");
    expect(getWordCountStatus(2, 749)).toBe("under");
  });

  it('returns "on-target" when word count is within range (inclusive)', () => {
    // Phase 2 (introduction): 750–1200
    expect(getWordCountStatus(2, 750)).toBe("on-target");
    expect(getWordCountStatus(2, 1000)).toBe("on-target");
    expect(getWordCountStatus(2, 1200)).toBe("on-target");
  });

  it('returns "over" when word count exceeds maximum', () => {
    // Phase 2 (introduction): max 1200
    expect(getWordCountStatus(2, 1201)).toBe("over");
    expect(getWordCountStatus(2, 5000)).toBe("over");
  });

  it('returns "no-target" for phases without targets', () => {
    expect(getWordCountStatus(0, 100)).toBe("no-target");
    expect(getWordCountStatus(1, 500)).toBe("no-target");
    expect(getWordCountStatus(9, 200)).toBe("no-target");
    expect(getWordCountStatus(10, 0)).toBe("no-target");
    expect(getWordCountStatus(11, 999)).toBe("no-target");
  });

  it("handles boundary values correctly for other phases", () => {
    // Phase 8 (conclusion): 400–800
    expect(getWordCountStatus(8, 399)).toBe("under");
    expect(getWordCountStatus(8, 400)).toBe("on-target");
    expect(getWordCountStatus(8, 800)).toBe("on-target");
    expect(getWordCountStatus(8, 801)).toBe("over");
  });
});
