# Community Management Module

Step 06 adds organization-scoped Community Management at:

- `/communities` — searchable, filterable table/grid overview
- `/communities/new` — validated creation workflow
- `/communities/[id]` — tabbed detail workspace
- `/communities/[id]/settings` — direct settings entry point

## Data model

The module extends the existing `communities` table rather than creating a duplicate. The incremental migration adds profile metadata, validated lifecycle values, membership-policy values, language fields, contact details and indexes. Community administrators reuse `user_role_assignments` with a `community_id`; organization membership is enforced by the Step 05 composite relationship and RLS policy layer. Activity uses the existing `audit_logs` architecture.

## Tenant security

The authenticated repository functions in `src/services/communities.ts` require a `TenantActor`, resolve the parent organization through `requireOrganizationAccess()`, require organization administration for creation, and scope returned rows through the centralized tenant helpers. Browser organization selection is never treated as proof of access.

The route preview uses explicitly named development fixtures because authentication and live Supabase credentials are not configured. It does not replace the protected repository path. Step 19 must bind the authenticated session to `TenantActor` and exercise the live RLS policies.

## Branding storage

Assets use `organizations/{organization_id}/communities/{community_id}/{file}` in the `organization-assets` bucket. The migration includes Storage policies that validate active organization membership or administrator access and verify the community belongs to the path organization. The service validates PNG/JPG/WEBP/SVG types and a 2 MB limit.
