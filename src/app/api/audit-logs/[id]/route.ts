import { NextRequest } from "next/server";
import { auditError, auditScopeFrom } from "@/lib/audit/http";
import { getAuditLog } from "@/services/audit-logs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = auditScopeFrom(request.nextUrl.searchParams);
    if (!scope) throw new Error("Choose a valid audit scope.");
    const { id } = await context.params;
    return Response.json(await getAuditLog(id, scope), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return auditError(error); }
}
