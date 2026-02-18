import { inngest } from "../client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deleteR2Prefix } from "@/lib/r2/client";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Daily cron (03:00 UTC): purge accounts where deletion_requested_at + 7 days < now().
 * Hard-deletes user row (CASCADE handles projects -> sections/citations/datasets/etc. -> audit_log).
 * Also cleans R2 objects and deletes the Clerk user.
 */
export const accountDeletionCronFn = inngest.createFunction(
  { id: "account-deletion-cron", name: "Account Deletion Purge" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const purged = await step.run("purge-expired-accounts", async () => {
      const supabase = createAdminSupabaseClient();

      // Find users whose 7-day cooling-off period has expired
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: users, error: fetchError } = await supabase
        .from("users")
        .select("id, clerk_user_id")
        .not("deletion_requested_at", "is", null)
        .lt("deletion_requested_at", sevenDaysAgo);

      if (fetchError || !users || users.length === 0) {
        if (fetchError) console.error("Account deletion query failed:", fetchError);
        return 0;
      }

      let count = 0;

      for (const user of users) {
        try {
          // 1. Fetch all project IDs for this user
          const { data: projects } = await supabase
            .from("projects")
            .select("id")
            .eq("user_id", user.id);

          // 2. Clean R2 objects for each project
          if (projects) {
            for (const project of projects) {
              try {
                await deleteR2Prefix(`projects/${project.id}/`);
              } catch (r2Err) {
                console.error(
                  `R2 cleanup failed for project ${project.id}:`,
                  r2Err
                );
              }
            }
          }

          // 3. Hard-delete user row (CASCADE handles child tables)
          const { error: deleteError } = await supabase
            .from("users")
            .delete()
            .eq("id", user.id);

          if (deleteError) {
            console.error(`Failed to delete user ${user.id}:`, deleteError);
            continue;
          }

          // 4. Delete from Clerk
          try {
            const clerk = await clerkClient();
            await clerk.users.deleteUser(user.clerk_user_id);
          } catch (clerkErr) {
            // User may already be deleted from Clerk — log but don't fail
            console.error(
              `Clerk user deletion failed for ${user.clerk_user_id}:`,
              clerkErr
            );
          }

          count++;
        } catch (err) {
          console.error(`Account purge failed for user ${user.id}:`, err);
        }
      }

      return count;
    });

    return { purged };
  }
);
