import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsResult, type AnalyticsDateFilter, type AnalyticsScope } from "@/services/analytics";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Analytics request failed.";
  const status = /authorized|access|sign in/i.test(message) ? 403 : /date|timezone|range|scope|unsupported/i.test(message) ? 400 : /environment|fetch|network|configured/i.test(message) ? 503 : 500;
  return NextResponse.json({ error: status === 500 ? "Analytics could not be loaded. Verify the database migration and try again." : message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const analyticsModule = params.get("module") ?? "overview";
    const level = params.get("level") ?? "organization";
    if (!["platform", "organization", "community"].includes(level)) return NextResponse.json({ error: "Unsupported analytics scope." }, { status: 400 });
    const now = new Date();
    const defaultTo = now.toLocaleDateString("en-CA");
    const defaultFromDate = new Date(now);
    defaultFromDate.setDate(defaultFromDate.getDate() - 29);
    const filter: AnalyticsDateFilter = {
      from: params.get("from") ?? defaultFromDate.toLocaleDateString("en-CA"),
      to: params.get("to") ?? defaultTo,
      timezone: params.get("timezone") ?? "UTC",
      compare: params.get("compare") === "true",
    };
    if (!dateOnly.test(filter.from) || !dateOnly.test(filter.to)) return NextResponse.json({ error: "Dates must use YYYY-MM-DD format." }, { status: 400 });
    const scope: AnalyticsScope = {
      level: level as AnalyticsScope["level"],
      ...(params.get("organizationId") ? { organizationId: params.get("organizationId")! } : {}),
      ...(params.get("communityId") ? { communityId: params.get("communityId")! } : {}),
    };
    const result = await getAnalyticsResult(scope, analyticsModule, filter);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return failure(error);
  }
}
