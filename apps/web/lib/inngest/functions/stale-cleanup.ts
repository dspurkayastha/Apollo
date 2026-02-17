import { inngest } from "../client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis/client";

const STALE_COMPILE_MS = 5 * 60 * 1000; // 5 minutes
const STALE_ANALYSIS_MS = 10 * 60 * 1000; // 10 minutes
const REDIS_HASH_KEY = "apollo:semaphore:active";

/**
 * Inngest cron: sweep stale compilations, analyses, and Redis semaphore
 * entries every 5 minutes.
 *
 * Marks stuck "running" records as "failed" so users can retry.
 * Cleans up orphaned Redis hash entries whose TTL keys have expired.
 */
export const staleCleanupFn = inngest.createFunction(
  { id: "stale-cleanup" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const supabase = createAdminSupabaseClient();

    const staleCompiles = await step.run("sweep-compilations", async () => {
      const cutoff = new Date(Date.now() - STALE_COMPILE_MS).toISOString();
      const { data, error } = await supabase
        .from("compilations")
        .update({
          status: "failed",
          errors: ["Compilation timed out (stale cleanup)"],
        })
        .eq("status", "running")
        .lt("created_at", cutoff)
        .select("id");

      if (error) console.error("Stale compilation sweep error:", error);
      return data?.length ?? 0;
    });

    const staleAnalyses = await step.run("sweep-analyses", async () => {
      const cutoff = new Date(Date.now() - STALE_ANALYSIS_MS).toISOString();
      const { data, error } = await supabase
        .from("analyses")
        .update({
          status: "failed",
          results_json: { error: "Analysis timed out (stale cleanup)" },
        })
        .eq("status", "running")
        .lt("created_at", cutoff)
        .select("id");

      if (error) console.error("Stale analysis sweep error:", error);
      return data?.length ?? 0;
    });

    // Clean up orphaned Redis semaphore hash entries whose TTL keys expired
    const orphanedJobs = await step.run("sweep-redis-semaphore", async () => {
      const redis = getRedis();
      if (!redis) return 0;

      const allJobs = await redis.hgetall(REDIS_HASH_KEY) as Record<string, string> | null;
      if (!allJobs || Object.keys(allJobs).length === 0) return 0;

      const jobIds = Object.keys(allJobs);
      let removed = 0;

      for (const jobId of jobIds) {
        // Check if the per-job TTL key still exists
        const ttlKey = `apollo:semaphore:job:${jobId}`;
        const exists = await redis.exists(ttlKey);
        if (!exists) {
          // TTL key expired — this hash entry is orphaned
          await redis.hdel(REDIS_HASH_KEY, jobId);
          removed++;
        }
      }

      return removed;
    });

    return { staleCompiles, staleAnalyses, orphanedJobs };
  }
);
