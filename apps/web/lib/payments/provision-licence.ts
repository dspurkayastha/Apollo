import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { LicencePlanType } from "@/lib/types/database";

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

  const expiresAt = new Date();
  if (planType.includes("monthly")) {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    // One-time and addon licences expire in 1 year
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }

  const { data: licence, error } = await supabase
    .from("thesis_licenses")
    .insert({
      user_id: userId,
      plan_type: planType,
      status: "available",
      project_id: projectId ?? null,
      activated_at: projectId ? new Date().toISOString() : null,
      expires_at: expiresAt.toISOString(),
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
 * Check idempotency — has this webhook event already been processed?
 */
export async function isEventProcessed(
  provider: string,
  eventId: string
): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("processed_webhooks")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  return data !== null;
}

/**
 * Mark a webhook event as processed (idempotency guard).
 */
export async function markEventProcessed(
  provider: string,
  eventId: string,
  eventType: string
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  await supabase.from("processed_webhooks").insert({
    provider,
    event_id: eventId,
    event_type: eventType,
  });
}
