# Audit logs and activity tracking — Step 17

## Design

This feature extends the existing `public.audit_logs` table instead of maintaining a duplicate event store. The incremental migration `supabase/migrations/20261106310000_audit_logs_activity_tracking.sql` adds typed event/outcome/severity fields, safe field-change snapshots, tenant-aware indexes, audit export metadata, and configurable retention metadata. A PostgreSQL `AFTER INSERT OR UPDATE OR DELETE` trigger writes allowlisted audit records inside the same transaction as selected operational-table changes. If event creation fails, the triggering business transaction also fails.

Tracked high-value tables cover organizations and settings, communities, memberships, application state changes, roles and role assignments, committees and appointments, events and attendance, CMS content/publications, resources and versions, announcements, notification templates, conversations, messages, and message moderation reports. Event categories are derived from the source module and operation/status; a database flag distinguishes administrative changes from newly submitted applications, event registrations, and ordinary user messages. History tables that duplicate the primary status update are intentionally not attached as separate triggers. There are no Atlas-specific tenant or event rows seeded by the feature.

Change details are allowlisted per table. Complete database rows, password/token fields, applicant submissions, private message bodies, message attachments, free-form review notes, and confidential content are not copied into audit snapshots. Message create/edit/delete events retain only the fact that the operation occurred and explicitly omit the message contents. Deleted actors and tenant identifiers remain as historical UUID references rather than being erased via cascading foreign-key updates.

## Routes

- `/audit-logs` — dashboard totals, module distribution, daily trend, recent sensitive changes.
- `/audit-logs/platform` — platform-only log scope.
- `/audit-logs/organizations` and `/audit-logs/communities` — organization/community filtered tables.
- `/audit-logs/security` — rows explicitly classified with a `security.` event type; ordinary access denials are not automatically called malicious.
- `/audit-logs/administrative` — role, audit-settings, and platform administration source modules.
- `/audit-logs/[id]` — authorized record detail and redacted before/after display.
- `/audit-logs/reports` — authorized CSV/JSON streaming export; export creation is itself recorded.
- `/audit-logs/settings` — controlled retention-policy metadata with a 365-day minimum.
- `/api/audit-logs`, `/dashboard`, `/[id]`, `/export`, and `/settings` — server-side, private/no-store interfaces that validate the session, scoped permission, filters, and pagination.

## Authorization and storage controls

All API requests require a verified Supabase session (`auth.getUser()`) and `can_view_audit_logs` checks the database identity against explicit role-permission assignments and the requested tenant/community. A verified denial to an audit endpoint is recorded as a neutral `security.audit_access_denied` warning; repeated denials by the same actor for the same audit permission are throttled to one per minute. This records only observable audit-module access denials; it is not attack detection, and ordinary failures elsewhere in the application are not claimed as monitored. Platform-level rows are limited to the platform-admin claim. Organization- and community-level reads are scoped in both the service query and RLS policy. Sensitive change JSON and technical metadata are returned only after a separate `audit_logs.view_sensitive` check. Security records require `audit_logs.view_security`; export requires `audit_logs.export`; retention configuration requires `audit_logs.retention.manage`.

Authenticated clients receive read-only SQL grants for `audit_logs`; there is no direct client insert/update/delete policy or grant. An append-only trigger rejects update and delete operations. Business-table audit triggers and retention/export audit logging run with trusted database functions. This is an application/database-role control, not independently tamper-proof storage: database owners, superusers, infrastructure administrators, backup operators, and privileged migrations can still alter or remove records. No hash chain, external write-once archive, or blockchain guarantee is claimed.

## Retention, exports, and known gaps

Retention settings are auditable configuration only. There is no automated scheduler, archive process, legal-hold engine, or purge job in this project. The database blocks configured retention below 365 days. Exports are streamed to an authorized browser request, include a small metadata envelope, cap at 5,000 rows, neutralize spreadsheet formula-leading values, and are not persisted server-side. PDF export is not implemented.

The existing application still defers authentication integration until Step 19. No Supabase URL/key or linked database was present during Step 17, so this migration could not be remotely applied and live RLS behavior could not be tested here. The SQL migration defines transaction-coupled capture, but coverage is limited to the listed operational tables; failed writes blocked before a database trigger, proxy/network failures, and external infrastructure events are not recorded. System/privileged writes without `auth.uid()` may have a null actor. Dashboard counts describe stored audit records only; no fabricated risk score or threat detection is provided.
