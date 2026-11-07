import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnalyticsResult, type AnalyticsDateFilter, type AnalyticsScope } from "@/services/analytics";
import { csvCell } from "@/services/analytics-calculations";

type Context = { params: Promise<{ id: string }> };
type ReportRow = { id: string; name: string; scope_level: "platform" | "organization" | "community"; organization_id: string | null; community_id: string | null; report_type: string; configuration: Record<string, unknown>; created_by: string };
function safeFilename(name: string) {
  const value = name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return value || "analytics-report";
}
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Sign in with an authorized development identity to export reports." }, { status: 401 });
    const { data, error } = await client.from("saved_reports").select("*").eq("id", id).eq("created_by", auth.user.id).single();
    if (error || !data) return NextResponse.json({ error: "Saved report not found or access denied." }, { status: 403 });
    const report = data as unknown as ReportRow;
    const scope: AnalyticsScope = { level: report.scope_level, ...(report.organization_id ? { organizationId: report.organization_id } : {}), ...(report.community_id ? { communityId: report.community_id } : {}) };
    const cfg = report.configuration ?? {};
    const filter: AnalyticsDateFilter = { from: String(cfg.from ?? ""), to: String(cfg.to ?? ""), timezone: String(cfg.timezone ?? "UTC"), compare: cfg.compare === true };
    const result = await getAnalyticsResult(scope, report.report_type, filter);
    const chosen = Array.isArray(cfg.metrics) ? cfg.metrics.filter((id): id is string => typeof id === "string") : [];
    const selected = chosen.length ? result.metrics.filter((item) => chosen.includes(item.id)) : result.metrics;
    const rows: Array<Array<string | number | null>> = [
      ["Report", report.name],
      ["Generated at (UTC)", new Date(result.generatedAt).toISOString()],
      ["Scope", report.scope_level],
      ["Organization ID", report.organization_id],
      ["Community ID", report.community_id],
      ["Date range", `${result.period.from} to ${result.period.to} (${result.period.timezone})`],
      [],
      ["Metric", "Value", "Definition", "Data source"],
      ...selected.map((item) => [item.label, item.value, item.definition, item.source]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safeFilename(report.name)}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report export failed.";
    const status = /authorized|access|sign in/i.test(message) ? 403 : /date|timezone|range|scope|unsupported/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "Report export failed. Verify database setup and try again." : message }, { status });
  }
}
