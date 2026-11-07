import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnalyticsResult, type AnalyticsDateFilter, type AnalyticsScope } from "@/services/analytics";

const allowedTypes = new Set(["platform", "overview", "organizations", "communities", "members", "applications", "events", "governance", "content", "resources", "engagement", "messaging"]);
function validScope(body: Record<string, unknown>): AnalyticsScope | null {
  if (body.scopeLevel === "platform") return { level: "platform" };
  if (body.scopeLevel === "organization" && typeof body.organizationId === "string") return { level: "organization", organizationId: body.organizationId };
  if (body.scopeLevel === "community" && typeof body.organizationId === "string" && typeof body.communityId === "string") return { level: "community", organizationId: body.organizationId, communityId: body.communityId };
  return null;
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Report request failed.";
  const status = /authorized|access|sign in/i.test(message) ? 403 : /date|timezone|range|scope|unsupported|name/i.test(message) ? 400 : /configured|network|fetch/i.test(message) ? 503 : 500;
  return NextResponse.json({ error: status === 500 ? "Report operation failed. Verify database setup and try again." : message }, { status });
}
function parseBody(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Report details are required.");
  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.reportType === "string" ? body.reportType : "overview";
  const scope = validScope(body);
  const config = body.configuration && typeof body.configuration === "object" && !Array.isArray(body.configuration) ? body.configuration as Record<string, unknown> : null;
  if (!name || name.length > 120) throw new Error("Report name must be between 1 and 120 characters.");
  if (!allowedTypes.has(type)) throw new Error("Unsupported report type.");
  if (!scope || !config) throw new Error("Select a valid organization/community scope and report configuration.");
  const from = typeof config.from === "string" ? config.from : "";
  const to = typeof config.to === "string" ? config.to : "";
  const timezone = typeof config.timezone === "string" ? config.timezone : "UTC";
  const compare = config.compare === true;
  const dateFilter: AnalyticsDateFilter = { from, to, timezone, compare };
  const metrics = Array.isArray(config.metrics) ? config.metrics.filter((item): item is string => typeof item === "string").slice(0, 40) : [];
  return { body, name, type, scope, dateFilter, configuration: { from, to, timezone, compare, metrics } };
}

export async function GET() {
  try {
    const client = await createSupabaseServerClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in with an authorized development identity to view saved reports." }, { status: 401 });
    const { data, error } = await client.from("saved_reports").select("id,name,scope_level,organization_id,community_id,report_type,configuration,created_at,updated_at").eq("created_by", auth.user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ reports: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = parseBody(await request.json());
    const typeForAuth = parsed.scope.level === "platform" ? "platform" : parsed.type;
    await getAnalyticsResult(parsed.scope, typeForAuth, parsed.dateFilter);
    const client = await createSupabaseServerClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in with an authorized development identity to save a report." }, { status: 401 });
    const { data, error } = await client.from("saved_reports").insert({
      created_by: auth.user.id,
      scope_level: parsed.scope.level,
      organization_id: parsed.scope.organizationId ?? null,
      community_id: parsed.scope.communityId ?? null,
      name: parsed.name,
      report_type: typeForAuth,
      configuration: parsed.configuration,
    }).select("id,name,scope_level,organization_id,community_id,report_type,configuration,created_at,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ report: data }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
