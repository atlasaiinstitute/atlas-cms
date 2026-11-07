import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { csvEscape } from "@/services/audit-csv";

export type AuditScope =
  | { level: "platform" }
  | { level: "organization"; organizationId: string }
  | { level: "community"; organizationId: string; communityId: string };
export type AuditFilters = {
  from?: string;
  to?: string;
  actorId?: string;
  module?: string;
  eventType?: string;
  action?: string;
  targetEntity?: string;
  outcome?: "success" | "failure" | "denied";
  severity?: "informational" | "warning" | "high_risk";
  keyword?: string;
  securityOnly?: boolean;
  administrativeOnly?: boolean;
  ascending?: boolean;
};
export type AuditLogRecord = {
  id: string;
  event_type: string;
  action: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  organization_id: string | null;
  community_id: string | null;
  target_record_type: string | null;
  target_record_id: string | null;
  outcome: string;
  severity: string;
  is_administrative: boolean;
  created_at: string;
  source_module: string;
  change_summary: string;
  request_id?: string | null;
  actor_role_context?: Record<string, unknown>;
  change_details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
export type AuditPage = { records: AuditLogRecord[]; page: number; pageSize: number; total: number; pages: number };
export type AuditRetentionPolicy = {
  id: string;
  scope_type: "platform" | "organization" | "community";
  organization_id: string | null;
  community_id: string | null;
  retention_days: number;
  archive_before_purge: boolean;
  enabled: boolean;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
  updated_at: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fieldPattern = /^[a-z][a-z0-9_.-]{0,79}$/i;
const allowedModules = new Set(["organizations", "communities", "members", "applications", "roles", "governance", "events", "cms", "resources", "announcements", "notifications", "messaging", "audit_logs", "platform", "security"]);
const sensitiveColumns = "request_id,actor_role_context,change_details,metadata";
const ordinaryColumns = "id,event_type,action,actor_user_id,actor_display_name,organization_id,community_id,target_record_type,target_record_id,outcome,severity,is_administrative,created_at,source_module,change_summary";
const maxDateRangeMs = 366 * 2 * 24 * 60 * 60 * 1000;

function validateScope(scope: AuditScope) {
  if (scope.level === "platform") return;
  if (!uuidPattern.test(scope.organizationId)) throw new Error("A valid organization scope is required.");
  if (scope.level === "community" && !uuidPattern.test(scope.communityId)) throw new Error("A valid community scope is required.");
}
function validateDateRange(filters: AuditFilters) {
  if (!filters.from && !filters.to) return;
  const from = filters.from ? Date.parse(filters.from) : Number.NaN;
  const to = filters.to ? Date.parse(filters.to) : Number.NaN;
  if (filters.from && !Number.isFinite(from)) throw new Error("The start date is invalid.");
  if (filters.to && !Number.isFinite(to)) throw new Error("The end date is invalid.");
  if (filters.from && filters.to && (to < from || to - from > maxDateRangeMs)) throw new Error("Select a valid date range of no more than two years.");
}
function cleanSearch(value: string) {
  return value.replace(/[^a-zA-Z0-9\s@:/.-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
function scopedQuery(client: SupabaseClient, scope: AuditScope, filters: AuditFilters, includeSensitive: boolean, limit: number, offset: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST select fields are assembled from fixed server-owned column lists.
  let query: any = client.from("audit_logs").select(includeSensitive ? `${ordinaryColumns},${sensitiveColumns}` : ordinaryColumns, { count: "exact" });
  if (scope.level === "platform") query = query.is("organization_id", null);
  else {
    query = query.eq("organization_id", scope.organizationId);
    if (scope.level === "community") query = query.eq("community_id", scope.communityId);
  }
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.actorId) {
    if (!uuidPattern.test(filters.actorId)) throw new Error("The actor filter must be a valid identifier.");
    query = query.eq("actor_user_id", filters.actorId);
  }
  if (filters.module) {
    if (!allowedModules.has(filters.module)) throw new Error("Unsupported audit module filter.");
    query = query.eq("source_module", filters.module);
  }
  if (filters.eventType) {
    if (!fieldPattern.test(filters.eventType)) throw new Error("The event type filter is invalid.");
    query = query.eq("event_type", filters.eventType);
  }
  if (filters.action) {
    if (!fieldPattern.test(filters.action)) throw new Error("The action filter is invalid.");
    query = query.eq("action", filters.action);
  }
  if (filters.targetEntity) {
    if (!fieldPattern.test(filters.targetEntity)) throw new Error("The target entity filter is invalid.");
    query = query.eq("target_record_type", filters.targetEntity);
  }
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.securityOnly) query = query.like("event_type", "security.%");
  if (filters.administrativeOnly) query = query.eq("is_administrative", true);
  const keyword = filters.keyword ? cleanSearch(filters.keyword) : "";
  if (keyword) query = query.or(`event_type.ilike.%${keyword}%,action.ilike.%${keyword}%,change_summary.ilike.%${keyword}%,target_record_type.ilike.%${keyword}%`);
  return query.order("created_at", { ascending: filters.ascending ?? false }).order("id", { ascending: filters.ascending ?? false }).range(offset, offset + limit - 1);
}

async function requireUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Sign in with an authorized identity to access audit logs.");
  return data.user;
}
export async function requireAuditPermission(client: SupabaseClient, scope: AuditScope, permission: string) {
  validateScope(scope);
  const user = await requireUser(client);
  const { data, error } = await client.rpc("can_view_audit_logs", {
    target_org: scope.level === "platform" ? null : scope.organizationId,
    target_community: scope.level === "community" ? scope.communityId : null,
    required_permission: permission,
  });
  if (error) throw new Error(`Audit authorization failed: ${error.message}`);
  if (data !== true) {
    await client.rpc("record_audit_access_denied", {
      p_organization_id: scope.level === "platform" ? null : scope.organizationId,
      p_community_id: scope.level === "community" ? scope.communityId : null,
      p_required_permission: permission,
    });
    throw new Error("Audit log access is not authorized for the selected scope.");
  }
  return user;
}

export async function listAuditLogs(scope: AuditScope, filters: AuditFilters, page = 1, pageSize = 25): Promise<AuditPage> {
  validateDateRange(filters);
  if (!Number.isInteger(page) || page < 1 || page > 2000) throw new Error("The requested page is outside the supported range.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error("Page size must be between 1 and 100.");
  const client = await createSupabaseServerClient();
  const permission = filters.securityOnly ? "audit_logs.view_security" : "audit_logs.view";
  const user = await requireAuditPermission(client, scope, permission);
  const { data: canViewSensitive, error: sensitiveError } = await client.rpc("can_view_audit_logs", {
    target_org: scope.level === "platform" ? null : scope.organizationId,
    target_community: scope.level === "community" ? scope.communityId : null,
    required_permission: "audit_logs.view_sensitive",
  });
  if (sensitiveError) throw new Error("Audit detail authorization could not be verified.");
  const { data, error, count } = await scopedQuery(client, scope, filters, canViewSensitive === true, pageSize, (page - 1) * pageSize);
  if (error) throw new Error(`Audit logs could not be queried for actor ${user.id}: ${error.message}`);
  const total = count ?? 0;
  return { records: (data ?? []) as AuditLogRecord[], page, pageSize, total, pages: Math.ceil(total / pageSize) };
}

export async function getAuditLog(id: string, scope: AuditScope): Promise<AuditLogRecord> {
  if (!uuidPattern.test(id)) throw new Error("A valid audit record identifier is required.");
  const client = await createSupabaseServerClient();
  await requireAuditPermission(client, scope, "audit_logs.view");
  const { data: sensitive, error: sensitiveError } = await client.rpc("can_view_audit_logs", {
    target_org: scope.level === "platform" ? null : scope.organizationId,
    target_community: scope.level === "community" ? scope.communityId : null,
    required_permission: "audit_logs.view_sensitive",
  });
  if (sensitiveError) throw new Error("Audit detail authorization could not be verified.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- The selected column list depends on a server-verified permission.
  let query: any = client.from("audit_logs").select(sensitive === true ? `${ordinaryColumns},${sensitiveColumns}` : ordinaryColumns).eq("id", id);
  if (scope.level === "platform") query = query.is("organization_id", null);
  else {
    query = query.eq("organization_id", scope.organizationId);
    if (scope.level === "community") query = query.eq("community_id", scope.communityId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Audit record could not be loaded.");
  if (!data) throw new Error("Audit record was not found in the authorized scope.");
  return data as AuditLogRecord;
}

export async function getAuditDashboard(scope: AuditScope, from: string, to: string) {
  const filters = { from, to };
  validateDateRange(filters);
  if (!from || !to) throw new Error("Dashboard start and end dates are required.");
  const client = await createSupabaseServerClient();
  await requireAuditPermission(client, scope, "audit_logs.view");
  const { data, error } = await client.rpc("get_audit_dashboard", {
    p_organization_id: scope.level === "platform" ? null : scope.organizationId,
    p_community_id: scope.level === "community" ? scope.communityId : null,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`Audit dashboard could not be loaded: ${error.message}`);
  return data ?? {};
}

export async function getAuditRetentionPolicies(scope: AuditScope): Promise<AuditRetentionPolicy[]> {
  const client = await createSupabaseServerClient();
  await requireAuditPermission(client, scope, "audit_logs.retention.manage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- The scope branch selects a fixed scope column.
  let query: any = client.from("audit_retention_policies").select("id,scope_type,organization_id,community_id,retention_days,archive_before_purge,enabled,notes,changed_by,created_at,updated_at");
  query = scope.level === "platform" ? query.eq("scope_type", "platform") : query.eq("organization_id", scope.organizationId);
  if (scope.level === "community") query = query.eq("community_id", scope.communityId);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(`Retention policy could not be loaded: ${error.message}`);
  return (data ?? []) as AuditRetentionPolicy[];
}

export async function saveAuditRetentionPolicy(input: { scope: AuditScope; retentionDays: number; archiveBeforePurge: boolean; enabled: boolean; notes?: string }) {
  if (!Number.isInteger(input.retentionDays) || input.retentionDays < 365 || input.retentionDays > 3650) throw new Error("Retention must be between 365 and 3650 days.");
  const client = await createSupabaseServerClient();
  await requireAuditPermission(client, input.scope, "audit_logs.retention.manage");
  const { data, error } = await client.rpc("set_audit_retention_policy", {
    p_scope_type: input.scope.level,
    p_organization_id: input.scope.level === "platform" ? null : input.scope.organizationId,
    p_community_id: input.scope.level === "community" ? input.scope.communityId : null,
    p_retention_days: input.retentionDays,
    p_archive_before_purge: input.archiveBeforePurge,
    p_enabled: input.enabled,
    p_notes: input.notes?.slice(0, 500) ?? null,
  });
  if (error) throw new Error(`Retention policy update failed: ${error.message}`);
  return data as AuditRetentionPolicy;
}

export async function exportAuditLogs(scope: AuditScope, filters: AuditFilters, format: "csv" | "json") {
  validateDateRange(filters);
  const client = await createSupabaseServerClient();
  await requireAuditPermission(client, scope, "audit_logs.export");
  if (filters.securityOnly) await requireAuditPermission(client, scope, "audit_logs.view_security");
  const { data: canViewSensitive, error: sensitiveError } = await client.rpc("can_view_audit_logs", {
    target_org: scope.level === "platform" ? null : scope.organizationId,
    target_community: scope.level === "community" ? scope.communityId : null,
    required_permission: "audit_logs.view_sensitive",
  });
  if (sensitiveError) throw new Error("Audit export detail authorization could not be verified.");
  const { data, error, count } = await scopedQuery(client, scope, filters, canViewSensitive === true, 5000, 0);
  if (error) throw new Error(`Audit export could not be prepared: ${error.message}`);
  const records = (data ?? []) as AuditLogRecord[];
  const report = {
    generatedAt: new Date().toISOString(),
    scope: { level: scope.level, organizationId: scope.level === "platform" ? null : scope.organizationId, communityId: scope.level === "community" ? scope.communityId : null },
    filters,
    recordCount: count ?? records.length,
    truncated: (count ?? 0) > records.length,
    records,
  };
  const { error: logError } = await client.rpc("record_audit_export", {
    p_organization_id: scope.level === "platform" ? null : scope.organizationId,
    p_community_id: scope.level === "community" ? scope.communityId : null,
    p_export_format: format,
    p_record_count: records.length,
    p_filters: { ...filters, scope_level: scope.level, generated_at: report.generatedAt, returned_record_count: records.length, matched_record_count: count ?? records.length },
  });
  if (logError) throw new Error(`The export could not be audited, so no file was created: ${logError.message}`);
  return report;
}

export function auditReportToCsv(report: Awaited<ReturnType<typeof exportAuditLogs>>) {
  const columns = ["id","created_at","event_type","action","source_module","outcome","severity","is_administrative","actor_user_id","actor_display_name","organization_id","community_id","target_record_type","target_record_id","change_summary","request_id","actor_role_context","change_details","metadata"] as const;
  const rows = [columns.join(","), ...report.records.map((record) => columns.map((key) => csvEscape(record[key])).join(","))];
  const header = [`Generated at: ${report.generatedAt}`, `Scope: ${report.scope.level}`, `Organization ID: ${report.scope.organizationId ?? ""}`, `Community ID: ${report.scope.communityId ?? ""}`, `Matched records: ${report.recordCount}`, `Returned records: ${report.records.length}`, `Filters: ${JSON.stringify(report.filters)}`, ""];
  return `${header.map(csvEscape).join("\n")}\n${rows.join("\n")}`;
}
