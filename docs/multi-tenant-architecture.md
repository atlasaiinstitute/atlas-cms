# ATLAS CMS multi-tenant architecture

## Ownership hierarchy

ATLAS has three explicit ownership levels:

1. **Platform** — global configuration, platform administration, shared taxonomy and system-wide resources. Platform capabilities are represented by verified Supabase JWT application metadata and platform-scoped roles; they are not granted by a browser-selected organization.
2. **Organization** — the tenant boundary. Organizations, organization memberships, settings, domains, organization roles, audit records and organization-level content carry `organization_id`.
3. **Community** — a child scope inside one organization. Communities carry both their own `organization_id` and community-owned records carry `community_id` plus `organization_id`.

A community ID is never sufficient on its own for a tenant query. Composite foreign keys in `20261106190000_multi_tenant_isolation.sql` ensure that a child cannot pair a community from Organization B with an Organization A row.

## Organization context

`src/lib/tenant/context.ts` is the centralized application contract. It provides:

- `getSelectedOrganizationId()` — reads the navigation context cookie only; it does not authorize access.
- `getOrganizationContext()` — resolves the selected organization against an authenticated actor and the server-side organization record.
- `requireOrganizationAccess()` — rejects missing membership, non-active membership, and unavailable organization states.
- `requireOrganizationAdmin()` — gates organization administration.
- `validateTenantOwnership()` — checks organization and community ownership before mutations.
- `getOrganizationScopedQuery()` and `getCommunityScopedQuery()` — reusable server-side scoping helpers.

The sidebar switcher writes only a selected context value. It is intentionally limited to development fixture memberships and cannot grant access. A future authenticated adapter must populate `TenantActor` from the verified session and database memberships.

## Data access rules

Feature repositories belong under `src/services`. A repository must resolve a server-side `OrganizationContext` before selecting or mutating tenant data. Client-provided organization IDs are selectors, not proof of membership. Supabase RLS is the final enforcement layer even if an application service is bypassed.

## Lifecycle handling

`active` organizations permit normal operations. `pending`, `suspended`, `inactive`, and `archived` organizations require explicit workflow handling. The server context rejects normal tenant operations for unavailable states; platform administrators may still perform explicitly permitted lifecycle actions.

## Authentication dependency

Authentication is deliberately not implemented in Step 05. The RLS helpers use `auth.uid()` and verified JWT `app_metadata`; they do not create anonymous fallbacks. Step 19 must connect the application session to `TenantActor`, configure Supabase Auth, validate claims, and integration-test the policies with real users.
