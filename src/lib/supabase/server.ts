import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicConfig } from "@/config/env";

type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = requireSupabasePublicConfig();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: CookieToSet[]) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot always mutate cookies. */ }
      },
    },
  });
}
