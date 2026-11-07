# Step 20 — Public Website & Private Workspace Architecture

## Delivered

The root URL is now a public institutional website for the default active organization. It includes organization branding, public navigation, a prominent Login button, a professional homepage, About, Activities, Publications, public Events, public Resources, and Contact views. Anonymous visitors are not redirected to a dashboard and no Register/Sign Up link is shown in public navigation.

Public data is derived from the existing organization, community, content, events, announcements, and resources fixtures and contracts. The projection filters to active organizations and communities, published content, published public announcements, published/registration-open events, and published resources with `visibility = public`. Draft, private, member-only, under-review, scheduled, archived, and internal records are excluded.

The public site supports organization slug resolution and a host-resolution helper that only matches active organizations and their configured website host. The public API endpoint is tenant-scoped at `/api/public/site/[slug]`. Interactive actions remain represented as protected actions, while `/login` explains the future authentication boundary. Direct registration is blocked by default both in the UI and at `/api/public/register` with an explicit 403 response and onboarding guidance.

The administrator workspace now includes `/settings/public-access`, a central access policy screen with secure defaults for public website, browsing, registration, membership applications, comments, reactions, messaging, posting, event registration, public profiles, public resource downloads, public community pages, and disabled features. The settings surface clearly states that login alone never grants edit or administrative privileges.

## Database changes

`supabase/migrations/20261107010000_public_website_access.sql` adds `organization_public_access_settings`, `organization_public_navigation`, public website flags and slugs on organizations, indexes, and RLS policies. The policies constrain anonymous reads to enabled public website settings/navigation and constrain management to a verified organization role assignment. Existing source table RLS and explicit published/public predicates remain required for content projections.

## Route separation

Public routes: `/`, `/about`, `/activities`, `/publications`, `/events-public`, `/resources-public`, `/contact`, `/login`, `/register`, and `/:slug` for organization websites. Existing dashboard and module routes remain available at `/dashboard`, `/organizations`, `/communities`, `/members`, `/applications`, `/governance`, `/events`, `/content`, `/resources`, `/announcements`, `/messages`, `/analytics`, `/audit-logs`, and `/settings`. The public event/resource aliases avoid breaking those existing workspace paths in this foundation build.

## Security tests performed

`tests/public-access.test.cjs` verifies that public projections require published/public/active predicates, public registration defaults to disabled, protected actions are explicit, tenant resolution supports slug/host matching, and the registration API returns a 403 guard response. Typecheck/build validation is also run before delivery.

## Remaining limitations

Supabase Auth session provisioning, verified claims, live database repositories, and live RLS integration against a deployed database remain the next authentication implementation dependency, as required by the source prompt. The settings workspace currently demonstrates the policy contract and local state but does not persist changes until authenticated Supabase repositories are connected. Custom-domain DNS/SSL provisioning also remains provider work; the tenant resolution helper is ready for the verified-domain table.

## Expanded transparency requirement update

The public navigation now includes About, Leadership, Governance, Activities, Projects, Education, Research & Publications, Notices, Events, Communities, and Contact, with dropdown groupings for work and people/governance. The administrator access workspace includes a public navigation manager for rename, enable/disable, and reorder behavior.

Public governance is projected from active committee records. Public communities are projected only from active communities explicitly marked `public`. Public notices use published public announcements. Education content is restricted to already published content that is explicitly categorized as education or belongs to a public education community; learner enrollment, progress, and personal learning records are not projected.

The current source model does not contain a dedicated projects/initiatives module or an approved public leadership profile/appointment projection. The new public Projects and Leadership pages therefore show an explicit source-availability notice instead of inventing records or exposing private member data. This is recorded as a missing source capability for a future module step.
