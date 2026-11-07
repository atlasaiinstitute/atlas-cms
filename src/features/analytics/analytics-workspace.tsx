"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpRight, BarChart3, Building2, CalendarDays, Check, CircleHelp, FilePlus2, FileText, LoaderCircle, MessageSquare, RefreshCw, ShieldAlert, Users } from "lucide-react";
import type { AnalyticsMetric, AnalyticsResult, AnalyticsScope } from "@/services/analytics";

type OrganizationOption = { id: string; name: string; communities: Array<{ id: string; name: string }> };
type Report = { id: string; name: string; scope_level: "platform" | "organization" | "community"; organization_id: string | null; community_id: string | null; report_type: string; configuration: Record<string, unknown>; updated_at: string; created_at: string };
type ScopeResponse = { organizations: OrganizationOption[]; canViewPlatform: boolean };
type Preset = "today" | "7d" | "30d" | "90d" | "12m" | "year" | "previous-year" | "custom";

const modules = [
  ["overview", "Overview", "/analytics", BarChart3],
  ["platform", "Platform", "/analytics/platform", Building2],
  ["organizations", "Organizations", "/analytics/organizations", Building2],
  ["communities", "Communities", "/analytics/communities", Activity],
  ["members", "Memberships", "/analytics/members", Users],
  ["applications", "Applications", "/analytics/applications", FileText],
  ["events", "Events", "/analytics/events", CalendarDays],
  ["governance", "Governance", "/analytics/governance", ShieldAlert],
  ["content", "Content", "/analytics/content", FileText],
  ["resources", "Resources", "/analytics/resources", ArrowDownToLine],
  ["engagement", "Engagement", "/analytics/engagement", Activity],
  ["messaging", "Messaging", "/analytics/messaging", MessageSquare],
] as const;
const presetLabels: Record<Preset, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "12m": "Last 12 months", year: "Current year", "previous-year": "Previous year", custom: "Custom range" };
const moduleDescriptions: Record<string, string> = {
  overview: "A live summary of records in the authorized tenant scope.",
  platform: "Privacy-safe platform aggregates. Confidential governance and messaging metrics are excluded.",
  organizations: "Organization lifecycle, communities and operational activity.",
  communities: "Membership and activity for the selected authorized community.",
  members: "Profiles and membership records are separate measures; this view contains aggregate counts only.",
  applications: "Application statuses, conversion and processing time use recorded submission/review timestamps.",
  events: "Registration and recorded attendance are shown separately.",
  governance: "Governance totals only; confidential meeting and committee content is not exposed.",
  content: "Publication workflow and tracked page views where actual view events exist.",
  resources: "Resource lifecycle and recorded download attempts/successes, when logged.",
  engagement: "Announcements and notification generation, delivery, and read state are distinct.",
  messaging: "Aggregate conversation and message activity only; private message content and individual rankings are never returned.",
};

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function subtractDays(date: Date, count: number) { const value = new Date(date); value.setDate(value.getDate() - count); return value; }
function defaultRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  if (preset === "today") return { from: localDate(today), to: localDate(today) };
  if (preset === "7d") return { from: localDate(subtractDays(today, 6)), to: localDate(today) };
  if (preset === "90d") return { from: localDate(subtractDays(today, 89)), to: localDate(today) };
  if (preset === "12m") { const from = new Date(today); from.setFullYear(from.getFullYear() - 1); from.setDate(from.getDate() + 1); return { from: localDate(from), to: localDate(today) }; }
  if (preset === "year") return { from: `${today.getFullYear()}-01-01`, to: localDate(today) };
  if (preset === "previous-year") return { from: `${today.getFullYear() - 1}-01-01`, to: `${today.getFullYear() - 1}-12-31` };
  return { from: localDate(subtractDays(today, 29)), to: localDate(today) };
}
function formatValue(value: number | null, id: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (id.endsWith("rate") || id.includes("approval_rate") || id.includes("attendance_rate")) return `${value.toFixed(1)}%`;
  if (id.includes("processing_hours")) return `${value.toFixed(1)} h`;
  return new Intl.NumberFormat().format(value);
}
function moduleFromPath(path: string) {
  if (path.includes("/platform")) return "platform";
  if (path.includes("/organizations")) return "organizations";
  if (path.includes("/communities")) return "communities";
  if (path.includes("/members")) return "members";
  if (path.includes("/applications")) return "applications";
  if (path.includes("/events")) return "events";
  if (path.includes("/governance")) return "governance";
  if (path.includes("/content")) return "content";
  if (path.includes("/resources")) return "resources";
  if (path.includes("/engagement")) return "engagement";
  if (path.includes("/messaging")) return "messaging";
  return "overview";
}
function scopeLabel(scope: AnalyticsScope, organization?: OrganizationOption, communityName?: string) {
  if (scope.level === "platform") return "Platform aggregate";
  if (scope.level === "community") return communityName || "Selected community";
  return organization?.name || "Selected organization";
}

