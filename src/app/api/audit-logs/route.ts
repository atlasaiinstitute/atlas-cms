import { NextRequest, NextResponse } from "next/server";
import { auditError, auditFiltersFrom, auditScopeFrom } from "@/lib/audit/http";
import { listAuditLogs } from "@/services/audit-logs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = auditScopeFrom(params);
    if (!scope) return NextResponse.json({ error: "Choose a valid authorized audit scope." }, { status: 400 });
    const filters = auditFiltersFrom(params);
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "25");
    return NextResponse.json(await listAuditLogs(scope, filters, page, pageSize), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return auditError(error); }
}
