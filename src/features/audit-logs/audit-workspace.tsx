"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, Download, FileSearch, Filter, LockKeyhole, RefreshCw, Search, Settings2, ShieldCheck } from "lucide-react";
import type { AuditLogRecord, AuditRetentionPolicy } from "@/services/audit-logs";

type Props = { section: string[]; initialSearch?: Record<string, string | string[] | undefined> };
type Dashboard = { total?: number; administrative?: number; security?: number; organization_activity?: number; community_activity?: number; failed?: number; recent_sensitive?: Array<Record<string, unknown>>; by_module?: Array<{ module: string; count: number }>; trend?: Array<{ date: string; count: number }>; generated_at?: string };
type ListResult = { records: AuditLogRecord[]; page: number; pageSize: number; total: number; pages: number };
const nav = [
  ["Overview", "/audit-logs"], ["Platform", "/audit-logs/platform"], ["Organizations", "/audit-logs/organizations"],
  ["Communities", "/audit-logs/communities"], ["Security", "/audit-logs/security"], ["Administrative", "/audit-logs/administrative"],
  ["Reports & export", "/audit-logs/reports"], ["Retention settings", "/audit-logs/settings"],
] as const;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (count: number) => { const value = new Date(); value.setDate(value.getDate() - count); return value.toISOString().slice(0, 10); };
function humanDate(value?: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Unknown time"; }
function count(value: unknown) { return typeof value === "number" ? value.toLocaleString() : "0"; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

export function AuditWorkspace({ section, initialSearch = {} }: Props) {
  const sectionName = section[0] ?? "overview";
  const isDetail = section.length > 0 && isUuid(section[0]);
  const initial = (key: string) => Array.isArray(initialSearch[key]) ? (initialSearch[key] as string[])[0] : initialSearch[key] as string | undefined;
  const [level, setLevel] = useState<"platform" | "organization" | "community">(sectionName === "platform" ? "platform" : sectionName === "communities" ? "community" : (initial("level") as "platform" | "organization" | "community") || "organization");
  const [organizationId, setOrganizationId] = useState(initial("organizationId") ?? "");
  const [communityId, setCommunityId] = useState(initial("communityId") ?? "");
  const [from, setFrom] = useState(initial("from") ?? daysAgo(29));
  const [to, setTo] = useState(initial("to") ?? today());
  const [keyword, setKeyword] = useState("");
  const [actorId, setActorId] = useState("");
  const [module, setModule] = useState("");
  const [eventType, setEventType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [severity, setSeverity] = useState("");
  const [targetEntity, setTargetEntity] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListResult | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [detail, setDetail] = useState<AuditLogRecord | null>(null);
  const [policies, setPolicies] = useState<AuditRetentionPolicy[]>([]);
  const [retentionDays, setRetentionDays] = useState(365);
  const [archiveBeforePurge, setArchiveBeforePurge] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);

  const pageTitle = isDetail ? "Audit record" : sectionName === "reports" ? "Audit reports & exports" : sectionName === "settings" ? "Audit retention settings" : sectionName === "security" ? "Security events" : sectionName === "administrative" ? "Administrative actions" : sectionName === "organizations" ? "Organization audit logs" : sectionName === "communities" ? "Community audit logs" : sectionName === "platform" ? "Platform audit logs" : "Audit logs & activity";
  const scopeReady = level === "platform" || (isUuid(organizationId) && (level !== "community" || isUuid(communityId)));
  const scope = useMemo(() => ({ level, ...(level === "platform" ? {} : { organizationId }), ...(level === "community" ? { communityId } : {}) }), [level, organizationId, communityId]);
  const params = () => {
    const value = new URLSearchParams({ level, from, to });
    if (level !== "platform") value.set("organizationId", organizationId);
    if (level === "community") value.set("communityId", communityId);
    if (keyword.trim()) value.set("q", keyword.trim());
    if (actorId.trim()) value.set("actorId", actorId.trim());
    if (module) value.set("module", module);
    if (eventType.trim()) value.set("eventType", eventType.trim());
    if (targetEntity.trim()) value.set("targetEntity", targetEntity.trim());
    if (outcome) value.set("outcome", outcome);
    if (severity) value.set("severity", severity);
    if (sectionName === "security") value.set("view", "security");
    if (sectionName === "administrative") value.set("view", "administrative");
    if (sort === "oldest") value.set("sort", "oldest");
    return value;
  };
  async function load(currentPage = 1) {
    setError(""); setNotice("");
    if (!scopeReady) { setError(level === "community" ? "Enter a valid organization ID and community ID to continue." : "Enter a valid organization ID to continue."); return; }
    setLoading(true);
    try {
      if (isDetail) {
        const query = new URLSearchParams({ level, ...(level !== "platform" ? { organizationId } : {}), ...(level === "community" ? { communityId } : {}) });
        const response = await fetch(`/api/audit-logs/${section[0]}?${query}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load audit record.");
        setDetail(body as AuditLogRecord);
      } else if (sectionName === "settings") {
        const response = await fetch(`/api/audit-logs/settings?${new URLSearchParams({ level, ...(level !== "platform" ? { organizationId } : {}), ...(level === "community" ? { communityId } : {}) })}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load retention settings.");
        setPolicies(body.policies ?? []);
        const active = (body.policies ?? []).find((item: AuditRetentionPolicy) => item.scope_type === level) ?? body.policies?.[0];
        if (active) { setRetentionDays(active.retention_days); setArchiveBeforePurge(active.archive_before_purge); setEnabled(active.enabled); setNotes(active.notes ?? ""); }
      } else if (sectionName === "overview" || !sectionName) {
        const response = await fetch(`/api/audit-logs/dashboard?${params()}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load audit dashboard.");
        setDashboard(body as Dashboard);
      } else {
        const query = params(); query.set("page", String(currentPage)); query.set("pageSize", "25");
        const response = await fetch(`/api/audit-logs?${query}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load audit records.");
        setList(body as ListResult); setPage(currentPage);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Audit request failed."); }
    finally { setLoading(false); }
  }
  async function saveRetention(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setLoading(true);
    try {
      const response = await fetch("/api/audit-logs/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, retentionDays, archiveBeforePurge, enabled, notes }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update retention settings.");
      setNotice("Retention configuration saved and recorded in the audit trail."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Retention update failed."); }
    finally { setLoading(false); }
  }
  async function exportRecords(format: "csv" | "json") {
    setError(""); setNotice("");
    if (!scopeReady) { setError("Provide an authorized scope before exporting."); return; }
    setExporting(true);
    try {
      const response = await fetch(`/api/audit-logs/export?${params()}&format=${format}`, { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "Export was denied."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `atlas-audit-${new Date().toISOString().slice(0, 10)}.${format}`; link.click(); URL.revokeObjectURL(url);
      setNotice(`Authorized ${format.toUpperCase()} export generated and its creation was recorded.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setExporting(false); }
  }

  const queryString = params().toString();
  return <div className="audit-workspace">
    <div className="audit-heading"><div><div className="eyebrow">Insights · Accountability</div><h1>{pageTitle}</h1><p className="page-description">A controlled record of administrative and security-relevant changes. This is not a general activity feed.</p></div><div className="audit-heading-actions"><button className="button button-secondary" onClick={() => load(page)} disabled={loading || exporting}><RefreshCw size={15} className={loading ? "audit-spin" : ""} />{loading ? "Loading…" : "Refresh"}</button></div></div>
    <nav className="audit-nav" aria-label="Audit log sections">{nav.map(([label, href]) => <Link key={href} href={href} className={(sectionName === "overview" && href === "/audit-logs") || href.endsWith(`/${sectionName}`) || (href === "/audit-logs" && !sectionName) ? "active" : ""}>{label}</Link>)}</nav>

    <section className="audit-scope-panel" aria-label="Audit scope and period">
      <div className="audit-panel-title"><div><strong><ShieldCheck size={15} /> Authorized scope</strong><small>Database permissions and tenant access are rechecked for every request.</small></div></div>
      <div className="audit-scope-fields">
        <label>Scope level<select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}><option value="platform">Platform</option><option value="organization">Organization</option><option value="community">Community</option></select></label>
        {level !== "platform" && <label>Organization ID<input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="UUID" spellCheck={false} /></label>}
        {level === "community" && <label>Community ID<input value={communityId} onChange={(event) => setCommunityId(event.target.value)} placeholder="UUID" spellCheck={false} /></label>}
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button className="button button-primary" onClick={() => load(1)} disabled={loading || !scopeReady}><Search size={15} /> Load authorized records</button>
      </div>
      <p className="audit-scope-help">Use IDs from a scope you already administer. A denied scope returns no records or counts.</p>
    </section>

    {error && <div className="audit-state error" role="alert"><AlertTriangle size={18} /><div><strong>Audit request needs attention</strong><p>{error}</p></div></div>}
    {notice && <div className="audit-state success" role="status"><ShieldCheck size={18} /><div><strong>Complete</strong><p>{notice}</p></div></div>}

    {(sectionName === "overview" || !sectionName) && !isDetail && <DashboardView dashboard={dashboard} loading={loading} />}
    {!isDetail && sectionName !== "overview" && sectionName !== "settings" && sectionName !== "reports" && <>
      <div className="audit-filter-panel"><div className="audit-panel-title"><div><strong><Filter size={15} /> Search and filters</strong><small>Filters and pagination are applied server-side.</small></div><label className="audit-sort">Sort<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
        <div className="audit-filter-grid"><label>Keyword<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Event, action, summary" /></label><label>Actor ID<input value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="UUID" /></label><label>Module<select value={module} onChange={(event) => setModule(event.target.value)}><option value="">All modules</option>{["organizations","communities","members","applications","roles","governance","events","cms","resources","announcements","notifications","messaging","audit_logs","platform","security"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Event type<input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="e.g. events.published" /></label><label>Target entity<input value={targetEntity} onChange={(event) => setTargetEntity(event.target.value)} placeholder="e.g. events" /></label><label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All classifications</option><option value="informational">Informational</option><option value="warning">Warning</option><option value="high_risk">High risk</option></select></label><button className="button button-primary audit-apply" onClick={() => load(1)} disabled={loading}><Search size={14} /> Apply filters</button></div>
      </div>
      <RecordsTable list={list} onPage={load} loading={loading} scopeQuery={queryString} />
    </>}
    {isDetail && <DetailView record={detail} scopeQuery={new URLSearchParams({ level, ...(level !== "platform" ? { organizationId } : {}), ...(level === "community" ? { communityId } : {}) }).toString()} loading={loading} />}
    {sectionName === "reports" && <section className="audit-card audit-export-card"><div className="audit-card-icon"><Download size={19} /></div><div><h2>Authorized audit export</h2><p>Download the selected scope and filters using the fields your role is allowed to view. Exports include generation time, scope, filters, and record count; each export is itself logged.</p><p className="audit-warning"><LockKeyhole size={14} /> Exports are streamed to your browser; files are not saved on the server. Each request is re-authorized. Maximum 5,000 matching rows per export.</p></div><div className="audit-export-actions"><button className="button button-primary" onClick={() => exportRecords("csv")} disabled={exporting || !scopeReady}><Download size={14} />{exporting ? "Preparing…" : "Export CSV"}</button><button className="button button-secondary" onClick={() => exportRecords("json")} disabled={exporting || !scopeReady}><FileSearch size={14} /> Export JSON</button></div></section>}
    {sectionName === "settings" && <section className="audit-card audit-settings-card"><div className="audit-card-icon"><Settings2 size={19} /></div><div className="audit-settings-copy"><h2>Retention policy</h2><p>Configure the declared retention window for authorized scope. This project does not run automatic archival or deletion jobs. Shortening the period below 365 days is blocked.</p><div className="audit-policy-current"><strong>Existing policies</strong>{policies.length ? policies.map((item) => <div key={item.id}><span>{item.scope_type}{item.organization_id ? ` · ${item.organization_id}` : ""}{item.community_id ? ` · ${item.community_id}` : ""}</span><b>{item.retention_days} days · {item.enabled ? "enabled" : "disabled"}</b></div>) : <small>No retention policy is configured for this scope yet.</small>}</div>
      <form className="audit-retention-form" onSubmit={saveRetention}><label>Retention days<input type="number" min={365} max={3650} step={1} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} required /></label><label className="audit-check"><input type="checkbox" checked={archiveBeforePurge} onChange={(event) => setArchiveBeforePurge(event.target.checked)} /> Archive before purge (configuration only)</label><label className="audit-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Policy enabled</label><label>Administrative note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} /></label><button className="button button-primary" type="submit" disabled={loading || !scopeReady}><Settings2 size={14} /> Save policy</button></form></div></section>}
    <p className="audit-integrity-note"><LockKeyhole size={14} /> App writes are append-only and the business event triggers run transactionally. This does not prevent privileged database operators or infrastructure administrators from changing storage. No cryptographic hash chain or automated retention job is claimed.</p>
  </div>;
}

function DashboardView({ dashboard, loading }: { dashboard: Dashboard | null; loading: boolean }) {
  if (!dashboard && !loading) return <div className="audit-empty"><Activity size={23} /><strong>Load an authorized scope to view audit metrics</strong><span>Dashboard values are calculated from persisted audit records only. No preview or fixture counts are shown.</span></div>;
  const tiles = [["Total events", dashboard?.total], ["Administrative actions", dashboard?.administrative], ["Security events", dashboard?.security], ["Organization activity", dashboard?.organization_activity], ["Community activity", dashboard?.community_activity], ["Failed / denied", dashboard?.failed]] as const;
  const modules = dashboard?.by_module ?? []; const maxModule = Math.max(1, ...modules.map((item) => item.count));
  const trend = dashboard?.trend ?? []; const maxTrend = Math.max(1, ...trend.map((item) => item.count));
  return <>
    {loading && <div className="audit-state"><RefreshCw size={16} className="audit-spin" /><div><strong>Loading database-derived metrics</strong><p>Checking the selected scope and reading permitted audit records.</p></div></div>}
    <div className="audit-metric-grid">{tiles.map(([label, value]) => <article className="audit-metric" key={label}><span>{label}</span><strong>{value === undefined ? "—" : count(value)}</strong><small>{dashboard ? "Selected period · persisted logs" : "Awaiting authorized scope"}</small></article>)}</div>
    <div className="audit-dashboard-grid"><section className="audit-card"><div className="audit-card-heading"><div><h2>Event distribution</h2><p>Recorded rows grouped by source module</p></div></div>{modules.length ? <div className="audit-bars">{modules.map((item) => <div className="audit-bar-row" key={item.module}><span>{item.module}</span><div><i style={{ width: `${Math.max(3, item.count / maxModule * 100)}%` }} /></div><strong>{count(item.count)}</strong></div>)}</div> : <div className="audit-inline-empty">No recorded events in the selected period.</div>}</section>
      <section className="audit-card"><div className="audit-card-heading"><div><h2>Activity trend</h2><p>Daily count · UTC</p></div></div>{trend.length ? <div className="audit-trend" role="img" aria-label={`Daily audit event totals over ${trend.length} days`}>{trend.slice(-31).map((item) => <div key={item.date} title={`${item.date}: ${item.count} events`}><i style={{ height: `${Math.max(4, item.count / maxTrend * 100)}%` }} /><small>{item.date.slice(5)}</small></div>)}</div> : <div className="audit-inline-empty">No recorded events in the selected period.</div>}</section></div>
    <section className="audit-card"><div className="audit-card-heading"><div><h2>Recent sensitive changes</h2><p>Actual administrative changes and non-informational events, where recorded</p></div></div>{dashboard?.recent_sensitive?.length ? <div className="audit-recent-list">{dashboard.recent_sensitive.map((item) => <div key={String(item.id)}><span className="audit-dot" /><div><strong>{String(item.summary ?? item.event_type)}</strong><small>{String(item.event_type)} · {humanDate(String(item.created_at))}</small></div><span className={`audit-pill ${String(item.severity)}`}>{String(item.severity)}</span></div>)}</div> : <div className="audit-inline-empty">No sensitive changes recorded for this period.</div>}</section>
    {dashboard?.generated_at && <p className="audit-meta">Generated {humanDate(dashboard.generated_at)}. Metrics are from authorized audit rows; missing logs are not inferred.</p>}
  </>;
}

function RecordsTable({ list, onPage, loading, scopeQuery }: { list: ListResult | null; onPage: (page: number) => void; loading: boolean; scopeQuery: string }) {
  if (!list && !loading) return <div className="audit-empty"><FileSearch size={22} /><strong>No search submitted</strong><span>Choose a scope and date range, then apply filters. Unauthorized records and counts are not returned.</span></div>;
  return <section className="audit-records-card"><div className="audit-card-heading"><div><h2>Audit records</h2><p>{list ? `${count(list.total)} matching records · Page ${list.page} of ${Math.max(1, list.pages)}` : "Loading authorized records…"}</p></div><span>{loading ? "Updating…" : list ? `${list.records.length} displayed` : ""}</span></div>
    {list?.records.length ? <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Timestamp</th><th>Event</th><th>Actor</th><th>Target</th><th>Outcome</th><th>Severity</th><th aria-label="Details" /></tr></thead><tbody>{list.records.map((row) => <tr key={row.id}><td><time dateTime={row.created_at}>{humanDate(row.created_at)}</time></td><td><Link href={`/audit-logs/${row.id}?${scopeQuery}`} className="audit-event-link"><strong>{row.change_summary || row.event_type}</strong><small>{row.event_type}</small></Link></td><td>{row.actor_display_name || (row.actor_user_id ? `${row.actor_user_id.slice(0, 8)}…` : "System / unavailable")}</td><td><span>{row.target_record_type || "—"}</span><small>{row.target_record_id ? `${row.target_record_id.slice(0, 8)}…` : ""}</small></td><td><span className={`audit-pill ${row.outcome}`}>{row.outcome}</span></td><td><span className={`audit-pill ${row.severity}`}>{row.severity.replace("_", " ")}</span></td><td><Link className="audit-detail-link" href={`/audit-logs/${row.id}?${scopeQuery}`} aria-label={`View ${row.event_type} details`}><ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div> : <div className="audit-inline-empty">{loading ? "Loading records…" : "No audit records match these filters."}</div>}
    {list && list.pages > 1 && <div className="audit-pagination"><button className="button button-secondary" onClick={() => onPage(list.page - 1)} disabled={list.page <= 1 || loading}><ChevronLeft size={14} /> Previous</button><span>Page {list.page} of {list.pages}</span><button className="button button-secondary" onClick={() => onPage(list.page + 1)} disabled={list.page >= list.pages || loading}>Next <ChevronRight size={14} /></button></div>}
  </section>;
}
function DetailView({ record, scopeQuery, loading }: { record: AuditLogRecord | null; scopeQuery: string; loading: boolean }) {
  if (loading && !record) return <div className="audit-state"><RefreshCw size={16} className="audit-spin" /><div><strong>Loading audit record</strong></div></div>;
  if (!record) return <div className="audit-empty"><FileSearch size={22} /><strong>Load an authorized scope to open this event</strong><span>Record IDs are resolved only inside the selected scope.</span><Link href={`/audit-logs?${scopeQuery}`}>Back to audit logs</Link></div>;
  const details = record.change_details;
  const previous = details?.previous && typeof details.previous === "object" ? details.previous as Record<string, unknown> : {};
  const next = details?.new && typeof details.new === "object" ? details.new as Record<string, unknown> : {};
  const fields = Array.isArray(details?.fields) ? details.fields.map(String) : Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));
  return <section className="audit-card audit-detail-card"><div className="audit-detail-top"><div><Link href={`/audit-logs?${scopeQuery}`} className="audit-back"><ChevronLeft size={15} /> Back to records</Link><div className="eyebrow">{record.source_module} · {record.event_type}</div><h2>{record.change_summary || record.action}</h2><p>{humanDate(record.created_at)}</p></div><span className={`audit-pill ${record.severity}`}>{record.severity.replace("_", " ")}</span></div>
    <dl className="audit-detail-facts">{[["Actor",record.actor_display_name || record.actor_user_id || "System / unavailable"],["Action",record.action],["Outcome",record.outcome],["Organization",record.organization_id || "Platform scope"],["Community",record.community_id || "Organization-wide"],["Target",`${record.target_record_type ?? "—"}${record.target_record_id ? ` · ${record.target_record_id}` : ""}`],["Request ID",record.request_id || "Not available"]].map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    <h3>Before and after</h3>{fields.length ? <div className="audit-change-table"><div className="audit-change-head"><span>Field</span><span>Previous value</span><span>New value</span></div>{fields.map((field) => <div key={field}><strong>{field}</strong><code>{field in previous ? JSON.stringify(previous[field]) : "—"}</code><code>{field in next ? JSON.stringify(next[field]) : "—"}</code></div>)}</div> : <p className="audit-inline-empty">This event has no field-level snapshots. Private message contents and free-form personal submissions are never included.</p>}
    {record.metadata && <details className="audit-technical"><summary>Structured event metadata</summary><pre>{JSON.stringify(record.metadata, null, 2)}</pre></details>}
  </section>;
}
