import { NextRequest, NextResponse } from "next/server";
import { auditError, auditFiltersFrom, auditScopeFrom } from "@/lib/audit/http";
import { auditReportToCsv, exportAuditLogs } from "@/services/audit-logs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = auditScopeFrom(params);
    if (!scope) throw new Error("Choose a valid audit scope.");
    const format = params.get("format") ?? "csv";
    if (format !== "csv" && format !== "json") throw new Error("Export format must be CSV or JSON.");
    const report = await exportAuditLogs(scope, auditFiltersFrom(params), format);
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") return new NextResponse(auditReportToCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="atlas-audit-${date}.csv"`, "Cache-Control": "private, no-store" } });
    return new NextResponse(JSON.stringify(report, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="atlas-audit-${date}.json"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return auditError(error); }
}
