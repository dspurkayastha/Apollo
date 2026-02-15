import { auth, currentUser } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { User } from "@/lib/types/database";

export async function getAuthenticatedUser(): Promise<{
  user: User;
  clerkUserId: string;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createAdminSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  if (user) return { user: user as User, clerkUserId: userId };

  // JIT provisioning: create user in Supabase if they exist in Clerk
  // but not yet synced (e.g. webhook not configured in local dev)
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses?.[0]?.emailAddress;
  if (!email) return null;

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    email;

  const { data: newUser, error: insertError } = await supabase
    .from("users")
    .insert({
      clerk_user_id: userId,
      email,
      name,
      role: "student",
    })
    .select("*")
    .single();

  if (insertError || !newUser) {
    console.error("JIT user provisioning failed:", insertError);
    return null;
  }

  return { user: newUser as User, clerkUserId: userId };
}
