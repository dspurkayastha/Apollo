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
    expect(getWordCountTarget(2)).toEqual({ min: 1000, max: 1400 });
  });

  it("returns correct target for aims (phase 3)", () => {
    expect(getWordCountTarget(3)).toEqual({ min: 300, max: 500 });
  });

  it("returns correct target for review of literature (phase 4)", () => {
    expect(getWordCountTarget(4)).toEqual({ min: 3500, max: 5000 });
  });

  it("returns correct target for materials & methods (phase 5)", () => {
    expect(getWordCountTarget(5)).toEqual({ min: 1500, max: 2500 });
  });

  it("returns correct target for results (phase 6)", () => {
    expect(getWordCountTarget(6)).toEqual({ min: 1500, max: 2500 });
  });

  it("returns correct target for discussion (phase 7)", () => {
    expect(getWordCountTarget(7)).toEqual({ min: 2000, max: 3500 });
  });

  it("returns correct target for conclusion (phase 8)", () => {
    expect(getWordCountTarget(8)).toEqual({ min: 500, max: 800 });
  });
});

describe("getWordCountStatus", () => {
  it('returns "under" when word count is below minimum', () => {
    // Phase 2 (introduction): min 1000
    expect(getWordCountStatus(2, 400)).toBe("under");
    expect(getWordCountStatus(2, 0)).toBe("under");
    expect(getWordCountStatus(2, 999)).toBe("under");
  });

  it('returns "on-target" when word count is within range (inclusive)', () => {
    // Phase 2 (introduction): 1000–1400
    expect(getWordCountStatus(2, 1000)).toBe("on-target");
    expect(getWordCountStatus(2, 1200)).toBe("on-target");
    expect(getWordCountStatus(2, 1400)).toBe("on-target");
  });

  it('returns "over" when word count exceeds maximum', () => {
    // Phase 2 (introduction): max 1400
    expect(getWordCountStatus(2, 1401)).toBe("over");
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
    // Phase 8 (conclusion): 500–800
    expect(getWordCountStatus(8, 499)).toBe("under");
    expect(getWordCountStatus(8, 500)).toBe("on-target");
    expect(getWordCountStatus(8, 800)).toBe("on-target");
    expect(getWordCountStatus(8, 801)).toBe("over");
  });
});
