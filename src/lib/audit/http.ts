import { NextResponse } from "next/server";
import type { AuditFilters, AuditScope } from "@/services/audit-logs";

export function auditScopeFrom(params: URLSearchParams): AuditScope | null {
  const level = params.get("level") ?? "organization";
  if (level === "platform") return { level: "platform" };
  const organizationId = params.get("organizationId") ?? "";
  if (level === "organization" && organizationId) return { level, organizationId };
  const communityId = params.get("communityId") ?? "";
  if (level === "community" && organizationId && communityId) return { level, organizationId, communityId };
  return null;
}
function isoDate(value: string | null, end = false) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Dates must use YYYY-MM-DD format.");
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("The date is invalid.");
  return parsed.toISOString();
}
export function auditFiltersFrom(params: URLSearchParams): AuditFilters {
  const outcome = params.get("outcome");
  const severity = params.get("severity");
  if (outcome && !["success", "failure", "denied"].includes(outcome)) throw new Error("Unsupported outcome filter.");
  if (severity && !["informational", "warning", "high_risk"].includes(severity)) throw new Error("Unsupported severity filter.");
  return {
    from: isoDate(params.get("from")), to: isoDate(params.get("to"), true),
    actorId: params.get("actorId") || undefined, module: params.get("module") || undefined,
    eventType: params.get("eventType") || undefined, action: params.get("action") || undefined,
    targetEntity: params.get("targetEntity") || undefined,
    outcome: outcome as AuditFilters["outcome"], severity: severity as AuditFilters["severity"],
    keyword: params.get("q") || undefined,
    securityOnly: params.get("view") === "security",
    administrativeOnly: params.get("view") === "administrative",
    ascending: params.get("sort") === "oldest",
  };
}
export function auditError(error: unknown) {
  const message = error instanceof Error ? error.message : "Audit log request failed.";
  const status = /sign in|authentication required/i.test(message) ? 401 : /not authorized|permission|required|access denied/i.test(message) ? 403 : /invalid|unsupported|valid|date|range|between|page|format|scope/i.test(message) ? 400 : /configured|network|fetch|migration|environment/i.test(message) ? 503 : 500;
  return NextResponse.json({ error: status === 500 ? "Audit logs could not be loaded. Verify the database migration and try again." : message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function safeJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
