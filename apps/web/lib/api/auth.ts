import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { User } from "@/lib/types/database";

export async function getAuthenticatedUser(): Promise<{
  user: User;
  clerkUserId: string;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createAdminSupabaseClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  if (error || !user) return null;

  return { user: user as User, clerkUserId: userId };
}
