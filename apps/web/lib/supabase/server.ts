import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    // Return a dummy client that always returns empty results
    // This prevents crashes when Supabase is not configured
    return {
      from: () => ({
        select: () => ({
          order: () => ({ data: [], error: null }),
          eq: () => ({ data: [], error: null }),
          single: () => ({ data: null, error: null }),
          data: [],
          error: null,
        }),
        insert: () => ({ data: null, error: { message: "Supabase not configured" } }),
        update: () => ({ data: null, error: { message: "Supabase not configured" } }),
        delete: () => ({ data: null, error: { message: "Supabase not configured" } }),
      }),
    } as unknown as ReturnType<typeof createClient>;
  }

  return createClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return (await auth()).getToken() ?? null;
    },
  });
}
