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

  it("can acquire a compile job (2 units)", async () => {
    const result = await tryAcquire("compile", "project-1", "user-1");
    expect(result.acquired).toBe(true);
    expect(result.jobId).toBeDefined();
    const status = await getStatus();
    expect(status.usedUnits).toBe(2);
  });

  it("can acquire an analysis job (1 unit)", async () => {
    const result = await tryAcquire("analysis", "project-1", "user-1");
    expect(result.acquired).toBe(true);
    expect(result.jobId).toBeDefined();
    const status = await getStatus();
    expect(status.usedUnits).toBe(1);
  });

  it("cannot exceed 3 units (compile + compile should fail on second)", async () => {
    const first = await tryAcquire("compile", "project-1", "user-1");
    expect(first.acquired).toBe(true);
    expect((await getStatus()).usedUnits).toBe(2);

    const second = await tryAcquire("compile", "project-2", "user-2");
    expect(second.acquired).toBe(false);
  });

  it("release frees units", async () => {
    const first = await tryAcquire("compile", "project-1", "user-1");
    expect(first.acquired).toBe(true);
    expect((await getStatus()).usedUnits).toBe(2);

    await release(first.jobId!);
    expect((await getStatus()).usedUnits).toBe(0);
  });

  it("rejects when capacity full", async () => {
    const first = await tryAcquire("compile", "project-1", "user-1");
    expect(first.acquired).toBe(true);

    const second = await tryAcquire("compile", "project-2", "user-2");
    expect(second.acquired).toBe(false);
    expect(second.estimatedWaitMs).toBeDefined();
  });

  it("getStatus returns correct state", async () => {
    expect(await getStatus()).toEqual({
      usedUnits: 0,
      maxUnits: 3,
      queueDepth: { compile: 0, analysis: 0 },
    });

    await tryAcquire("compile", "project-1", "user-1");
    expect(await getStatus()).toEqual({
      usedUnits: 2,
      maxUnits: 3,
      queueDepth: { compile: 0, analysis: 0 },
    });

    await tryAcquire("analysis", "project-2", "user-2");
    expect(await getStatus()).toEqual({
      usedUnits: 3,
      maxUnits: 3,
      queueDepth: { compile: 0, analysis: 0 },
    });
  });

  it("release allows new acquisition", async () => {
    const compile1 = await tryAcquire("compile", "project-1", "user-1");
    const analysis1 = await tryAcquire("analysis", "project-2", "user-2");
    expect(compile1.acquired).toBe(true);
    expect(analysis1.acquired).toBe(true);
    expect((await getStatus()).usedUnits).toBe(3);

    // Can't acquire another
    const blocked = await tryAcquire("analysis", "project-3", "user-3");
    expect(blocked.acquired).toBe(false);

    // Release analysis → free 1 unit
    await release(analysis1.jobId!);
    expect((await getStatus()).usedUnits).toBe(2);

    // Now can acquire
    const newJob = await tryAcquire("analysis", "project-3", "user-3");
    expect(newJob.acquired).toBe(true);
    expect((await getStatus()).usedUnits).toBe(3);
  });

  // Per-user fairness tests
  it("enforces per-user limit: same user cannot hold >2 concurrent slots", async () => {
    const a1 = await tryAcquire("analysis", "project-1", "user-1");
    const a2 = await tryAcquire("analysis", "project-2", "user-1");
    expect(a1.acquired).toBe(true);
    expect(a2.acquired).toBe(true);

    // Third slot for same user should be rejected
    const a3 = await tryAcquire("analysis", "project-3", "user-1");
    expect(a3.acquired).toBe(false);
    expect(a3.reason).toContain("Per-user");
  });

  it("different users can acquire slots independently up to analysis limit", async () => {
    const a1 = await tryAcquire("analysis", "project-1", "user-1");
    const a2 = await tryAcquire("analysis", "project-2", "user-2");
    expect(a1.acquired).toBe(true);
    expect(a2.acquired).toBe(true);
    expect((await getStatus()).usedUnits).toBe(2);

    // 3rd analysis rejected — R Plumber can only handle 2 concurrent
    const a3 = await tryAcquire("analysis", "project-3", "user-3");
    expect(a3.acquired).toBe(false);
    expect(a3.reason).toContain("Analysis concurrency limit");
  });

  it("enforces max 2 concurrent analyses across all users", async () => {
    const a1 = await tryAcquire("analysis", "p1", "user-1");
    const a2 = await tryAcquire("analysis", "p2", "user-2");
    expect(a1.acquired).toBe(true);
    expect(a2.acquired).toBe(true);

    // 3rd analysis rejected
    const a3 = await tryAcquire("analysis", "p3", "user-3");
    expect(a3.acquired).toBe(false);

    // Compile needs 2 units, only 1 available
    const c1 = await tryAcquire("compile", "p4", "user-4");
    expect(c1.acquired).toBe(false);

    // Release one analysis → now compile can fit (2 units free)
    await release(a1.jobId!);
    const c2 = await tryAcquire("compile", "p4", "user-4");
    expect(c2.acquired).toBe(true);
    expect((await getStatus()).usedUnits).toBe(3); // a2(1) + c2(2)
  });

  it("defaults userId to anonymous when not provided", async () => {
    const result = await tryAcquire("analysis", "project-1");
    expect(result.acquired).toBe(true);
  });
});
