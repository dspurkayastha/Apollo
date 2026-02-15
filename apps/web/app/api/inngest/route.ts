import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { thesisPhaseWorkflow } from "@/lib/inngest/functions/thesis-workflow";
import { analysisRunnerFn } from "@/lib/inngest/functions/analysis-runner";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [thesisPhaseWorkflow, analysisRunnerFn],
});