function TrendChart({ series, title, range }: { series: Array<{ label: string; value: number }>; title: string; range: string }) {
  if (!series.length || series.every((item) => item.value === 0)) return <div className="analytics-empty-chart">No records were created in this period.</div>;
  const width = 720, height = 190, pad = 18;
  const max = Math.max(1, ...series.map((item) => item.value));
  const points = series.map((item, index) => ({ x: pad + (series.length === 1 ? (width - pad * 2) / 2 : index * (width - pad * 2) / (series.length - 1)), y: height - pad - (item.value / max) * (height - pad * 2) }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1)?.x},${height - pad} L${points[0].x},${height - pad} Z`;
  const labelIndices = Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]));
  return <figure className="analytics-chart"><figcaption><strong>{title}</strong><span>{range}</span></figcaption><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} line chart. ${series.map((item) => `${item.label}: ${item.value}`).join(", ")}`}><line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" opacity=".18" /><path d={area} fill="#527aa6" opacity=".13" /><path d={line} fill="none" stroke="#527aa6" strokeWidth="3" vectorEffect="non-scaling-stroke" />{points.map((point, index) => <circle key={`${series[index].label}-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#b69a62"><title>{series[index].label}: {series[index].value}</title></circle>)}</svg><div className="analytics-chart-labels">{labelIndices.map((index) => <span key={index}>{series[index]?.label}</span>)}</div></figure>;
}

function Breakdown({ items, title }: { items: Array<{ label: string; value: number }>; title: string }) {
  if (!items.length) return <section className="analytics-panel"><header><h2>{title}</h2></header><div className="analytics-empty">No records for this breakdown in the selected range.</div></section>;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <section className="analytics-panel"><header><h2>{title}</h2><span className="analytics-panel-note">{new Intl.NumberFormat().format(total)} records</span></header><div className="analytics-breakdown">{items.map((item) => <div className="analytics-breakdown-row" key={item.label}><div className="analytics-breakdown-label"><span>{item.label}</span><strong>{new Intl.NumberFormat().format(item.value)}</strong></div><div className="analytics-track"><span style={{ width: `${total ? Math.max(2, item.value / total * 100) : 0}%` }} /></div></div>)}</div></section>;
}

