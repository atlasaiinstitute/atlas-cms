import { NextRequest, NextResponse } from "next/server";
import { auditError, auditScopeFrom, safeJsonObject } from "@/lib/audit/http";
import { getAuditRetentionPolicies, saveAuditRetentionPolicy, type AuditScope } from "@/services/audit-logs";

function scopeFromBody(body: Record<string, unknown>): AuditScope | null {
  if (body.level === "platform") return { level: "platform" };
  if (body.level === "organization" && typeof body.organizationId === "string") return { level: "organization", organizationId: body.organizationId };
  if (body.level === "community" && typeof body.organizationId === "string" && typeof body.communityId === "string") return { level: "community", organizationId: body.organizationId, communityId: body.communityId };
  return null;
}
export async function GET(request: NextRequest) {
  try {
    const scope = auditScopeFrom(request.nextUrl.searchParams);
    if (!scope) throw new Error("Choose a valid audit scope.");
    return NextResponse.json({ policies: await getAuditRetentionPolicies(scope) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return auditError(error); }
}
export async function PUT(request: NextRequest) {
  try {
    const body = safeJsonObject(await request.json());
    if (!body) throw new Error("Retention settings are required.");
    const scope = scopeFromBody(body);
    if (!scope) throw new Error("Choose a valid audit scope.");
    const policy = await saveAuditRetentionPolicy({
      scope,
      retentionDays: Number(body.retentionDays),
      archiveBeforePurge: body.archiveBeforePurge === true,
      enabled: body.enabled !== false,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return NextResponse.json({ policy }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return auditError(error); }
}
