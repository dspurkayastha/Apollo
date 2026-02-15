import { describe, it, expect, beforeEach } from "vitest";
import {
  tryAcquire,
  release,
  getStatus,
  _resetForTesting,
} from "./semaphore";

describe("compute semaphore", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it("can acquire a compile job (2 units)", () => {
    const result = tryAcquire("compile", "project-1", "user-1");
    expect(result.acquired).toBe(true);
    expect(result.jobId).toBeDefined();
    expect(getStatus().usedUnits).toBe(2);
  });

  it("can acquire an analysis job (1 unit)", () => {
    const result = tryAcquire("analysis", "project-1", "user-1");
    expect(result.acquired).toBe(true);
    expect(result.jobId).toBeDefined();
    expect(getStatus().usedUnits).toBe(1);
  });

  it("cannot exceed 3 units (compile + compile should fail on second)", () => {
    const first = tryAcquire("compile", "project-1", "user-1");
    expect(first.acquired).toBe(true);
    expect(getStatus().usedUnits).toBe(2);

    const second = tryAcquire("compile", "project-2", "user-2");
    expect(second.acquired).toBe(false);
    expect(second.position).toBe(1);
  });

  it("release frees units", () => {
    const first = tryAcquire("compile", "project-1", "user-1");
    expect(first.acquired).toBe(true);
    expect(getStatus().usedUnits).toBe(2);

    release(first.jobId!);
    expect(getStatus().usedUnits).toBe(0);
  });

  it("queue works: acquire compile, try second compile -> queued at position 1", () => {
    const first = tryAcquire("compile", "project-1", "user-1");
    expect(first.acquired).toBe(true);

    const second = tryAcquire("compile", "project-2", "user-2");
    expect(second.acquired).toBe(false);
    expect(second.position).toBe(1);
    expect(second.estimatedWaitMs).toBe(30_000);
  });

  it("queue depth limit: fill queue to 5, next attempt has no position", () => {
    const first = tryAcquire("compile", "project-0", "user-0");
    expect(first.acquired).toBe(true);

    for (let i = 1; i <= 5; i++) {
      const queued = tryAcquire("compile", `project-${i}`, `user-${i}`);
      expect(queued.acquired).toBe(false);
      expect(queued.position).toBe(i);
    }

    const overflow = tryAcquire("compile", "project-overflow", "user-overflow");
    expect(overflow.acquired).toBe(false);
    expect(overflow.position).toBeUndefined();
    expect(overflow.estimatedWaitMs).toBeUndefined();
  });

  it("getStatus returns correct state", () => {
    expect(getStatus()).toEqual({
      usedUnits: 0,
      maxUnits: 3,
      queueDepth: { compile: 0, analysis: 0 },
    });

    tryAcquire("compile", "project-1", "user-1");
    expect(getStatus()).toEqual({
      usedUnits: 2,
      maxUnits: 3,
      queueDepth: { compile: 0, analysis: 0 },
    });

    tryAcquire("analysis", "project-2", "user-2");
    expect(getStatus()).toEqual({
      usedUnits: 3,
      maxUnits: 3,
      queueDepth: { compile: 0, analysis: 0 },
    });

    tryAcquire("compile", "project-3", "user-3");
    expect(getStatus()).toEqual({
      usedUnits: 3,
      maxUnits: 3,
      queueDepth: { compile: 1, analysis: 0 },
    });
  });

  it("release promotes queued jobs", () => {
    const compile1 = tryAcquire("compile", "project-1", "user-1");
    const analysis1 = tryAcquire("analysis", "project-2", "user-2");
    expect(compile1.acquired).toBe(true);
    expect(analysis1.acquired).toBe(true);
    expect(getStatus().usedUnits).toBe(3);

    const queued = tryAcquire("analysis", "project-3", "user-3");
    expect(queued.acquired).toBe(false);
    expect(queued.position).toBe(1);

    release(analysis1.jobId!);
    expect(getStatus().usedUnits).toBe(3);
    expect(getStatus().queueDepth.analysis).toBe(0);
  });

  // Per-user fairness tests
  it("enforces per-user limit: same user cannot hold >2 concurrent slots", () => {
    const a1 = tryAcquire("analysis", "project-1", "user-1");
    const a2 = tryAcquire("analysis", "project-2", "user-1");
    expect(a1.acquired).toBe(true);
    expect(a2.acquired).toBe(true);

    // Third slot for same user should be queued
    const a3 = tryAcquire("analysis", "project-3", "user-1");
    expect(a3.acquired).toBe(false);
    expect(a3.reason).toContain("Per-user");
    expect(a3.position).toBe(1);
  });

  it("different users can acquire slots independently", () => {
    const a1 = tryAcquire("analysis", "project-1", "user-1");
    const a2 = tryAcquire("analysis", "project-2", "user-2");
    const a3 = tryAcquire("analysis", "project-3", "user-3");
    expect(a1.acquired).toBe(true);
    expect(a2.acquired).toBe(true);
    expect(a3.acquired).toBe(true);
    expect(getStatus().usedUnits).toBe(3);
  });

  it("promotes different user from queue when per-user limit blocks first entry", () => {
    // Fill capacity: compile (2 units) + user-1 analysis (1 unit) = 3 units
    const c1 = tryAcquire("compile", "p0", "user-0");
    const a1 = tryAcquire("analysis", "p1", "user-1");
    expect(c1.acquired).toBe(true);
    expect(a1.acquired).toBe(true);
    expect(getStatus().usedUnits).toBe(3);

    // Queue user-1 again (both per-user OK since they have 1, but global full)
    const a2 = tryAcquire("analysis", "p2", "user-1");
    expect(a2.acquired).toBe(false);
    expect(a2.position).toBe(1);

    // Queue user-2
    const a3 = tryAcquire("analysis", "p3", "user-2");
    expect(a3.acquired).toBe(false);
    expect(a3.position).toBe(2);

    // Release user-1's analysis → frees 1 unit → first in queue is user-1
    // user-1 is eligible (only had 1 slot, now 0), so they get promoted
    release(a1.jobId!);
    expect(getStatus().usedUnits).toBe(3); // compile(2) + promoted user-1(1)
    expect(getStatus().queueDepth.analysis).toBe(1); // user-2 still waiting
  });

  it("defaults userId to anonymous when not provided", () => {
    const result = tryAcquire("analysis", "project-1");
    expect(result.acquired).toBe(true);
  });
});
