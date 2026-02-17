import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_LICENCES_PER_30_DAYS = 5;

export interface VelocityResult {
  allowed: boolean;
  count: number;
  limit: number;
}

/**
 * Check whether a user has exceeded the licence purchase velocity limit.
 * Fail-open on DB errors to avoid blocking legitimate purchases.
 */
export async function checkVelocity(userId: string): Promise<VelocityResult> {
  try {
    const supabase = createAdminSupabaseClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count, error } = await supabase
      .from("thesis_licenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (error) {
      console.error("Velocity check DB error (failing open):", error);
      return { allowed: true, count: 0, limit: MAX_LICENCES_PER_30_DAYS };
    }

    const currentCount = count ?? 0;
    return {
      allowed: currentCount < MAX_LICENCES_PER_30_DAYS,
      count: currentCount,
      limit: MAX_LICENCES_PER_30_DAYS,
    };
  } catch (err) {
    console.error("Velocity check error (failing open):", err);
    return { allowed: true, count: 0, limit: MAX_LICENCES_PER_30_DAYS };
  }
}
