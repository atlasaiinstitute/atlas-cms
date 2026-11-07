import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { averageElapsedHours, calculateChange, calculateRate, countDistinct, createDateBuckets } from "@/services/analytics-calculations";

export type AnalyticsScope = { level: "platform" | "organization" | "community"; organizationId?: string; communityId?: string };
export type AnalyticsDateFilter = { from: string; to: string; timezone: string; compare: boolean };
export type AnalyticsMetric = { id: string; label: string; value: number | null; definition: string; source: string; change?: number | null };
export type AnalyticsResult = {
  scope: AnalyticsScope;
  period: { from: string; to: string; timezone: string; comparisonFrom?: string; comparisonTo?: string };
  generatedAt: string;
  metrics: AnalyticsMetric[];
  series: Array<{ label: string; value: number }>;
  seriesLabel: string;
  seriesDefinition: string;
  breakdowns: Record<string, Array<{ label: string; value: number }>>;
  notes: string[];
};

const allowedModules = new Set(["overview", "platform", "organizations", "communities", "members", "applications", "events", "governance", "content", "resources", "engagement", "messaging"]);
const maxRangeMs = 366 * 2 * 24 * 60 * 60 * 1000;

function assertDateFilter(filter: AnalyticsDateFilter) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filter.from) || !/^\d{4}-\d{2}-\d{2}$/.test(filter.to)) throw new Error("Dates must use YYYY-MM-DD format.");
  const fromCheck = new Date(`${filter.from}T00:00:00Z`);
  const toCheck = new Date(`${filter.to}T00:00:00Z`);
  if (!Number.isFinite(fromCheck.getTime()) || !Number.isFinite(toCheck.getTime()) || fromCheck.toISOString().slice(0, 10) !== filter.from || toCheck.toISOString().slice(0, 10) !== filter.to || toCheck < fromCheck) throw new Error("The date range is invalid.");
  if (toCheck.getTime() - fromCheck.getTime() > maxRangeMs) throw new Error("Date ranges are limited to two years.");
  try { new Intl.DateTimeFormat("en", { timeZone: filter.timezone }).format(); } catch { throw new Error("The timezone is invalid."); }
}

