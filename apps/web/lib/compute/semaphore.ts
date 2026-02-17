/**
 * Global in-memory semaphore for compute resource admission control.
 *
 * Total capacity: 3 units
 *   - compile job = 2 units
 *   - analysis job = 1 unit
 *
 * Each job type has an independent queue with a max depth of 5.
 *
 * Per-user fairness: no single user can hold more than MAX_PER_USER
 * concurrent analysis slots. This ensures round-robin fairness.
 */

import { randomUUID } from "crypto";

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

interface QueueEntry {
  type: JobType;
  projectId: string;
  userId: string;
  resolve: (jobId: string) => void;
}

const MAX_UNITS = 3;
const MAX_QUEUE_DEPTH = 5;
const MAX_PER_USER = 2; // No single user can hold >2 concurrent slots
const MAX_ANALYSIS_CONCURRENT = 2; // R Plumber container limit
const ESTIMATED_WAIT_PER_POSITION_MS = 30_000;

const UNIT_COST: Record<JobType, number> = {
  compile: 2,
  analysis: 1,
};

const activeJobs = new Map<string, ActiveJob>();
const queues: Record<JobType, QueueEntry[]> = {
  compile: [],
  analysis: [],
};

function usedUnits(): number {
  let total = 0;
  for (const job of activeJobs.values()) {
    total += job.units;
  }
  return total;
}

/** Count active jobs for a specific user */
function userActiveCount(userId: string): number {
  let count = 0;
  for (const job of activeJobs.values()) {
    if (job.userId === userId) count++;
  }
  return count;
}

/** Count active analysis jobs across all users */
function activeAnalysisCount(): number {
  let count = 0;
  for (const job of activeJobs.values()) {
    if (job.type === "analysis") count++;
  }
  return count;
}

export function tryAcquire(
  type: JobType,
  projectId: string,
  userId: string = "anonymous"
): AcquireResult {
  const cost = UNIT_COST[type];

  // Per-user fairness: reject if user already at limit
  if (userActiveCount(userId) >= MAX_PER_USER) {
    // Try to queue instead of hard-rejecting
    const queue = queues[type];
    if (queue.length >= MAX_QUEUE_DEPTH) {
      return {
        acquired: false,
        reason: "Per-user concurrency limit reached and queue full",
      };
    }

    const position = queue.length + 1;
    queue.push({ type, projectId, userId, resolve: () => {} });

    return {
      acquired: false,
      position,
      estimatedWaitMs: position * ESTIMATED_WAIT_PER_POSITION_MS,
      reason: "Per-user concurrency limit reached — queued",
    };
  }

  // Analysis concurrency limit: R Plumber can only handle 2 concurrent requests
  if (type === "analysis" && activeAnalysisCount() >= MAX_ANALYSIS_CONCURRENT) {
    const queue = queues[type];
    if (queue.length >= MAX_QUEUE_DEPTH) {
      return {
        acquired: false,
        reason: "Analysis concurrency limit reached and queue full",
      };
    }
    const position = queue.length + 1;
    queue.push({ type, projectId, userId, resolve: () => {} });
    return {
      acquired: false,
      position,
      estimatedWaitMs: position * ESTIMATED_WAIT_PER_POSITION_MS,
      reason: "Analysis concurrency limit reached — queued",
    };
  }

  if (usedUnits() + cost <= MAX_UNITS) {
    const jobId = randomUUID();
    activeJobs.set(jobId, { type, units: cost, projectId, userId });
    return { acquired: true, jobId };
  }

  // Not enough capacity — try to queue
  const queue = queues[type];
  if (queue.length >= MAX_QUEUE_DEPTH) {
    return { acquired: false };
  }

  const position = queue.length + 1;
  queue.push({ type, projectId, userId, resolve: () => {} });

  return {
    acquired: false,
    position,
    estimatedWaitMs: position * ESTIMATED_WAIT_PER_POSITION_MS,
  };
}

export function release(jobId: string): void {
  const job = activeJobs.get(jobId);
  if (!job) return;

  activeJobs.delete(jobId);

  // Try to promote queued jobs, checking both queues
  for (const type of ["compile", "analysis"] as const) {
    const queue = queues[type];
    const cost = UNIT_COST[type];

    while (queue.length > 0 && usedUnits() + cost <= MAX_UNITS) {
      // Respect R Plumber concurrency limit during promotion
      if (type === "analysis" && activeAnalysisCount() >= MAX_ANALYSIS_CONCURRENT) {
        break;
      }

      const entry = queue[0]!;

      // Check per-user limit before promoting
      if (userActiveCount(entry.userId) >= MAX_PER_USER) {
        // Skip this entry, try the next one with a different user
        const skippedIndex = findNextEligibleInQueue(queue);
        if (skippedIndex === -1) break; // No eligible entries

        const eligible = queue.splice(skippedIndex, 1)[0]!;
        const newJobId = randomUUID();
        activeJobs.set(newJobId, {
          type,
          units: cost,
          projectId: eligible.projectId,
          userId: eligible.userId,
        });
        eligible.resolve(newJobId);
        continue;
      }

      queue.shift();
      const newJobId = randomUUID();
      activeJobs.set(newJobId, {
        type,
        units: cost,
        projectId: entry.projectId,
        userId: entry.userId,
      });
      entry.resolve(newJobId);
    }
  }
}

/** Find the first queue entry whose user is below the per-user limit */
function findNextEligibleInQueue(queue: QueueEntry[]): number {
  for (let i = 0; i < queue.length; i++) {
    if (userActiveCount(queue[i]!.userId) < MAX_PER_USER) {
      return i;
    }
  }
  return -1;
}

export function getStatus(): {
  usedUnits: number;
  maxUnits: number;
  queueDepth: Record<JobType, number>;
} {
  return {
    usedUnits: usedUnits(),
    maxUnits: MAX_UNITS,
    queueDepth: {
      compile: queues.compile.length,
      analysis: queues.analysis.length,
    },
  };
}

/**
 * Reset all state. Only for use in tests.
 */
export function _resetForTesting(): void {
  activeJobs.clear();
  queues.compile.length = 0;
  queues.analysis.length = 0;
}
