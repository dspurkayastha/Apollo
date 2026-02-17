import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { LicencePlanType } from "@/lib/types/database";
import { getPlanConfig } from "@/lib/pricing/config";

/**
 * Provision a thesis licence for a user after successful payment.
 * Returns the licence ID.
 */
export async function provisionLicence(
  userId: string,
  planType: LicencePlanType,
  projectId?: string
): Promise<string> {
  const supabase = createAdminSupabaseClient();

  const config = getPlanConfig(planType);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.validityDays);

  const isMonthly = config.billingType === "monthly";

  const { data: licence, error } = await supabase
    .from("thesis_licenses")
    .insert({
      user_id: userId,
      plan_type: planType,
      status: projectId ? "active" : "available",
      project_id: projectId ?? null,
      activated_at: projectId ? new Date().toISOString() : null,
      expires_at: expiresAt.toISOString(),
      billing_period_start: isMonthly ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !licence) {
    throw new Error(`Failed to provision licence: ${error?.message ?? "Unknown error"}`);
  }

  // If project_id provided, also update the project status to 'licensed'
  if (projectId) {
    await supabase
      .from("projects")
      .update({
        status: "licensed",
        license_id: licence.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", userId);
  }

  return licence.id;
}

/**
 * Atomic idempotency: attempt to INSERT the event into processed_webhooks.
 * The UNIQUE constraint on event_id means a concurrent/retry request will
 * conflict and return no rows. Returns true if this call claimed the event
 * (i.e. we should proceed with provisioning), false if already claimed.
 *
 * This MUST run BEFORE provisionLicence() — if we provisioned first and
 * this insert failed, a retry would provision a second licence.
 */
export async function claimWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string
): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("processed_webhooks")
    .upsert(
      { provider, event_id: eventId, event_type: eventType },
      { onConflict: "event_id", ignoreDuplicates: true }
    )
    .select("id");

  // upsert with ignoreDuplicates returns an empty array if the row already existed
  return (data?.length ?? 0) > 0;
}
