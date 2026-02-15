import { inngest } from "../client";
import { executeAnalysis } from "@/lib/r-plumber/analysis-runner";
import { release } from "@/lib/compute/semaphore";

/**
 * Inngest function: run a statistical analysis via R Plumber.
 *
 * Triggered by "analysis/run.requested" event from the analysis API route.
 * Handles execution, status updates, and semaphore release.
 */
export const analysisRunnerFn = inngest.createFunction(
  {
    id: "analysis-runner",
    retries: 1,
  },
  { event: "analysis/run.requested" },
  async ({ event, step }) => {
    const { analysisId, jobId } = event.data;

    try {
      await step.run("run-analysis", async () => {
        await executeAnalysis(analysisId);
      });

      return { status: "completed", analysisId };
    } catch (err) {
      console.error(`Analysis ${analysisId} failed:`, err);
      return {
        status: "failed",
        analysisId,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    } finally {
      // Always release the semaphore
      release(jobId);
    }
  }
);
