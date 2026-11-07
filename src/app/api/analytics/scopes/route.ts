import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AnalyticsScopes = {
  organizations: Array<{ id: string; name: string; communities: Array<{ id: string; name: string }> }>;
  canViewPlatform: boolean;
};

export async function GET() {
  try {
    const client = await createSupabaseServerClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "Sign in with an authorized development identity to select analytics scope." }, { status: 401 });
    const { data, error } = await client.rpc("get_analytics_scopes");
    if (error) throw error;
    const result = (data ?? { organizations: [], canViewPlatform: false }) as unknown as AnalyticsScopes;
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load analytics scopes.";
    const status = /configured|fetch|network/i.test(message) ? 503 : /authorized|access/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Analytics scope lookup failed. Verify the database migration and try again." : message }, { status });
  }
}
