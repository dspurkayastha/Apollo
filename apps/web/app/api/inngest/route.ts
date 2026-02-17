import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { thesisPhaseWorkflow } from "@/lib/inngest/functions/thesis-workflow";
import { analysisRunnerFn } from "@/lib/inngest/functions/analysis-runner";
import { staleCleanupFn } from "@/lib/inngest/functions/stale-cleanup";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [thesisPhaseWorkflow, analysisRunnerFn, staleCleanupFn],
});
