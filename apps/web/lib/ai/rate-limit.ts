/**
 * In-memory rate limiter for AI generation requests.
 * Limits: 10 requests per hour per user.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 10;

const store = new Map<string, RateLimitEntry>();

function cleanExpired(entry: RateLimitEntry, now: number): number[] {
  return entry.timestamps.filter((ts) => now - ts < WINDOW_MS);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(userId) ?? { timestamps: [] };

  entry.timestamps = cleanExpired(entry, now);

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

/** Reset rate limit for a user (useful for testing). */
export function resetRateLimit(userId: string): void {
  store.delete(userId);
}

/** Clear all rate limit entries (useful for testing). */
export function clearAllRateLimits(): void {
  store.clear();
}
