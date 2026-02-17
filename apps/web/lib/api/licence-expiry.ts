import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface ExpiryCheck {
  expired: boolean;
  warning: boolean;
  daysRemaining: number;
}

/**
 * Check whether a licence has expired or is nearing expiry.
 * Returns expiry status and days remaining.
 */
export async function checkLicenceExpiry(
  licenceId: string
): Promise<ExpiryCheck | null> {
  const supabase = createAdminSupabaseClient();

  const { data: licence } = await supabase
    .from("thesis_licenses")
    .select("expires_at, status")
    .eq("id", licenceId)
    .single();

  if (!licence) return null;

  if (!licence.expires_at) {
    return { expired: false, warning: false, daysRemaining: Infinity };
  }

  const now = new Date();
  const expiresAt = new Date(licence.expires_at);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    expired: daysRemaining <= 0 || licence.status === "expired",
    warning: daysRemaining > 0 && daysRemaining <= 7,
    daysRemaining: Math.max(0, daysRemaining),
  };
}
