/**
 * Rate limiter for AI generation requests.
 * Limits: 10 requests per hour per user.
 *
 * Uses Redis sorted set when available, falls back to in-memory.
 */

import { getRedis } from "@/lib/redis/client";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const WINDOW_S = 3600;
const MAX_REQUESTS = 10;
const REDIS_KEY_PREFIX = "apollo:ratelimit:";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// ── In-memory fallback ──────────────────────────────────────────────────────

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

function memCheckRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(userId) ?? { timestamps: [] };

  entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);
  store.set(userId, entry);

  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}

// ── Redis-backed implementation ─────────────────────────────────────────────

async function redisCheckRateLimit(userId: string): Promise<RateLimitResult> {
  const redis = getRedis()!;
  const key = `${REDIS_KEY_PREFIX}${userId}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Unique member for this request (prevents ZREM from hitting other entries)
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;

  // Atomic pipeline: remove expired entries, add new, count, set TTL
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, { score: now, member });
  pipeline.zcard(key);
  pipeline.expire(key, WINDOW_S);

  const results = await pipeline.exec();
  const count = (results[2] as number) ?? 0;

  if (count > MAX_REQUESTS) {
    // Over limit — remove the specific entry we just added (not ZREMRANGEBYSCORE
    // which could remove other entries with the same timestamp score)
    await redis.zrem(key, member);

    // Calculate retry-after from the oldest entry in the window
    const rangeResults = await redis.zrange(key, 0, 0, { withScores: true }) as { member: string; score: number }[] | string[];
    let retryAfterMs = WINDOW_MS;
    if (Array.isArray(rangeResults) && rangeResults.length > 0) {
      const oldestScore = typeof rangeResults[0] === "object"
        ? (rangeResults[0] as { score: number }).score
        : await redis.zscore(key, rangeResults[0] as string) as number | null;
      if (oldestScore) {
        retryAfterMs = WINDOW_MS - (now - oldestScore);
      }
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(Math.max(retryAfterMs, 1000) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - count,
    retryAfterSeconds: 0,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function checkRateLimit(userId: string): RateLimitResult | Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return memCheckRateLimit(userId);
  return redisCheckRateLimit(userId);
}

/** Reset rate limit for a user (useful for testing). */
export function resetRateLimit(userId: string): void {
  store.delete(userId);
}

/** Clear all rate limit entries (useful for testing). */
export function clearAllRateLimits(): void {
  store.clear();
}
