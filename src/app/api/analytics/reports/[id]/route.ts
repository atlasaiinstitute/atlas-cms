import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnalyticsResult, type AnalyticsDateFilter, type AnalyticsScope } from "@/services/analytics";

type Context = { params: Promise<{ id: string }> };
type SavedReport = { id: string; created_by: string; name: string; scope_level: "platform" | "organization" | "community"; organization_id: string | null; community_id: string | null; report_type: string; configuration: Record<string, unknown>; created_at: string; updated_at: string };
function reportScope(report: SavedReport): AnalyticsScope {
  return { level: report.scope_level, ...(report.organization_id ? { organizationId: report.organization_id } : {}), ...(report.community_id ? { communityId: report.community_id } : {}) };
}
function dateFilter(report: SavedReport): AnalyticsDateFilter {
  const config = report.configuration ?? {};
  return { from: String(config.from ?? ""), to: String(config.to ?? ""), timezone: String(config.timezone ?? "UTC"), compare: config.compare === true };
}
async function getOwnedReport(id: string) {
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Sign in with an authorized development identity to access reports.");
  const { data, error } = await client.from("saved_reports").select("*").eq("id", id).eq("created_by", auth.user.id).single();
  if (error || !data) throw new Error("Saved report not found or access denied.");
  return { client, report: data as unknown as SavedReport };
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Report operation failed.";
  const status = /authorized|access|sign in|not found/i.test(message) ? 403 : /date|timezone|range|scope|unsupported|name/i.test(message) ? 400 : /configured|network|fetch/i.test(message) ? 503 : 500;
  return NextResponse.json({ error: status === 500 ? "Report operation failed. Verify database setup and try again." : message }, { status });
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const { report } = await getOwnedReport(id);
    const data = await getAnalyticsResult(reportScope(report), report.report_type, dateFilter(report));
    const selected = Array.isArray(report.configuration.metrics) ? report.configuration.metrics : [];
    const preview = selected.length ? data.metrics.filter((item) => selected.includes(item.id)) : data.metrics;
    return NextResponse.json({ report, preview, generatedAt: data.generatedAt, period: data.period }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const { client, report } = await getOwnedReport(id);
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : report.name;
    const configuration = body.configuration && typeof body.configuration === "object" && !Array.isArray(body.configuration) ? body.configuration as Record<string, unknown> : report.configuration;
    if (!name || name.length > 120) throw new Error("Report name must be between 1 and 120 characters.");
    const updated = { ...report, name, configuration };
    await getAnalyticsResult(reportScope(updated), report.report_type, dateFilter(updated));
    const { data, error } = await client.from("saved_reports").update({ name, configuration }).eq("id", report.id).eq("created_by", report.created_by).select("id,name,scope_level,organization_id,community_id,report_type,configuration,created_at,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const { client, report } = await getOwnedReport(id);
    const { error } = await client.from("saved_reports").delete().eq("id", report.id).eq("created_by", report.created_by);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
