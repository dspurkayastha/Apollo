/**
 * Compute resource admission control with Redis-backed state.
 *
 * Total capacity: 3 units
 *   - compile job = 2 units
 *   - analysis job = 1 unit
 *
 * Per-user fairness: no single user can hold more than MAX_PER_USER
 * concurrent slots. R Plumber capped at MAX_ANALYSIS_CONCURRENT.
 *
 * Falls back to in-memory maps when Redis is unavailable (dev/test).
 */

import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis/client";

export type JobType = "compile" | "analysis";

export interface AcquireResult {
  acquired: boolean;
  position?: number;
  estimatedWaitMs?: number;
  jobId?: string;
  /** If rejected due to per-user limit, this is set */
  reason?: string;
}

interface ActiveJob {
  type: JobType;
  units: number;
  projectId: string;
  userId: string;
}

const MAX_UNITS = 3;
const MAX_PER_USER = 2;
const MAX_ANALYSIS_CONCURRENT = 2;
const ESTIMATED_WAIT_PER_POSITION_MS = 30_000;
const REDIS_JOB_TTL_S = 600; // 10-min TTL per job (auto-expire safety)

const UNIT_COST: Record<JobType, number> = {
  compile: 2,
  analysis: 1,
};

const REDIS_HASH_KEY = "apollo:semaphore:active";

// ── In-memory fallback (dev/test without Redis) ─────────────────────────────

const memoryJobs = new Map<string, ActiveJob>();

function memUsedUnits(): number {
  let total = 0;
  for (const job of memoryJobs.values()) total += job.units;
  return total;
}

function memUserCount(userId: string): number {
  let count = 0;
  for (const job of memoryJobs.values()) {
    if (job.userId === userId) count++;
  }
  return count;
}

function memAnalysisCount(): number {
  let count = 0;
  for (const job of memoryJobs.values()) {
    if (job.type === "analysis") count++;
  }
  return count;
}

function memTryAcquire(type: JobType, projectId: string, userId: string): AcquireResult {
  const cost = UNIT_COST[type];

  if (memUserCount(userId) >= MAX_PER_USER) {
    return { acquired: false, reason: "Per-user concurrency limit reached" };
  }
  if (type === "analysis" && memAnalysisCount() >= MAX_ANALYSIS_CONCURRENT) {
    return { acquired: false, reason: "Analysis concurrency limit reached" };
  }
  if (memUsedUnits() + cost > MAX_UNITS) {
    return { acquired: false, estimatedWaitMs: ESTIMATED_WAIT_PER_POSITION_MS };
  }

  const jobId = randomUUID();
  memoryJobs.set(jobId, { type, units: cost, projectId, userId });
  return { acquired: true, jobId };
}

function memRelease(jobId: string): void {
  memoryJobs.delete(jobId);
}

function memGetStatus() {
  return {
    usedUnits: memUsedUnits(),
    maxUnits: MAX_UNITS,
    queueDepth: { compile: 0, analysis: 0 },
  };
}

// ── Redis-backed implementation ─────────────────────────────────────────────

async function redisTryAcquire(type: JobType, projectId: string, userId: string): Promise<AcquireResult> {
  const redis = getRedis()!;
  const cost = UNIT_COST[type];
  const jobId = randomUUID();

  // NOTE: HGETALL + conditional HSET is not fully atomic (TOCTOU). Under
  // concurrent load, two requests could both read "capacity available" and
  // both acquire, briefly exceeding MAX_UNITS. Acceptable for single-VPS
  // deployment (Hetzner CX23). For multi-instance, replace with a Lua script
  // via redis.eval() for true atomicity.
  const allJobs = await redis.hgetall(REDIS_HASH_KEY) as Record<string, string> | null;
  const jobs: Record<string, ActiveJob> = {};

  if (allJobs) {
    for (const [k, v] of Object.entries(allJobs)) {
      if (typeof v === "string") {
        try { jobs[k] = JSON.parse(v); } catch { /* skip corrupt entries */ }
      } else {
        // Upstash may auto-deserialise to object
        jobs[k] = v as unknown as ActiveJob;
      }
    }
  }

  // Check constraints
  let usedUnits = 0;
  let userCount = 0;
  let analysisCount = 0;

  for (const job of Object.values(jobs)) {
    usedUnits += job.units;
    if (job.userId === userId) userCount++;
    if (job.type === "analysis") analysisCount++;
  }

  if (userCount >= MAX_PER_USER) {
    return { acquired: false, reason: "Per-user concurrency limit reached" };
  }
  if (type === "analysis" && analysisCount >= MAX_ANALYSIS_CONCURRENT) {
    return { acquired: false, reason: "Analysis concurrency limit reached" };
  }
  if (usedUnits + cost > MAX_UNITS) {
    return { acquired: false, estimatedWaitMs: ESTIMATED_WAIT_PER_POSITION_MS };
  }

  // Acquire: set job in hash + per-job TTL key
  const jobData: ActiveJob = { type, units: cost, projectId, userId };
  const pipeline = redis.pipeline();
  pipeline.hset(REDIS_HASH_KEY, { [jobId]: JSON.stringify(jobData) });
  // Per-job TTL key: when it expires, a stale-cleanup cron can GC the hash entry
  pipeline.set(`apollo:semaphore:job:${jobId}`, "1", { ex: REDIS_JOB_TTL_S });
  await pipeline.exec();

  return { acquired: true, jobId };
}

async function redisRelease(jobId: string): Promise<void> {
  const redis = getRedis()!;
  const pipeline = redis.pipeline();
  pipeline.hdel(REDIS_HASH_KEY, jobId);
  pipeline.del(`apollo:semaphore:job:${jobId}`);
  await pipeline.exec();
}

async function redisGetStatus() {
  const redis = getRedis()!;
  const allJobs = await redis.hgetall(REDIS_HASH_KEY) as Record<string, string> | null;

  let usedUnits = 0;
  if (allJobs) {
    for (const v of Object.values(allJobs)) {
      try {
        const job: ActiveJob = typeof v === "string" ? JSON.parse(v) : v as unknown as ActiveJob;
        usedUnits += job.units;
      } catch { /* skip */ }
    }
  }

  return {
    usedUnits,
    maxUnits: MAX_UNITS,
    queueDepth: { compile: 0, analysis: 0 },
  };
}

// ── Public API (same interface — callers unchanged) ─────────────────────────

export function tryAcquire(
  type: JobType,
  projectId: string,
  userId: string = "anonymous"
): AcquireResult | Promise<AcquireResult> {
  const redis = getRedis();
  if (!redis) return memTryAcquire(type, projectId, userId);
  return redisTryAcquire(type, projectId, userId);
}

export function release(jobId: string): void | Promise<void> {
  const redis = getRedis();
  if (!redis) return memRelease(jobId);
  return redisRelease(jobId);
}

export function getStatus(): { usedUnits: number; maxUnits: number; queueDepth: Record<JobType, number> } | Promise<{ usedUnits: number; maxUnits: number; queueDepth: Record<JobType, number> }> {
  const redis = getRedis();
  if (!redis) return memGetStatus();
  return redisGetStatus();
}

/**
 * Reset all state. Only for use in tests.
 */
export function _resetForTesting(): void {
  memoryJobs.clear();
}
