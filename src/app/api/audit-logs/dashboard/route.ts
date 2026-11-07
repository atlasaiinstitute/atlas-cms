import { NextRequest } from "next/server";
import { auditError, auditFiltersFrom, auditScopeFrom } from "@/lib/audit/http";
import { getAuditDashboard } from "@/services/audit-logs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = auditScopeFrom(params);
    if (!scope) throw new Error("Choose a valid audit scope.");
    const filters = auditFiltersFrom(params);
    if (!filters.from || !filters.to) throw new Error("Dashboard start and end dates are required.");
    return Response.json(await getAuditDashboard(scope, filters.from, filters.to), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return auditError(error); }
}
