
## Step 06 — Community Management

Community Management is implemented at `/communities`, `/communities/new`, `/communities/[id]`, and `/communities/[id]/settings`. It includes organization-scoped directory views, search and filters, community metrics, validated creation fields, lifecycle controls, settings, administrator preparation, branding/storage validation, and clear member/activity empty states.

The existing `communities` table is extended incrementally by `supabase/migrations/20261106200000_community_management.sql`. Community administrators reuse `user_role_assignments`, audit activity reuses `audit_logs`, and branding uses organization-scoped Supabase Storage paths. Live writes and Storage operations require Supabase credentials and authenticated tenant actors; development fixtures are explicitly labeled until Step 19 authentication integration.

## Step 07 — Member Management
Member Management is implemented at `/members`, `/members/new`, `/members/[id]`, `/organizations/[id]/members`, and `/communities/[id]/members`. It adds centralized profile fields, organization/community membership workflows, tenant-scoped service methods, status and location filters, table/grid views, CSV export and import preview, profile pages, and the Step 07 migration. Authentication, passwords, login, and Auth provisioning remain intentionally deferred to Step 19. See `docs/member-management.md` and `STEP07_IMPLEMENTATION_REPORT.md`.

## Step 08 — Applications & Verification
Applications & Verification is implemented at `/applications`, `/applications/new`, `/applications/[id]`, `/applications/settings`, `/organizations/[id]/applications`, and `/communities/[id]/applications`. It reuses the existing application tables, adds structured form versions, status history, reviewer assignments, private document verification metadata, controlled status transitions, review workspace, submission wizard, workflow settings, CSV export, and notification abstractions. Authentication and external notification delivery remain deferred to Steps 19 and 14 respectively. See `docs/applications-verification.md` and `STEP08_IMPLEMENTATION_REPORT.md`.

## Step 09 — Roles & Permissions
Roles & Permissions is implemented at `/roles`, `/roles/new`, `/roles/[id]`, `/roles/[id]/edit`, and `/permissions`. It adds explicit platform, organization, and community scopes; protected system roles; custom role building; a centralized permission registry; tenant-aware role assignment services; deny-by-default permission evaluation; assignment history; and RLS preparation. Authentication remains deferred to Step 19. See `docs/roles-permissions.md` and `STEP09_IMPLEMENTATION_REPORT.md`.

## Step 10 — Committees & Governance
Committees & Governance is implemented at `/governance`, `/governance/committees`, `/governance/committees/new`, `/governance/committees/[id]`, `/governance/appointments`, `/governance/meetings`, and `/governance/decisions`. It reuses existing committee, appointment, meeting, minutes, resolution, audit, and tenant structures; adds configurable positions, terms, action items, governance documents, committee history, governance rules, private storage, and granular governance permissions. Authentication remains deferred to Step 19. See `docs/governance.md` and `STEP10_IMPLEMENTATION_REPORT.md`.

## Step 11 — Events Management
Events Management is implemented at `/events`, `/events/new`, `/events/[id]`, `/events/calendar`, `/events/[id]/registrations`, `/events/[id]/attendance`, `/organizations/[id]/events`, and `/communities/[id]/events`. It reuses and extends the existing event, registration, and attendance structures with lifecycle, guest registration, sessions, speakers, private resources, reports, feedback, configurable forms, and tenant-aware policies. Authentication remains deferred to Step 19. See `docs/events-management.md` and `STEP11_IMPLEMENTATION_REPORT.md`.

## Step 11 — Events Management
Events Management is implemented at `/events`, `/events/new`, `/events/[id]`, `/events/calendar`, `/events/[id]/registrations`, `/events/[id]/attendance`, `/organizations/[id]/events`, and `/communities/[id]/events`. It reuses and extends the existing event, registration, and attendance structures with lifecycle, guest registration, sessions, speakers, private resources, reports, feedback, configurable forms, and tenant-aware policies. Authentication remains deferred to Step 19. See `docs/events-management.md` and `STEP11_IMPLEMENTATION_REPORT.md`.

## Step 12 — Content Management System
Content Management is implemented at `/content`, `/content/new`, `/content/[id]`, `/content/[id]/edit`, `/content/review`, `/content/categories`, `/content/tags`, `/content/pages`, `/organizations/[id]/content`, and `/communities/[id]/content`. It reuses and extends the existing content tables with structured JSON editing, editorial workflow, revisions, categories, tags, page sections, private media, content types, discovery filters, and tenant-aware publishing policies. Authentication and reliable scheduling remain deferred. See `docs/content-management.md` and `STEP12_IMPLEMENTATION_REPORT.md`.

## Step 12 — Content Management System
Content Management is implemented at `/content`, `/content/new`, `/content/[id]`, `/content/[id]/edit`, `/content/review`, `/content/categories`, `/content/tags`, `/content/pages`, `/organizations/[id]/content`, and `/communities/[id]/content`. It reuses and extends the existing content tables with structured JSON editing, editorial workflow, revisions, categories, tags, page sections, private media, content types, discovery filters, and tenant-aware publishing policies. Authentication and reliable scheduling remain deferred. See `docs/content-management.md` and `STEP12_IMPLEMENTATION_REPORT.md`.

## Step 18 — White-label & Custom Domains

White-label and Custom Domains is implemented at `/settings/branding`, `/settings/domains`, `/settings/white-label`, `/organizations/[id]/settings/branding`, and `/organizations/[id]/settings/domains`. It adds tenant-scoped branding tokens, logo/favicon states, organization welcome-page controls, configuration-ready email identity, platform subdomain and custom-domain lifecycle UI, DNS TXT verification instructions, typed hostname/branding validation, and an actual live preview driven by the supported settings. The organization-scoped URLs use the existing `[id]` segment so they remain compatible with the current Next.js App Router.

Persistence is prepared by `supabase/migrations/20261107000000_white_label_custom_domains.sql`, with unique normalized hostnames, primary-domain protection, verification/provisioning states, reserved subdomains, organization foreign keys, and Step 17 audit trigger coverage. DNS resolution, hosting-provider provisioning, SSL confirmation, Supabase Storage uploads, email sender verification, and authentication remain deployment/provider work; the preview labels these states as pending rather than claiming they are live. See `STEP18_IMPLEMENTATION_REPORT.md` for the implementation report and security boundaries.

## Step 20 — Public Website & Private Workspace Architecture

The platform now has a public institutional website layer at `/`, `/about`, `/activities`, `/publications`, `/events-public`, `/resources-public`, and `/contact`, with Login visible and public registration hidden by default. Public projections reuse existing CMS source records and exclude non-public, unpublished, member-only, private, and internal data. Organization slug/host resolution, the tenant-safe public read endpoint, registration guard, centralized access settings at `/settings/public-access`, and the Supabase/RLS preparation migration are included. See `STEP20_IMPLEMENTATION_REPORT.md` for the complete audit, security tests, and remaining authentication dependency.

The expanded transparency surface also includes `/leadership`, `/governance-public`, `/projects`, `/education`, `/notices`, and `/communities-public`, plus configurable public navigation controls for enable/disable, rename, and reorder. Governance, notices, communities, and approved education content reuse existing source modules. Projects and approved leadership profiles show explicit source-gap notices because those dedicated public source projections do not yet exist; no fake or private records are exposed.


## Deployment and Supabase setup

For manual deployment from the private GitHub repository, see [docs/deployment.md](docs/deployment.md). The current Supabase project, local environment setup, migration status, and API checks are documented in [docs/supabase-setup.md](docs/supabase-setup.md). Real credentials are never committed.
