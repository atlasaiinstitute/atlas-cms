import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicConfig } from "@/config/env";

export function createSupabaseBrowserClient() {
  const env = requireSupabasePublicConfig();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
