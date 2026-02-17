import { inngest } from "../client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Daily cron (02:00 UTC): sweep expired licences.
 * Sets status = 'expired' for active licences past their expires_at.
 */
export const licenceExpiryCronFn = inngest.createFunction(
  { id: "licence-expiry-cron", name: "Licence Expiry Sweep" },
  { cron: "0 2 * * *" },
  async ({ step }) => {
    const expired = await step.run("sweep-expired-licences", async () => {
      const supabase = createAdminSupabaseClient();

      const { data, error } = await supabase
        .from("thesis_licenses")
        .update({ status: "expired" })
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString())
        .select("id");

      if (error) {
        console.error("Licence expiry sweep failed:", error);
        return 0;
      }

      return data?.length ?? 0;
    });

    return { expired };
  }
);
