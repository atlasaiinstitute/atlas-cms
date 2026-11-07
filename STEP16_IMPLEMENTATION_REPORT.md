# ATLAS CMS — Step 16 Implementation Report

## 1. Features implemented

Added a database-derived Analytics & Reporting module with a shared date/timezone filter, previous-equivalent-period comparison, KPI definitions and sources, module-specific trend series, status/mode/channel breakdowns, tenant-scoped report configurations, report preview, and CSV export. Analytics derives values from operational tables; it does not seed or fabricate dashboard data.

The dashboard distinguishes unique profile IDs from membership rows, registrations from recorded attendance, and announcement publication from recipient, notification, delivery-attempt, and read state. Governance and messaging insights are aggregate-only; message bodies and sender rankings are not queried or returned. Community-scope page views and resource activity are narrowed through community-owned content/resource IDs when event-log tables lack a community column.

## 2. Routes

- `/analytics` — overview
- `/analytics/platform` — protected platform aggregate
- `/analytics/organizations` and `/analytics/communities` — tenant-scoped operational summaries
- `/analytics/members`, `/analytics/applications`, `/analytics/events`, `/analytics/governance`, `/analytics/content`, `/analytics/resources`, `/analytics/engagement`, and `/analytics/messaging` — module dashboards
- `/analytics/reports`, `/analytics/reports/new`, and `/analytics/reports/[id]` — report centre, builder, and preview
- `/api/analytics`, `/api/analytics/scopes`, `/api/analytics/reports`, `/api/analytics/reports/[id]`, and `/api/analytics/reports/[id]/export` — authenticated, server-side endpoints

## 3. Metrics and data sources

Metrics use existing records and timestamps. Principal sources are `organizations`, `communities`, `organization_memberships`, `community_memberships`, `membership_applications`, `events`, `event_registrations`, `event_attendance`, committees and their linked meeting/action/resolution tables, `content_items`, `content_view_events`, `resources`, `resource_activity_logs`, `announcements`, `announcement_recipients`, `notifications`, `notification_delivery_logs`, `conversations`, and `messages`.

Each returned KPI includes its definition and source. Comparisons are only attached to selected period-based measures; current-state snapshots are explicitly defined as snapshots rather than period changes. Rates use explicit denominators and return null when the denominator is zero. Application processing time excludes missing, invalid, or negative intervals. Attendance rates use recorded attendance and eligible registrations for completed events only. Resource views and successful downloads are reported only from corresponding activity-log rows.

## 4. Reporting and export

Users can save named report configurations, choose a report module, authorized scope, date range/timezone, comparison setting, and metrics; reopen a live preview; update/delete their own saved report; and export CSV. The export includes report name, generation time, scope identifiers, date range, metric definitions, and data-source labels. CSV formula-leading values are neutralized and cells are quoted/escaped. Export re-runs the metrics against current data and rechecks access.

PDF generation, configurable table columns, and scheduled delivery are not implemented. No browser-timer or simulated scheduler is used. The project has no confirmed PDF/scheduling infrastructure in this environment.

## 5. Database and performance changes

Added `supabase/migrations/20261106300000_analytics_reporting.sql`. It adds analytics permissions, `can_view_analytics`, a permission-checked platform aggregate RPC, one-call authorized scope discovery, owner-scoped `saved_reports` with RLS, and indexes for high-use tenant/timestamp queries. Analytics does not duplicate the operational database into a warehouse.

The migration could not be applied to a remote/local Supabase database in this task environment: no Supabase URL/anon key or linked project was configured. Apply the migration before using live analytics endpoints. The implementation uses exact PostgREST counts for direct table metrics; some linked child-record calculations retrieve scoped ID lists and should be load-tested against production-scale tenant sizes.

## 6. Security and tenant isolation

Every analytics request requires an authenticated development identity and calls `can_view_analytics` server-side. Organization/community IDs are revalidated by the database function and also used as explicit query filters. Community roles are limited to individually assigned community scopes and cannot access governance, messaging, engagement, or platform analytics. Platform results are returned only by a guarded aggregate RPC and omit tenant names, governance details, and message content. Saved reports are owner-scoped and reauthorized at preview/export time. Responses are private and non-cacheable.

Structural tests cover scope authorization, report ownership/RLS, tenant filters, message-body exclusion, community content-view scoping, CSV formula injection, and single-call scope discovery. These tests do not replace a live Supabase/RLS integration test.

## 7. Checks run

- `npm run test:analytics` — passed (9 deterministic and structural checks).
- `npm run test:tenant` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed; Next.js compiled the analytics pages and API routes along with existing routes.

No remote migration or authenticated end-to-end database test was possible in this environment.

## 8. Known limitations

- Live values require the Step 16 migration, a configured Supabase project, and a signed-in authorized identity; this task environment had no Supabase configuration.
- Category/type author-contribution breakdowns, reviewer workload, geographic/language distribution, retention, attachments, scheduled reports, and PDF export are not represented as complete features. Avoid interpreting absent metrics as zero.
- Community administrators are intentionally denied governance, messaging, and engagement analytics in this release; their authorized overview and module metrics remain scoped to the selected community.
- Linked child-table aggregates use scoped ID lists (with a 10,000-row fetch ceiling in helper queries); production-scale loads above that ceiling need a database-side aggregate or paginated strategy before they can be considered complete.
- Existing authentication remains deferred to Step 19; analytics relies on the existing development identity mechanism and prepared Supabase authorization/RLS.
- A temporary preview server is available on port 3000 for inspection. It is not a permanent production release; without Supabase configuration, analytics API data will not load. Production publication should wait for Supabase credentials, migration application, and the application's deferred authentication work.
- Resolved Next.js runtime route conflicts by aligning community and organization nested dynamic-route segment names, then regenerated the route manifest and verified the build and HTTP page responses.
- Restored the missing shared Atlas shell stylesheet (theme tokens, system typography, responsive navigation/layout, and common controls); confirmed the CSS asset and analytics route return HTTP 200 and visually checked the repaired preview.

Step 16 only was implemented. Step 17 was not started.
