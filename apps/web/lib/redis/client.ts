import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

/**
 * Returns an Upstash Redis client singleton, or null if env vars are missing.
 * Returning null enables graceful fallback to in-memory stores in dev/test.
 */
export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}
