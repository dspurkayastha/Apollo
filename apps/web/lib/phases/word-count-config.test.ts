import { describe, expect, it } from "vitest";

import {
  WORD_COUNT_CONFIG,
  getWordCountConfig,
  wordCountInstruction,
} from "./word-count-config";

describe("WORD_COUNT_CONFIG", () => {
  it("contains entries for phases 2-8", () => {
    for (const phase of [2, 3, 4, 5, 6, 7, 8]) {
      expect(WORD_COUNT_CONFIG[phase]).toBeDefined();
    }
  });

  it("does not contain entries for non-prose phases", () => {
    for (const phase of [0, 1, 9, 10, 11]) {
      expect(WORD_COUNT_CONFIG[phase]).toBeUndefined();
    }
  });

  it("hardFloor equals softMin for all phases", () => {
    for (const cfg of Object.values(WORD_COUNT_CONFIG)) {
      expect(cfg.hardFloor).toBe(cfg.softMin);
    }
  });

  it("hardCeiling equals Math.ceil(softMax * 1.15) for all phases", () => {
    for (const cfg of Object.values(WORD_COUNT_CONFIG)) {
      expect(cfg.hardCeiling).toBe(Math.ceil(cfg.softMax * 1.15));
    }
  });

  it("aiAimLow <= aiAimHigh for all phases", () => {
    for (const cfg of Object.values(WORD_COUNT_CONFIG)) {
      expect(cfg.aiAimLow).toBeLessThanOrEqual(cfg.aiAimHigh);
    }
  });

  it("aiAimHigh equals softMax for all phases", () => {
    for (const cfg of Object.values(WORD_COUNT_CONFIG)) {
      expect(cfg.aiAimHigh).toBe(cfg.softMax);
    }
  });

  it("softMin < softMax for all phases", () => {
    for (const cfg of Object.values(WORD_COUNT_CONFIG)) {
      expect(cfg.softMin).toBeLessThan(cfg.softMax);
    }
  });

  it("matches DECISIONS.md 4.1 canonical values", () => {
    // Introduction
    expect(WORD_COUNT_CONFIG[2]).toEqual({
      softMin: 1000, softMax: 1400, hardFloor: 1000, hardCeiling: 1610,
      aiAimLow: 1300, aiAimHigh: 1400,
    });
    // Aims
    expect(WORD_COUNT_CONFIG[3]).toEqual({
      softMin: 300, softMax: 500, hardFloor: 300, hardCeiling: 575,
      aiAimLow: 450, aiAimHigh: 500,
    });
    // ROL
    expect(WORD_COUNT_CONFIG[4]).toEqual({
      softMin: 3500, softMax: 5000, hardFloor: 3500, hardCeiling: 5750,
      aiAimLow: 4500, aiAimHigh: 5000,
    });
    // Discussion
    expect(WORD_COUNT_CONFIG[7]).toEqual({
      softMin: 2000, softMax: 3500, hardFloor: 2000, hardCeiling: 4025,
      aiAimLow: 3000, aiAimHigh: 3500,
    });
    // Conclusion
    expect(WORD_COUNT_CONFIG[8]).toEqual({
      softMin: 500, softMax: 800, hardFloor: 500, hardCeiling: 920,
      aiAimLow: 700, aiAimHigh: 800,
    });
  });
});

describe("getWordCountConfig", () => {
  it("returns config for valid prose phases", () => {
    for (const phase of [2, 3, 4, 5, 6, 7, 8]) {
      expect(getWordCountConfig(phase)).not.toBeNull();
    }
  });

  it("returns null for non-prose phases", () => {
    for (const phase of [0, 1, 9, 10, 11, -1, 99]) {
      expect(getWordCountConfig(phase)).toBeNull();
    }
  });
});

describe("wordCountInstruction", () => {
  it("returns instruction string with correct values for phase 2", () => {
    const inst = wordCountInstruction(2);
    expect(inst).toContain("1000--1400");
    expect(inst).toContain("1300--1400");
    expect(inst).toContain("1610");
    expect(inst).toContain("HARD LIMIT");
  });

  it("returns empty string for non-prose phase", () => {
    expect(wordCountInstruction(0)).toBe("");
    expect(wordCountInstruction(1)).toBe("");
    expect(wordCountInstruction(9)).toBe("");
  });

  it("mentions BibTeX exclusion from word limit", () => {
    const inst = wordCountInstruction(4);
    expect(inst).toContain("BibTeX");
    expect(inst).toContain("do NOT count");
  });
});