function MetricCard({ item, comparison }: { item: AnalyticsMetric; comparison: boolean }) {
  const change = item.change;
  return <article className="analytics-kpi"><div className="analytics-kpi-label"><span>{item.label}</span><span className="analytics-info" title={`${item.definition} Source: ${item.source}`} aria-label={`${item.definition} Source: ${item.source}`}><CircleHelp size={14} /></span></div><strong>{formatValue(item.value, item.id)}</strong><div className="analytics-kpi-definition">{item.definition}</div>{comparison && change !== undefined && <div className={`analytics-change ${change === null ? "muted" : change >= 0 ? "up" : "down"}`}>{change === null ? "Comparison unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} <span>vs previous period</span></div>}</article>;
}

export function AnalyticsWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const analyticsModule = moduleFromPath(pathname);
  const isReports = pathname === "/analytics/reports";
  const isNewReport = pathname === "/analytics/reports/new";
  const isReportDetail = pathname.startsWith("/analytics/reports/") && !isNewReport;
  const reportId = isReportDetail ? pathname.split("/").at(-1) : "";
  const [scopes, setScopes] = useState<ScopeResponse>({ organizations: [], canViewPlatform: false });
  const [scopesError, setScopesError] = useState("");
  const [level, setLevel] = useState<AnalyticsScope["level"]>("organization");
  const [organizationId, setOrganizationId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [preset, setPreset] = useState<Preset>("30d");
  const initial = defaultRange("30d");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compare, setCompare] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportDetail, setReportDetail] = useState<{ report: Report; preview: AnalyticsMetric[]; generatedAt: string; period: AnalyticsResult["period"] } | null>(null);
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState("overview");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/analytics/scopes", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load scope options.");
      if (!active) return;
      setScopes(body);
      setScopesError("");
      if (pathname === "/analytics/platform") setLevel("platform");
      else if (body.organizations?.length) setOrganizationId((current) => current || body.organizations[0].id);
    }).catch((cause: Error) => { if (active) setScopesError(cause.message); });
    return () => { active = false; };
  // pathname is intentionally included so the platform page can select its required scope.
  }, [pathname]);

  const organization = scopes.organizations.find((item) => item.id === organizationId);
  const community = organization?.communities.find((item) => item.id === communityId);
  const scope: AnalyticsScope | null = useMemo(() => level === "platform" ? (scopes.canViewPlatform ? { level: "platform" } : null) : organizationId ? level === "community" && communityId ? { level: "community", organizationId, communityId } : level === "organization" ? { level: "organization", organizationId } : null : null, [level, scopes.canViewPlatform, organizationId, communityId]);
  const requestModule = level === "platform" ? "platform" : isNewReport ? reportType : analyticsModule;
  const queryString = useMemo(() => {
    if (!scope) return "";
    const params = new URLSearchParams({ module: requestModule, level: scope.level, from, to, timezone, compare: String(compare) });
    if (scope.organizationId) params.set("organizationId", scope.organizationId);
    if (scope.communityId) params.set("communityId", scope.communityId);
    return params.toString();
  }, [scope, requestModule, from, to, timezone, compare]);

  const loadAnalytics = useCallback(async () => {
    if (isReports || isReportDetail) return;
    if (!scope || !queryString) { setData(null); setError(""); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/analytics?${queryString}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Analytics unavailable.");
      setData(body); setSelectedMetrics((current) => current.length ? current : body.metrics.map((item: AnalyticsMetric) => item.id));
    } catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "Analytics unavailable."); }
    finally { setLoading(false); }
  }, [scope, queryString, isReports, isReportDetail]);
  useEffect(() => { if (isReports || isReportDetail) return; void loadAnalytics(); }, [loadAnalytics, isReports, isReportDetail]);
  useEffect(() => { if (isNewReport) setSelectedMetrics([]); }, [reportType, isNewReport]);

  useEffect(() => {
    if (!isReports) return;
    let active = true;
    fetch("/api/analytics/reports", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Reports unavailable."); if (active) setReports(body.reports ?? []); }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [isReports]);

  useEffect(() => {
    if (!isReportDetail || !reportId) return;
    let active = true; setLoading(true); setError("");
    fetch(`/api/analytics/reports/${encodeURIComponent(reportId)}`, { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Report unavailable."); if (active) setReportDetail(body); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isReportDetail, reportId]);

  const onPreset = (value: Preset) => { setPreset(value); if (value !== "custom") { const range = defaultRange(value); setFrom(range.from); setTo(range.to); } };
  const heading = isReports ? "Report centre" : isNewReport ? "Build a report" : isReportDetail ? reportDetail?.report.name ?? "Report details" : modules.find((item) => item[0] === analyticsModule)?.[1] ?? "Analytics";
  const rangeLabel = `${from} — ${to}`;
  const filteredMetrics = useMemo(() => {
    const visibility: Record<string, string[]> = {
      overview: ["organizations_total", "organizations_active", "communities_total", "communities_active", "profiles_unique", "organization_memberships", "organization_memberships_active", "community_memberships", "community_memberships_active", "membership_new_period", "applications_pending", "applications_approved", "committees_active", "events_published", "events_upcoming", "content_published", "resources_published", "announcements_published", "notifications_generated", "notifications_read_period", "notifications_delivered_period", "notification_delivery_sent", "notification_delivery_failed"],
      platform: ["organizations_total", "organizations_active", "communities_total", "communities_active", "profiles_unique", "organization_memberships_active", "community_memberships_active", "applications_submitted_period", "applications_pending", "applications_approved_period", "events_published_period", "events_upcoming", "content_published_period", "resources_published_period", "announcements_published_period"],
      organizations: ["organizations_total", "organizations_active", "communities_total", "communities_active", "organization_memberships", "organization_memberships_active", "community_memberships", "community_memberships_active", "applications_pending", "applications_approved", "committees_active", "events_published", "events_upcoming", "content_published", "resources_published", "announcements_published"],
      communities: ["community_memberships", "community_memberships_active", "profiles_unique", "applications_pending", "applications_approved", "events_published", "events_upcoming", "content_published", "resources_published", "announcements_published"],
      members: ["profiles_unique", "organization_memberships", "organization_memberships_active", "community_memberships", "community_memberships_active", "memberships_active", "membership_new_period"],
      applications: ["applications_total", "applications_approved", "applications_pending", "applications_approval_rate", "application_processing_hours"],
      events: ["events_total", "events_published", "events_upcoming", "events_completed", "events_cancelled", "event_registrations", "event_registrations_approved", "event_waitlisted", "event_attendance_recorded", "event_attendance_rate"],
      governance: ["committees_total", "committees_active", "committee_memberships", "governance_meetings_held", "governance_meeting_attendance", "governance_action_items_open", "governance_action_items_completed", "governance_action_items_overdue", "appointments_active", "appointments_expired", "governance_decisions_approved"],
      content: ["content_total_period", "content_published", "content_views"],
      resources: ["resources_total_period", "resources_published", "resource_views", "resource_download_attempts", "resource_download_successes"],
      engagement: ["announcements_total", "announcements_published", "announcements_scheduled", "announcements_archived", "announcement_recipients", "notifications_generated", "notifications_read_period", "notifications_unread", "notifications_delivered_period", "notification_delivery_sent", "notification_delivery_failed", "conversations_total", "conversations_active", "conversations_direct", "conversations_group", "messages_sent"],
      messaging: ["conversations_total", "conversations_active", "conversations_direct", "conversations_group", "messages_sent"],
    };
    const ids = visibility[requestModule] ?? [];
    return (data?.metrics ?? []).filter((item) => ids.includes(item.id));
  }, [data, requestModule]);

  const createReport = async () => {
    if (!scope) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/analytics/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: reportName, reportType: analyticsModule === "platform" ? "platform" : reportType, scopeLevel: scope.level, organizationId: scope.organizationId, communityId: scope.communityId, configuration: { from, to, timezone, compare, metrics: selectedMetrics } }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to save report.");
      router.push(`/analytics/reports/${body.report.id}`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save report."); }
    finally { setSaving(false); }
  };

  const deleteReport = async (id: string) => {
    if (!window.confirm("Delete this saved report configuration?")) return;
    const response = await fetch(`/api/analytics/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await response.json();
    if (response.ok) setReports((current) => current.filter((report) => report.id !== id));
    else setError(body.error || "Could not delete report.");
  };

  return <div className="analytics-workspace">
    <div className="analytics-title-row"><div><div className="eyebrow">Insights / Analytics</div><h1>{heading}</h1><p>{isReports ? "Manage saved configurations and generate scoped reports." : isNewReport ? "Select the authorized scope, date range, and aggregate metrics to save." : isReportDetail ? "A fresh preview is calculated from current operational records." : moduleDescriptions[requestModule]}</p></div>{!isReports && !isReportDetail && !isNewReport && <div className="analytics-heading-actions"><Link className="button button-secondary" href="/analytics/reports"><FileText size={15} /> Report centre</Link><Link className="button button-primary" href="/analytics/reports/new"><FilePlus2 size={15} /> New report</Link></div>}</div>

    {!isReports && !isReportDetail && <nav className="analytics-module-nav" aria-label="Analytics modules">{modules.filter(([key]) => key !== "platform").map(([key, label, href]) => <Link key={key} href={href} className={analyticsModule === key ? "active" : ""}>{label}</Link>)}{scopes.canViewPlatform && <Link href="/analytics/platform" className={analyticsModule === "platform" ? "active" : ""}>Platform</Link>}<Link href="/analytics/reports" className="report-link">Reports</Link></nav>}

    {!isReports && !isReportDetail && <div className="analytics-control-panel" aria-label="Analytics filters">
      <label><span>Scope</span><select value={level} onChange={(event) => { setLevel(event.target.value as AnalyticsScope["level"]); setCommunityId(""); }}><option value="organization">Organization</option><option value="community">Community</option>{scopes.canViewPlatform && <option value="platform">Platform</option>}</select></label>
      {level !== "platform" && <label><span>Organization</span><select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setCommunityId(""); }}><option value="">Choose organization</option>{scopes.organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      {level === "community" && <label><span>Community</span><select value={communityId} onChange={(event) => setCommunityId(event.target.value)}><option value="">Choose community</option>{(organization?.communities ?? []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      <label><span>Date range</span><select value={preset} onChange={(event) => onPreset(event.target.value as Preset)}>{Object.entries(presetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {preset === "custom" && <><label><span>From</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label></>}
      <label className="analytics-compare"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /><span>Compare previous period</span></label>
      <button className="icon-button analytics-refresh" onClick={() => void loadAnalytics()} aria-label="Refresh analytics"><RefreshCw size={16} /></button>
    </div>}

    {isReports && <>
      <div className="analytics-section-head"><div><strong>Saved reports</strong><p>Only your report definitions are listed. Data is re-read and permission-checked whenever a report is opened or exported.</p></div><Link href="/analytics/reports/new" className="button button-primary"><FilePlus2 size={15} /> Create report</Link></div>
      {error ? <div className="analytics-state error"><ShieldAlert size={18} /><div><strong>Reports unavailable</strong><p>{error}</p></div></div> : reports.length ? <div className="analytics-report-list">{reports.map((report) => <article key={report.id} className="analytics-report-card"><div className="analytics-report-icon"><FileText size={19} /></div><div><Link href={`/analytics/reports/${report.id}`}><strong>{report.name}</strong></Link><p>{report.scope_level} · {String(report.configuration.from ?? "")} to {String(report.configuration.to ?? "")} · Updated {new Date(report.updated_at).toLocaleDateString()}</p></div><div className="analytics-report-actions"><Link className="text-link" href={`/analytics/reports/${report.id}`}>Open <ArrowUpRight size={13} /></Link><button className="analytics-link-button danger" onClick={() => void deleteReport(report.id)}>Delete</button></div></article>)}</div> : <div className="analytics-state"><FileText size={20} /><div><strong>No saved reports yet</strong><p>Build a scoped report configuration to preview and export live metrics.</p></div></div>}
    </>}

    {isReportDetail && <>{loading ? <div className="analytics-state"><LoaderCircle className="spin" size={20} /> Loading report preview…</div> : error ? <div className="analytics-state error"><ShieldAlert size={18} /><div><strong>Report unavailable</strong><p>{error}</p></div></div> : reportDetail && <><div className="analytics-report-summary"><div><span>Scope</span><strong>{reportDetail.report.scope_level === "platform" ? "Platform aggregate" : reportDetail.report.community_id ? "Authorized community" : "Authorized organization"}</strong></div><div><span>Date range</span><strong>{reportDetail.period.from} — {reportDetail.period.to}</strong></div><div><span>Generated</span><strong>{new Date(reportDetail.generatedAt).toLocaleString()}</strong></div><a className="button button-primary" href={`/api/analytics/reports/${reportId}/export`}><ArrowDownToLine size={15} /> Export CSV</a></div><div className="analytics-table-panel"><h2>Live report preview</h2><p>Calculated metrics from current operational rows. Values are recalculated when this report is opened.</p>{reportDetail.preview.length ? <div className="analytics-table-scroll"><table><thead><tr><th>Metric</th><th>Value</th><th>Definition</th><th>Source</th></tr></thead><tbody>{reportDetail.preview.map((item) => <tr key={item.id}><td><strong>{item.label}</strong></td><td>{formatValue(item.value, item.id)}</td><td>{item.definition}</td><td><code>{item.source}</code></td></tr>)}</tbody></table></div> : <div className="analytics-empty">The saved configuration has no available metrics for this scope.</div>}<p className="analytics-footnote">CSV export only. PDF generation is not enabled because the project has no installed PDF generation library.</p></div></>}</>}

    {isNewReport && <div className="analytics-report-builder">
      <section className="analytics-panel"><header><div><h2>Report configuration</h2><p>Scope and metrics are validated server-side at save and export.</p></div></header>
        <div className="analytics-builder-fields"><label>Report name<input value={reportName} maxLength={120} onChange={(event) => setReportName(event.target.value)} placeholder="e.g. Monthly membership activity" /></label><label>Report section<select value={reportType} onChange={(event) => setReportType(event.target.value)}>{modules.filter((item) => item[0] !== "platform").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="analytics-selected-scope"><Check size={16} /><span>{scope ? scopeLabel(scope, organization, community?.name) : scopesError || "Choose an authorized scope above."}</span></div>
        {message && <div className="analytics-state error"><ShieldAlert size={17} />{message}</div>}
        <button className="button button-primary" disabled={!scope || !reportName.trim() || saving} onClick={() => void createReport()}>{saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Save report configuration</button>
      </section>
      <section className="analytics-panel"><header><div><h2>Included metrics</h2><p>Metrics are selected from the current authorized preview; personal data is not available.</p></div></header>
        {loading ? <div className="analytics-state"><LoaderCircle className="spin" size={18} /> Loading available metrics…</div> : error ? <div className="analytics-state error">{error}</div> : data?.metrics.length ? <div className="analytics-metric-picker">{data.metrics.map((item) => <label key={item.id}><input type="checkbox" checked={selectedMetrics.includes(item.id)} onChange={(event) => setSelectedMetrics((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span><strong>{item.label}</strong><small>{item.definition}</small></span><b>{formatValue(item.value, item.id)}</b></label>)}</div> : <div className="analytics-empty">No metrics are available until you select a permitted scope and complete the required migrations.</div>}
      </section>
    </div>}

    {!isReports && !isReportDetail && !isNewReport && <>
      {scopesError && <div className="analytics-state error"><ShieldAlert size={18} /><div><strong>Scope lookup unavailable</strong><p>{scopesError}</p></div></div>}
      {loading ? <div className="analytics-state"><LoaderCircle className="spin" size={20} /> Loading live analytics…</div> : error ? <div className="analytics-state error"><ShieldAlert size={18} /><div><strong>Analytics unavailable</strong><p>{error}</p><small>Confirm Supabase is configured, Step 16 migration is applied, and the signed-in development identity has permission for this scope.</small></div></div> : scope && data ? <>
        <div className="analytics-live-bar"><span><i /> Live database aggregates</span><span>{scopeLabel(scope, organization, community?.name)} · {rangeLabel} ({timezone})</span><span>Generated {new Date(data.generatedAt).toLocaleTimeString()}</span></div>
        {filteredMetrics.length ? <div className="analytics-kpi-grid">{filteredMetrics.map((item) => <MetricCard item={item} comparison={compare} key={item.id} />)}</div> : <div className="analytics-state"><BarChart3 size={20} /><div><strong>No metrics available for this view</strong><p>Choose a permitted organization or community scope.</p></div></div>}
        <div className="analytics-content-grid">
          <section className="analytics-panel"><header><div><h2>{data.seriesLabel}</h2><p>{data.seriesDefinition}</p></div><span className="analytics-tag">{rangeLabel}</span></header><TrendChart series={data.series} title={data.seriesLabel} range={rangeLabel} /></section>
          <div className="analytics-breakdown-stack">
            <Breakdown items={data.breakdowns.memberships ?? data.breakdowns.applications ?? data.breakdowns.content ?? data.breakdowns.resources ?? data.breakdowns.events ?? data.breakdowns.announcements ?? data.breakdowns.actionItems ?? []} title={data.breakdowns.memberships ? "Membership status distribution" : data.breakdowns.applications ? "Application status distribution" : data.breakdowns.content ? "Content workflow status" : data.breakdowns.resources ? "Resource workflow status" : data.breakdowns.events ? "Event lifecycle status" : data.breakdowns.announcements ? "Announcement lifecycle status" : "Governance action items"} />
            {data.breakdowns.eventModes && <Breakdown items={data.breakdowns.eventModes} title="Event mode distribution" />}
            {data.breakdowns.deliveryChannels && <Breakdown items={data.breakdowns.deliveryChannels} title="Sent delivery attempts by channel" />}
          </div>
        </div>
        {data.notes.map((note) => <p className="analytics-footnote" key={note}>{note}</p>)}
        <div className="analytics-source-note"><CircleHelp size={15} /><span>Definitions and sources are attached to each metric. All date boundaries use <strong>{timezone}</strong>; comparisons cover the immediately preceding equivalent number of calendar days.</span></div>
      </> : <div className="analytics-state"><Building2 size={20} /><div><strong>Select an authorized scope</strong><p>{level === "community" ? "Choose an organization and an authorized community." : "No organization or community analytics scope is currently available for this identity."}</p></div></div>}
    </>}
  </div>;
}
