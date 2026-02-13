import { createClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/nextjs";

let clientInstance: ReturnType<typeof createClient> | null = null;

export function useSupabaseClient() {
  const { session } = useSession();

  if (!clientInstance) {
    clientInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        async accessToken() {
          return (await session?.getToken()) ?? null;
        },
      }
    );
  }

  return clientInstance;
}