function zonedStart(date: string, timezone: string): Date {
  const guess = new Date(`${date}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const displayedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return new Date(guess.getTime() - (displayedAsUtc - guess.getTime()));
}

function addCalendarDays(date: string, n: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + n);
  return value.toISOString().slice(0, 10);
}

function previousRange(filter: AnalyticsDateFilter) {
  const days = Math.round((Date.parse(`${filter.to}T00:00:00Z`) - Date.parse(`${filter.from}T00:00:00Z`)) / 86400000) + 1;
  return { from: addCalendarDays(filter.from, -days), to: addCalendarDays(filter.to, -days) };
}

function dateWindow(filter: AnalyticsDateFilter, from = filter.from, to = filter.to) {
  return { start: zonedStart(from, filter.timezone).toISOString(), end: zonedStart(addCalendarDays(to, 1), filter.timezone).toISOString() };
}

async function unwrap<T>(promise: PromiseLike<unknown>): Promise<T> {
  const { data, error } = await promise as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
  return data as T;
}

async function requireScope(client: SupabaseClient, scope: AnalyticsScope, module: string) {
  if (!allowedModules.has(module)) throw new Error("Unsupported analytics module.");
  if (scope.level === "platform") {
    if (module !== "platform" && module !== "overview") throw new Error("Platform reports are limited to privacy-safe overview metrics.");
    const allowed = await unwrap<boolean>(client.rpc("can_view_analytics", { target_org: null, target_community: null, target_module: "platform" }));
    if (!allowed) throw new Error("Platform analytics access is not authorized.");
    return;
  }
  if (!scope.organizationId) throw new Error("Select an organization scope.");
  if (scope.level === "community" && !scope.communityId) throw new Error("Select a community scope.");
  const allowed = await unwrap<boolean>(client.rpc("can_view_analytics", {
    target_org: scope.organizationId,
    target_community: scope.level === "community" ? scope.communityId ?? null : null,
    target_module: module,
  }));
  if (!allowed) throw new Error("Analytics access is not authorized for this tenant and module.");
}

type CountOptions = { status?: string | string[]; statusField?: string; dateField?: string; from?: string; to?: string; community?: boolean; filters?: Record<string, string | string[]>; isNullFields?: string[]; notNullFields?: string[] };
async function countRows(client: SupabaseClient, table: string, scope: AnalyticsScope, options: CountOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client.from(table).select("id", { count: "exact", head: true });
  if (scope.organizationId) query = query.eq(table === "organizations" ? "id" : "organization_id", scope.organizationId);
  if (scope.level === "community" && table !== "organizations" && options.community !== false && scope.communityId) query = query.eq("community_id", scope.communityId);
  if (options.status) query = Array.isArray(options.status) ? query.in(options.statusField ?? "status", options.status) : query.eq(options.statusField ?? "status", options.status);
  if (options.filters) for (const [field, value] of Object.entries(options.filters)) query = Array.isArray(value) ? query.in(field, value) : query.eq(field, value);
  if (options.isNullFields) for (const field of options.isNullFields) query = query.is(field, null);
  if (options.notNullFields) for (const field of options.notNullFields) query = query.not(field, "is", null);
  if (options.dateField && options.from && options.to) query = query.gte(options.dateField, options.from).lt(options.dateField, options.to);
  const { count, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function idsFor(client: SupabaseClient, table: string, scope: AnalyticsScope, dateField?: string, from?: string, to?: string, statuses?: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client.from(table).select("id");
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (scope.level === "community" && scope.communityId) query = query.eq("community_id", scope.communityId);
  if (dateField && from && to) query = query.gte(dateField, from).lt(dateField, to);
  if (statuses) query = query.in("status", statuses);
  const rows = await unwrap<Array<{ id: string }>>(query.range(0, 9999));
  return rows.map((row) => row.id);
}

async function countChildRows(client: SupabaseClient, table: string, key: string, ids: string[], dateField: string | undefined, from: string, to: string, statusField?: string, statuses?: string[]) {
  if (!ids.length) return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client.from(table).select("id", { count: "exact", head: true }).in(key, ids);
  if (dateField) query = query.gte(dateField, from).lt(dateField, to);
  if (statuses && statusField) query = query.in(statusField, statuses);
  const { count, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function overdueActionItems(client: SupabaseClient, meetingIds: string[], today: string) {
  if (!meetingIds.length) return 0;
  const { count, error } = await client.from("meeting_action_items").select("id", { count: "exact", head: true }).in("meeting_id", meetingIds).in("status", ["open", "in_progress"]).lt("due_date", today);
  if (error) throw new Error(`meeting_action_items: ${error.message}`);
  return count ?? 0;
}

async function meetingIdsFor(client: SupabaseClient, scope: AnalyticsScope, from?: string, to?: string) {
  const committeeIds = await idsFor(client, "committees", scope);
  if (!committeeIds.length) return [] as string[];
  let query = client.from("committee_meetings").select("id").in("committee_id", committeeIds);
  if (from && to) query = query.gte("scheduled_at", from).lt("scheduled_at", to);
  const rows = await unwrap<Array<{ id: string }>>(query.range(0, 9999));
  return rows.map((row) => row.id);
}

function metric(id: string, label: string, value: number | null, definition: string, source: string): AnalyticsMetric {
  return { id, label, value, definition, source };
}

async function uniqueMembershipProfiles(client: SupabaseClient, scope: AnalyticsScope) {
  const table = scope.level === "community" ? "community_memberships" : "organization_memberships";
  const key = "user_id";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client.from(table).select(key);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (scope.level === "community" && scope.communityId) query = query.eq("community_id", scope.communityId);
  const rows = await unwrap<Array<Record<string, string>>>(query.range(0, 9999));
  return countDistinct(rows.map((row) => row[key]));
}

async function membershipSeries(client: SupabaseClient, scope: AnalyticsScope, range: { start: string; end: string }, filter: AnalyticsDateFilter) {
  const fromMs = Date.parse(range.start);
  const toMs = Date.parse(range.end);
  const days = Math.max(1, Math.ceil((toMs - fromMs) / 86400000));
  const stepDays = days <= 35 ? 1 : days <= 120 ? 7 : 30;
  const buckets = createDateBuckets(filter.from, filter.to, stepDays);
  const table = scope.level === "community" ? "community_memberships" : "organization_memberships";
  const values = await Promise.all(buckets.slice(-24).map(async (bucket) => {
    const window = dateWindow(filter, bucket.from, bucket.to);
    return { label: stepDays === 1 ? bucket.from.slice(5) : bucket.from.slice(0, 7), value: await countRows(client, table, scope, { dateField: "created_at", from: window.start, to: window.end }) };
  }));
  return values;
}

async function tableSeries(client: SupabaseClient, table: string, scope: AnalyticsScope, filter: AnalyticsDateFilter, dateField: string, options: CountOptions = {}) {
  const range = dateWindow(filter);
  const days = Math.max(1, Math.ceil((Date.parse(range.end) - Date.parse(range.start)) / 86400000));
  const stepDays = days <= 35 ? 1 : days <= 120 ? 7 : 30;
  const buckets = createDateBuckets(filter.from, filter.to, stepDays);
  return Promise.all(buckets.slice(-24).map(async (bucket) => {
    const window = dateWindow(filter, bucket.from, bucket.to);
    return { label: stepDays === 1 ? bucket.from.slice(5) : bucket.from.slice(0, 7), value: await countRows(client, table, scope, { ...options, dateField, from: window.start, to: window.end }) };
  }));
}

async function platformResult(client: SupabaseClient, scope: AnalyticsScope, filter: AnalyticsDateFilter): Promise<AnalyticsResult> {
  const range = dateWindow(filter);
  const data = await unwrap<Record<string, number | string>>(client.rpc("get_platform_analytics", { p_from: range.start, p_to: range.end }));
  const previous = filter.compare ? previousRange(filter) : undefined;
  const priorWindow = previous ? dateWindow(filter, previous.from, previous.to) : null;
  const priorData = priorWindow ? await unwrap<Record<string, number | string>>(client.rpc("get_platform_analytics", { p_from: priorWindow.start, p_to: priorWindow.end })) : null;
  const metricMap: Array<[string, string, string, string]> = [
    ["organizations_total", "Organizations", "All registered organization records, regardless of current status.", "organizations"],
    ["organizations_active", "Active organizations", "Organizations whose current status is active.", "organizations.status"],
    ["communities_total", "Communities", "All community records across the platform.", "communities"],
    ["communities_active", "Active communities", "Communities whose current status is active.", "communities.status"],
    ["profiles_unique", "Unique member profiles", "Distinct user IDs with at least one organization membership; profiles are not the same as memberships.", "organization_memberships.user_id (distinct)"],
    ["organization_memberships_active", "Active organization memberships", "Organization membership records with active status.", "organization_memberships.membership_status"],
    ["community_memberships_active", "Active community memberships", "Community membership records with active status.", "community_memberships.membership_status"],
    ["applications_submitted_period", "Applications submitted", "Applications submitted inside the selected date range.", "membership_applications.submitted_at"],
    ["applications_pending", "Pending applications", "Applications currently submitted, under review, or awaiting information.", "membership_applications.status"],
    ["applications_approved_period", "Applications approved", "Applications reviewed and approved inside the selected date range.", "membership_applications.reviewed_at"],
    ["events_published_period", "Published events", "Published or completed event records created inside the selected date range.", "events.status, events.created_at"],
    ["events_upcoming", "Upcoming events", "Published events starting at or after the current time.", "events.status, events.starts_at"],
    ["content_published_period", "Published content", "Content published inside the selected date range.", "content_items.published_at"],
    ["resources_published_period", "Published resources", "Resources published inside the selected date range.", "resources.published_at"],
    ["announcements_published_period", "Published announcements", "Announcements published inside the selected date range.", "announcements.published_at"],
  ];
  const periodIds = new Set(["applications_submitted_period", "applications_approved_period", "events_published_period", "content_published_period", "resources_published_period", "announcements_published_period"]);
  const metrics = metricMap.map(([id, label, definition, source]) => {
    const item = metric(id, label, Number(data[id] ?? 0), definition, source);
    if (periodIds.has(id) && priorData) item.change = calculateChange(Number(data[id] ?? 0), Number(priorData[id] ?? 0));
    return item;
  });
  return { scope, period: { from: filter.from, to: filter.to, timezone: filter.timezone, ...(previous ? { comparisonFrom: previous.from, comparisonTo: previous.to } : {}) }, generatedAt: String(data.generated_at ?? new Date().toISOString()), metrics, series: [], seriesLabel: "Platform trends", seriesDefinition: "Platform time-series charts are not exposed by the aggregate RPC; only the listed aggregate metrics are returned.", breakdowns: {}, notes: ["Platform results are aggregate-only. Governance and private messaging metrics are excluded from this view."] };
}

export async function getAnalyticsResult(scope: AnalyticsScope, module: string, filter: AnalyticsDateFilter): Promise<AnalyticsResult> {
  assertDateFilter(filter);
  const client = await createSupabaseServerClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in with an authorized development identity to view analytics.");
  await requireScope(client, scope, module);
  if (scope.level === "platform") return platformResult(client, scope, filter);

  const range = dateWindow(filter);
  const metrics: AnalyticsMetric[] = [];
  const breakdowns: AnalyticsResult["breakdowns"] = {};
  const notes: string[] = [];
  const orgId = scope.organizationId!;
  const communityMode = scope.level === "community";

  const addCount = async (id: string, label: string, table: string, definition: string, source: string, options: CountOptions = {}) => {
    const value = await countRows(client, table, scope, options);
    metrics.push(metric(id, label, value, definition, source));
    return value;
  };
  const inRange = (dateField: string) => ({ dateField, from: range.start, to: range.end });
  const statusCount = async (table: string, status: string, dateField?: string) => countRows(client, table, scope, { status, ...(dateField ? inRange(dateField) : {}) });

  if (module === "overview" || module === "organizations" || module === "communities") {
    if (module === "organizations" && !communityMode) {
      await addCount("organizations_total", "Organizations", "organizations", "Organization records visible in this tenant scope.", "organizations");
      await addCount("organizations_active", "Active organizations", "organizations", "Organizations whose current lifecycle status is active.", "organizations.status", { status: "active" });
    }
    const communityQuery = async (status?: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = client.from("communities").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
      if (status) q = q.eq("status", status);
      const { count, error } = await q;
      if (error) throw new Error(`communities: ${error.message}`);
      return count ?? 0;
    };
    if (!communityMode) {
      metrics.push(metric("communities_total", "Communities", await communityQuery(), "Community records in the selected organization; not filtered by date.", "communities.organization_id"));
      metrics.push(metric("communities_active", "Active communities", await communityQuery("active"), "Communities whose current status is active.", "communities.status"));
    }
    if (!communityMode) {
      await addCount("organization_memberships", "Organization memberships", "organization_memberships", "Membership rows, not unique people.", "organization_memberships");
      await addCount("organization_memberships_active", "Active organization memberships", "organization_memberships", "Current active organization membership rows.", "organization_memberships.membership_status", { status: "active", statusField: "membership_status" });
    }
    await addCount("community_memberships", "Community memberships", "community_memberships", "Membership rows, not unique people.", "community_memberships");
    await addCount("community_memberships_active", "Active community memberships", "community_memberships", "Current active community membership rows.", "community_memberships.membership_status", { status: "active", statusField: "membership_status" });
    await addCount("applications_pending", "Pending applications", "membership_applications", "Submitted, under review, or information-requested applications submitted within the date range.", "membership_applications.status/submitted_at", { status: ["submitted", "under_review", "information_requested"], ...inRange("submitted_at") });
    await addCount("applications_approved", "Approved applications", "membership_applications", "Applications reviewed and approved in the selected date range.", "membership_applications.status/reviewed_at", { status: "approved", ...inRange("reviewed_at") });
    if (!communityMode) await addCount("committees_active", "Active committees", "committees", "Currently active committees within this authorized scope.", "committees.status", { status: "active" });
    await addCount("events_published", "Published events", "events", "Events in published, registration-open, registration-closed, ongoing, or completed state, whose starts fall in the selected range.", "events.status/starts_at", { status: ["published", "registration_open", "registration_closed", "ongoing", "completed"], ...inRange("starts_at") });
    await addCount("events_upcoming", "Upcoming events", "events", "Published or registration-open events starting in the selected range and not yet started.", "events.status/starts_at", { status: ["published", "registration_open", "registration_closed"], ...inRange("starts_at") });
    await addCount("content_published", "Published content", "content_items", "Content records currently published and published in the selected date range.", "content_items.status/published_at", { status: "published", ...inRange("published_at") });
    await addCount("resources_published", "Published resources", "resources", "Resource records currently published and published in the selected date range.", "resources.status/published_at", { status: "published", ...inRange("published_at") });
    await addCount("announcements_published", "Published announcements", "announcements", "Announcements published in the selected date range.", "announcements.status/published_at", { status: "published", ...inRange("published_at") });
  }

  if (module === "overview" || module === "members") {
    const unique = await uniqueMembershipProfiles(client, scope);
    metrics.push(metric("profiles_unique", "Unique member profiles", unique, "Distinct user IDs with at least one membership in the authorized scope; independent of the date filter and not a count of membership rows.", communityMode ? "community_memberships.user_id (distinct)" : "organization_memberships.user_id (distinct)"));
    const membershipTable = communityMode ? "community_memberships" : "organization_memberships";
    const states = ["active", "pending", "suspended", "rejected", "left", "archived", "invited"];
    const values = await Promise.all(states.map(async (status) => ({ label: status, value: await countRows(client, membershipTable, scope, { status, statusField: "membership_status" }) })));
    breakdowns.memberships = values.filter((entry) => entry.value > 0);
    metrics.push(metric("memberships_active", "Active memberships", values.find((entry) => entry.label === "active")?.value ?? 0, "Current active organization or community membership rows in the authorized scope; independent of date filter.", `${membershipTable}.membership_status`));
    const series = await membershipSeries(client, scope, range, filter);
    const acquisitionTotal = series.reduce((sum, item) => sum + item.value, 0);
    metrics.push(metric("membership_new_period", "New memberships", acquisitionTotal, "Membership rows created in the selected date range; the same person may create separate organization/community membership rows.", `${membershipTable}.created_at`));
    const result: AnalyticsResult = { scope, period: { from: filter.from, to: filter.to, timezone: filter.timezone }, generatedAt: new Date().toISOString(), metrics, series, seriesLabel: "New membership records", seriesDefinition: "Membership rows created in each timezone-aware bucket; profiles with multiple memberships are counted once per membership row.", breakdowns, notes };
    if (filter.compare) {
      const previous = previousRange(filter);
      const previousWindow = dateWindow(filter, previous.from, previous.to);
      const previousCount = await countRows(client, membershipTable, scope, { dateField: "created_at", from: previousWindow.start, to: previousWindow.end });
      const acquisition = metrics.find((item) => item.id === "membership_new_period");
      if (acquisition) acquisition.change = calculateChange(acquisitionTotal, previousCount);
      result.period.comparisonFrom = previous.from;
      result.period.comparisonTo = previous.to;
    }
    if (module === "members") return result;
  }

  if (module === "overview" || module === "applications") {
    const statuses = ["draft", "submitted", "under_review", "information_requested", "approved", "rejected", "withdrawn", "archived"];
    const applicationCounts = await Promise.all(statuses.map(async (status) => ({ label: status.replaceAll("_", " "), value: await statusCount("membership_applications", status, "submitted_at") })));
    breakdowns.applications = applicationCounts.filter((entry) => entry.value > 0);
    const total = applicationCounts.reduce((sum, item) => sum + item.value, 0);
    const approved = applicationCounts.find((item) => item.label === "approved")?.value ?? 0;
    const pending = applicationCounts.filter((item) => ["submitted", "under review", "information requested"].includes(item.label)).reduce((sum, item) => sum + item.value, 0);
    metrics.push(metric("applications_total", "Applications", total, "Applications whose submitted_at is inside the selected period; drafts without submission dates are excluded.", "membership_applications.submitted_at"));
    metrics.push(metric("applications_approved", "Approved applications", approved, "Approved applications submitted inside the selected period.", "membership_applications.status/submitted_at"));
    metrics.push(metric("applications_pending", "Pending applications", pending, "Submitted, under review, or information requested; denominator is all submitted applications in the selected period.", "membership_applications.status/submitted_at"));
    metrics.push(metric("applications_approval_rate", "Approval rate", calculateRate(approved, total), "Applications currently approved ÷ all applications with submitted_at in the selected date range. Null when the denominator is zero.", "membership_applications.status/submitted_at"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = client.from("membership_applications").select("submitted_at,reviewed_at").eq("organization_id", orgId).in("status", ["approved", "rejected"]).not("submitted_at", "is", null).not("reviewed_at", "is", null).gte("reviewed_at", range.start).lt("reviewed_at", range.end).range(0, 4999);
    if (communityMode && scope.communityId) q = q.eq("community_id", scope.communityId);
    const processed = await unwrap<Array<{ submitted_at: string; reviewed_at: string }>>(q);
    if (processed.length === 5000) notes.push("Average application processing time is withheld because the query reached its safe sample limit.");
    const avgHours = processed.length < 5000 ? averageElapsedHours(processed) : null;
    metrics.push(metric("application_processing_hours", "Avg. processing time", avgHours, "Mean elapsed hours from submitted_at to reviewed_at for approved/rejected applications reviewed in the selected period; only records with both timestamps are included.", "membership_applications.submitted_at/reviewed_at"));
  }

  if (module === "overview" || module === "events") {
    const eventIds = await idsFor(client, "events", scope, "starts_at", range.start, range.end);
    const completedEventIds = await idsFor(client, "events", scope, "starts_at", range.start, range.end, ["completed"]);
    const regCount = await countChildRows(client, "event_registrations", "event_id", eventIds, "registered_at", range.start, range.end);
    const approvedRegs = await countChildRows(client, "event_registrations", "event_id", eventIds, "registered_at", range.start, range.end, "registration_status", ["approved", "registered", "attended"]);
    const completedApprovedRegs = await countChildRows(client, "event_registrations", "event_id", completedEventIds, "registered_at", range.start, range.end, "registration_status", ["approved", "registered", "attended"]);
    const waitlisted = await countChildRows(client, "event_registrations", "event_id", eventIds, "registered_at", range.start, range.end, "registration_status", ["waitlisted"]);
    const attendance = await countChildRows(client, "event_attendance", "event_id", completedEventIds, "recorded_at", range.start, range.end, "attendance_status", ["present", "late"]);
    const eventStatuses = ["draft", "published", "registration_open", "registration_closed", "ongoing", "completed", "cancelled", "archived"];
    const eventCounts = await Promise.all(eventStatuses.map(async (status) => ({ label: status.replaceAll("_", " "), value: await countRows(client, "events", scope, { status, ...inRange("starts_at") }) })));
    breakdowns.events = eventCounts.filter((entry) => entry.value > 0);
    const modeCounts = await Promise.all(["online", "offline", "hybrid"].map(async (mode) => ({ label: mode, value: await countRows(client, "events", scope, { filters: { mode }, ...inRange("starts_at") }) })));
    breakdowns.eventModes = modeCounts.filter((entry) => entry.value > 0);
    const publishedEvents = await countRows(client, "events", scope, { status: ["published", "registration_open", "registration_closed", "ongoing", "completed"], ...inRange("starts_at") });
    const now = new Date().toISOString();
    const upcomingEvents = await countRows(client, "events", scope, { status: ["published", "registration_open", "registration_closed"], dateField: "starts_at", from: range.start > now ? range.start : now, to: range.end });
    metrics.push(metric("events_total", "Events", await countRows(client, "events", scope, inRange("starts_at")), "All event records, including drafts and archived records, starting within the selected range.", "events.starts_at"));
    metrics.push(metric("events_published", "Published events", publishedEvents, "Published, registration-open/closed, ongoing, or completed events starting within the selected range.", "events.status/starts_at"));
    metrics.push(metric("events_upcoming", "Upcoming events", upcomingEvents, "Published or registration-state events with starts_at after now and inside the selected date range.", "events.status/starts_at"));
    metrics.push(metric("events_completed", "Completed events", eventCounts.find((item) => item.label === "completed")?.value ?? 0, "Events with completed status and starts_at in the selected range.", "events.status/starts_at"));
    metrics.push(metric("events_cancelled", "Cancelled events", eventCounts.find((item) => item.label === "cancelled")?.value ?? 0, "Events with cancelled status and starts_at in the selected range.", "events.status/starts_at"));
    metrics.push(metric("event_registrations", "Registrations", regCount, "Registration rows in the selected period, including non-approved statuses; not attendance.", "event_registrations.registered_at → events"));
    metrics.push(metric("event_registrations_approved", "Approved registrations", approvedRegs, "Approved, registered, or attended registration rows for events starting in the selected period; still not a check-in record.", "event_registrations.registration_status"));
    metrics.push(metric("event_waitlisted", "Waitlisted", waitlisted, "Registration rows with waitlisted status.", "event_registrations.registration_status"));
    metrics.push(metric("event_attendance_recorded", "Recorded attendance", attendance, "Attendance rows with present or late status; no registration is counted as attendance.", "event_attendance.attendance_status/recorded_at"));
    metrics.push(metric("event_attendance_rate", "Attendance rate", calculateRate(attendance, completedApprovedRegs), "Recorded present/late check-ins ÷ approved/registered/attended registration rows for completed events in the period. Null when the denominator is zero.", "event_attendance ÷ event_registrations (completed events)"));
  }

  if ((module === "overview" && !communityMode) || module === "governance") {
    const committeeIds = await idsFor(client, "committees", scope);
    const meetingIds = await meetingIdsFor(client, scope);
    const periodMeetingIds = await meetingIdsFor(client, scope, range.start, range.end);
    const meetingCount = await countChildRows(client, "committee_meetings", "committee_id", committeeIds, "scheduled_at", range.start, range.end, "status", ["held"]);
    const actionCounts = await Promise.all(["open", "in_progress", "completed", "cancelled"].map(async (status) => ({ label: status.replace("_", " "), value: await countChildRows(client, "meeting_action_items", "meeting_id", meetingIds, undefined, range.start, range.end, "status", [status]) })));
    metrics.push(metric("committees_total", "Committees", await countRows(client, "committees", scope), "Committee records in the authorized organization/community scope.", "committees"));
    metrics.push(metric("committees_active", "Active committees", await countRows(client, "committees", scope, { status: "active" }), "Committees with active status.", "committees.status"));
    metrics.push(metric("committee_memberships", "Committee memberships", committeeIds.length ? await countChildRows(client, "committee_members", "committee_id", committeeIds, undefined, range.start, range.end) : 0, "Current committee membership rows for committees in the authorized scope.", "committee_members.committee_id"));
    metrics.push(metric("governance_meetings_held", "Governance meetings held", meetingCount, "Meetings marked held and scheduled in the selected date period.", "committee_meetings.status/scheduled_at"));
    const meetingAttendance = await countChildRows(client, "committee_meeting_participants", "meeting_id", periodMeetingIds, undefined, range.start, range.end, "attendance_status", ["present"]);
    metrics.push(metric("governance_meeting_attendance", "Recorded meeting attendance", meetingAttendance, "Meeting participant rows marked present for meetings scheduled in the selected period.", "committee_meeting_participants.attendance_status"));
    breakdowns.actionItems = actionCounts.filter((entry) => entry.value > 0);
    const activeActions = (actionCounts.find((entry) => entry.label === "open")?.value ?? 0) + (actionCounts.find((entry) => entry.label === "in progress")?.value ?? 0);
    const completedActions = actionCounts.find((entry) => entry.label === "completed")?.value ?? 0;
    const overdueActions = await overdueActionItems(client, meetingIds, new Date().toISOString().slice(0, 10));
    metrics.push(metric("governance_action_items_open", "Outstanding action items", activeActions, "Current open or in-progress action items from meetings in the authorized committee scope.", "meeting_action_items.status"));
    metrics.push(metric("governance_action_items_completed", "Completed action items", completedActions, "Current action items marked completed in the authorized committee scope.", "meeting_action_items.status"));
    metrics.push(metric("governance_action_items_overdue", "Overdue action items", overdueActions, "Open or in-progress action items with a due_date before today.", "meeting_action_items.status/due_date"));
    const appointments = await countRows(client, "committee_appointments", scope, { status: "active" });
    const expiredAppointments = await countRows(client, "committee_appointments", scope, { status: "expired" });
    const decisions = committeeIds.length ? await countChildRows(client, "committee_resolutions", "committee_id", committeeIds, "decided_at", range.start, range.end, "decision_status", ["approved"]) : 0;
    metrics.push(metric("appointments_active", "Active appointments", appointments, "Committee appointments with active status.", "committee_appointments.status"));
    metrics.push(metric("appointments_expired", "Expired appointments", expiredAppointments, "Committee appointments with expired status.", "committee_appointments.status"));
    metrics.push(metric("governance_decisions_approved", "Approved decisions", decisions, "Approved resolutions decided within the selected period.", "committee_resolutions.decision_status/decided_at"));
    notes.push("Governance metrics are available only to organization administrators in this release; confidential governance content is never returned.");
  }

  if (module === "overview" || module === "content") {
    const statuses = ["draft", "submitted_for_review", "under_review", "changes_requested", "approved", "scheduled", "published", "rejected", "archived"];
    const counts = await Promise.all(statuses.map(async (status) => ({ label: status.replaceAll("_", " "), value: await countRows(client, "content_items", scope, { status, ...(status === "published" ? inRange("published_at") : inRange("updated_at")) }) })));
    breakdowns.content = counts.filter((entry) => entry.value > 0);
    metrics.push(metric("content_total_period", "Content records", counts.reduce((sum, item) => sum + item.value, 0), "Content items updated in the selected period, using published_at for published items and updated_at for other workflow states.", "content_items.status/updated_at/published_at"));
    metrics.push(metric("content_published", "Published content", counts.find((entry) => entry.label === "published")?.value ?? 0, "Content currently published in the selected date range.", "content_items.status/published_at"));
    metrics.push(metric("content_views", "Recorded page views", await contentViewCount(client, scope, range.start, range.end), "Only content_view_events actually stored in the database; community scope is derived through the related scoped content items.", "content_view_events.created_at → content_items"));
  }

  if (module === "overview" || module === "resources") {
    const statuses = ["draft", "submitted_for_review", "under_review", "changes_requested", "approved", "published", "archived"];
    const counts = await Promise.all(statuses.map(async (status) => ({ label: status.replaceAll("_", " "), value: await countRows(client, "resources", scope, { status, ...(status === "published" ? inRange("published_at") : inRange("updated_at")) }) })));
    breakdowns.resources = counts.filter((entry) => entry.value > 0);
    metrics.push(metric("resources_total_period", "Resources", counts.reduce((sum, item) => sum + item.value, 0), "Resource records updated in the selected period, using published_at for published items and updated_at otherwise.", "resources.status/updated_at/published_at"));
    metrics.push(metric("resources_published", "Published resources", counts.find((entry) => entry.label === "published")?.value ?? 0, "Resources currently published within the selected date range.", "resources.status/published_at"));
    const viewRows = await activityCount(client, scope, range.start, range.end, "view");
    const attemptRows = await activityCount(client, scope, range.start, range.end, "download_attempt");
    const successRows = await activityCount(client, scope, range.start, range.end, "download_success");
    metrics.push(metric("resource_views", "Resource views", viewRows, "Recorded resource activity rows of type view only; not inferred from resource view_count metadata.", "resource_activity_logs.activity_type=view"));
    metrics.push(metric("resource_download_attempts", "Download attempts", attemptRows, "Recorded download_attempt activity rows; not proof that a file was downloaded.", "resource_activity_logs.activity_type"));
    metrics.push(metric("resource_download_successes", "Successful downloads", successRows, "Recorded download_success activity rows only.", "resource_activity_logs.activity_type"));
  }

  if ((module === "overview" && !communityMode) || module === "engagement" || module === "messaging") {
    const announcementStatuses = ["draft", "submitted_for_review", "under_review", "changes_requested", "approved", "scheduled", "published", "expired", "archived", "rejected", "cancelled"];
    const announcementCounts = await Promise.all(announcementStatuses.map(async (status) => ({ label: status.replaceAll("_", " "), value: await countRows(client, "announcements", scope, { status }) })));
    breakdowns.announcements = announcementCounts.filter((entry) => entry.value > 0);
    metrics.push(metric("announcements_total", "Announcements", announcementCounts.reduce((sum, item) => sum + item.value, 0), "Announcement records visible in the authorized scope, across current workflow states.", "announcements.status"));
    await addCount("announcements_published", "Published announcements", "announcements", "Announcements published in the selected date range.", "announcements.status/published_at", { status: "published", ...inRange("published_at") });
    await addCount("announcements_scheduled", "Scheduled announcements", "announcements", "Announcements currently in scheduled status.", "announcements.status", { status: "scheduled" });
    await addCount("announcements_archived", "Archived announcements", "announcements", "Announcements currently in archived status.", "announcements.status", { status: "archived" });
    const publishedAnnouncementIds = await idsFor(client, "announcements", scope, "published_at", range.start, range.end, ["published"]);
    const recipients = await countChildRows(client, "announcement_recipients", "announcement_id", publishedAnnouncementIds, undefined, range.start, range.end);
    metrics.push(metric("announcement_recipients", "Recorded recipients", recipients, "Distinct recipient rows attached to announcements published in the selected period; publication alone does not imply delivery or reading.", "announcement_recipients.announcement_id → announcements"));
    await addCount("notifications_generated", "Notifications generated", "notifications", "Notification rows created in the selected period; not proof of delivery or reading.", "notifications.created_at", inRange("created_at"));
    await addCount("notifications_read_period", "Notifications read", "notifications", "Notifications whose read_at falls in the selected period; current tenant RLS applies.", "notifications.read_at", { dateField: "read_at", from: range.start, to: range.end, notNullFields: ["read_at"] });
    await addCount("notifications_unread", "Unread notifications", "notifications", "Current notification rows without read_at; this is a current snapshot, not a period event count.", "notifications.read_at IS NULL", { isNullFields: ["read_at"] });
    await addCount("notifications_delivered_period", "Notifications delivered", "notifications", "Notifications whose delivered_at falls in the selected period; distinct from announcement publication.", "notifications.delivered_at", { dateField: "delivered_at", from: range.start, to: range.end, notNullFields: ["delivered_at"] });
    if (!communityMode) {
      const deliverySent = await countRows(client, "notification_delivery_logs", scope, { status: "sent", ...inRange("attempted_at") });
      const deliveryFailed = await countRows(client, "notification_delivery_logs", scope, { status: "failed", ...inRange("attempted_at") });
      metrics.push(metric("notification_delivery_sent", "Delivery attempts sent", deliverySent, "Delivery log attempts marked sent; per-channel provider reporting is not inferred.", "notification_delivery_logs.status/attempted_at"));
      metrics.push(metric("notification_delivery_failed", "Delivery attempts failed", deliveryFailed, "Delivery log attempts marked failed; retries count as separate attempts.", "notification_delivery_logs.status/attempted_at"));
      const channels = ["in_app", "email", "sms", "whatsapp", "push", "other"];
      const channelCounts = await Promise.all(channels.map(async (channel) => ({ label: channel, value: await countRows(client, "notification_delivery_logs", scope, { status: "sent", filters: { channel }, ...inRange("attempted_at") }) })));
      breakdowns.deliveryChannels = channelCounts.filter((entry) => entry.value > 0);
    }
    if (module === "messaging" || module === "engagement" || module === "overview") {
      const conversationIds = await idsFor(client, "conversations", scope, "created_at", range.start, range.end);
      const allConversationIds = await idsFor(client, "conversations", scope);
      const direct = await countConversationType(client, scope, range, "direct");
      const group = await countConversationType(client, scope, range, "group");
      const messageTotal = await countChildRows(client, "messages", "conversation_id", allConversationIds, "sent_at", range.start, range.end);
      const activeConversations = await countRows(client, "conversations", scope, { isNullFields: ["archived_at", "deleted_at"] });
      metrics.push(metric("conversations_total", "Conversations", conversationIds.length, "Conversations created inside the selected period; no message bodies are read.", "conversations.created_at"));
      metrics.push(metric("conversations_active", "Active conversations", activeConversations, "Current conversations with neither archived_at nor deleted_at set.", "conversations.archived_at/deleted_at"));
      metrics.push(metric("conversations_direct", "Direct conversations", direct, "Direct conversations created inside the selected period.", "conversations.conversation_type"));
      metrics.push(metric("conversations_group", "Group conversations", group, "Group conversations created inside the selected period.", "conversations.conversation_type"));
      metrics.push(metric("messages_sent", "Messages sent", messageTotal, "Message row count by sent_at, with message content and sender identity excluded.", "messages.sent_at → scoped conversations"));
      notes.push("Messaging metrics are aggregate operational counts only. Message content and individual rankings are never returned.");
    }
  }

  const previous = filter.compare ? previousRange(filter) : undefined;
  const comparableIds = new Set([
    "membership_new_period", "applications_total", "applications_approved", "applications_pending", "applications_approval_rate", "application_processing_hours",
    "events_total", "events_published", "events_completed", "events_cancelled", "event_registrations", "event_registrations_approved", "event_waitlisted", "event_attendance_recorded", "event_attendance_rate",
    "content_total_period", "content_published", "content_views", "resources_total_period", "resources_published", "resource_views", "resource_download_attempts", "resource_download_successes",
    "announcements_published", "announcement_recipients", "notifications_generated", "notifications_read_period", "notifications_delivered_period", "notification_delivery_sent", "notification_delivery_failed",
    "conversations_total", "conversations_direct", "conversations_group", "messages_sent", "governance_meetings_held", "governance_meeting_attendance", "governance_decisions_approved",
  ]);
  let series: AnalyticsResult["series"] = [];
  let seriesLabel = "Activity over time";
  let seriesDefinition = "Counts are derived from operational timestamps in each timezone-aware bucket.";
  const trendDays = Math.max(1, Math.ceil((Date.parse(range.end) - Date.parse(range.start)) / 86400000));
  const trendStep = trendDays <= 35 ? 1 : trendDays <= 120 ? 7 : 30;
  const trendBuckets = createDateBuckets(filter.from, filter.to, trendStep).slice(-24);
  const childTrend = async (table: string, key: string, ids: string[], field: string) => Promise.all(trendBuckets.map(async (bucket) => {
    const window = dateWindow(filter, bucket.from, bucket.to);
    return { label: trendStep === 1 ? bucket.from.slice(5) : bucket.from.slice(0, 7), value: await countChildRows(client, table, key, ids, field, window.start, window.end) };
  }));
  if (["overview", "members"].includes(module)) {
    series = await membershipSeries(client, scope, range, filter);
    seriesLabel = "New membership records";
    seriesDefinition = "Membership rows created in each bucket; multiple memberships by the same person remain separate records.";
  } else if (module === "applications") {
    series = await tableSeries(client, "membership_applications", scope, filter, "submitted_at");
    seriesLabel = "Applications submitted";
    seriesDefinition = "Applications grouped by submitted_at; drafts or rows without a submission timestamp are excluded.";
  } else if (module === "events") {
    series = await childTrend("event_registrations", "event_id", await idsFor(client, "events", scope), "registered_at");
    seriesLabel = "Event registrations";
    seriesDefinition = "Registration rows grouped by registered_at; attendance remains a separate recorded measure.";
  } else if (module === "governance") {
    series = await childTrend("committee_resolutions", "committee_id", await idsFor(client, "committees", scope), "decided_at");
    seriesLabel = "Governance decisions";
    seriesDefinition = "Committee resolution records grouped by decided_at; confidential resolution text is never read.";
  } else if (module === "content") {
    series = await tableSeries(client, "content_items", scope, filter, "published_at", { status: "published" });
    seriesLabel = "Content published";
    seriesDefinition = "Published content records grouped by published_at; no untracked views are inferred.";
  } else if (module === "resources") {
    series = await tableSeries(client, "resources", scope, filter, "published_at", { status: "published" });
    seriesLabel = "Resources published";
    seriesDefinition = "Published resource records grouped by published_at; access activity is reported only from logged activity rows.";
  } else if (module === "engagement") {
    series = await tableSeries(client, "announcements", scope, filter, "published_at", { status: "published" });
    seriesLabel = "Announcements published";
    seriesDefinition = "Published announcement records grouped by published_at; notification delivery and read activity are separate metrics.";
  } else if (module === "messaging") {
    series = await childTrend("messages", "conversation_id", await idsFor(client, "conversations", scope), "sent_at");
    seriesLabel = "Messages sent";
    seriesDefinition = "Message row counts grouped by sent_at; message bodies and sender identities are not returned.";
  } else if (["organizations", "communities"].includes(module) && !communityMode) {
    const table = module === "organizations" ? "organizations" : "communities";
    series = await tableSeries(client, table, scope, filter, "created_at");
    seriesLabel = module === "organizations" ? "Organizations created" : "Communities created";
    seriesDefinition = "Organization/community records grouped by created_at within the authorized organization scope.";
  } else {
    series = await membershipSeries(client, scope, range, filter);
    seriesLabel = "New membership records";
    seriesDefinition = "Membership rows created in each bucket; multiple memberships by the same person remain separate records.";
  }
  if (previous && [...metrics].some((item) => comparableIds.has(item.id))) {
    const prior = await getAnalyticsResult(scope, module, { ...filter, from: previous.from, to: previous.to, compare: false });
    for (const item of metrics) {
      if (!comparableIds.has(item.id) || item.value === null) continue;
      const oldValue = prior.metrics.find((candidate) => candidate.id === item.id)?.value;
      if (oldValue !== undefined && oldValue !== null) item.change = calculateChange(item.value, oldValue);
    }
  }

  const distinctMetrics = [...new Map(metrics.map((item) => [item.id, item])).values()];
  return { scope, period: { from: filter.from, to: filter.to, timezone: filter.timezone, ...(previous ? { comparisonFrom: previous.from, comparisonTo: previous.to } : {}) }, generatedAt: new Date().toISOString(), metrics: distinctMetrics, series, seriesLabel, seriesDefinition, breakdowns, notes };
}

async function activityCount(client: SupabaseClient, scope: AnalyticsScope, from: string, to: string, activityType: string) {
  const resourceIds = scope.level === "community" ? await idsFor(client, "resources", scope) : null;
  if (resourceIds && !resourceIds.length) return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client.from("resource_activity_logs").select("id", { count: "exact", head: true }).eq("activity_type", activityType).gte("created_at", from).lt("created_at", to);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (resourceIds) query = query.in("resource_id", resourceIds);
  const { count, error } = await query;
  if (error) throw new Error(`resource_activity_logs: ${error.message}`);
  return count ?? 0;
}

async function contentViewCount(client: SupabaseClient, scope: AnalyticsScope, from: string, to: string) {
  if (scope.level !== "community") return countRows(client, "content_view_events", scope, { dateField: "created_at", from, to });
  const contentIds = await idsFor(client, "content_items", scope);
  if (!contentIds.length) return 0;
  const { count, error } = await client.from("content_view_events").select("id", { count: "exact", head: true }).eq("organization_id", scope.organizationId!).in("content_item_id", contentIds).gte("created_at", from).lt("created_at", to);
  if (error) throw new Error(`content_view_events: ${error.message}`);
  return count ?? 0;
}

async function countConversationType(client: SupabaseClient, scope: AnalyticsScope, range: { start: string; end: string }, type: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client.from("conversations").select("id", { count: "exact", head: true }).eq("conversation_type", type).gte("created_at", range.start).lt("created_at", range.end);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (scope.level === "community" && scope.communityId) query = query.eq("community_id", scope.communityId);
  const { count, error } = await query;
  if (error) throw new Error(`conversations: ${error.message}`);
  return count ?? 0;
}
