# Tenant isolation controls

## Enforced boundaries

The Step 05 incremental migration strengthens isolation in four layers:

- **Foreign keys:** community-owned rows with both scope columns use `(community_id, organization_id)` references to `communities (id, organization_id)`.
- **Membership relationships:** community memberships and organization role assignments use `(organization_id, user_id)` references to organization memberships, preventing cross-tenant membership and role assignment.
- **Indexes:** organization/status/user and tenant target indexes support scoped queries and policy checks.
- **RLS:** tenant tables are enabled for row-level security. There are no unrestricted `anon` or blanket `authenticated` policies.

Child tables inherit access through their organization-owned parent: application reviews/documents, committee children, event registration/attendance, content revisions, resource access rules, conversation children and messages.

## Request flow

1. The verified session identifies the actor using `auth.uid()`.
2. The application resolves the selected organization as context only.
3. The server checks active organization membership and organization status.
4. Repository queries apply the resolved context.
5. PostgreSQL RLS independently checks membership/role and rejects bypasses.
6. For writes, composite relationships and RLS `WITH CHECK` clauses validate both the organization and any community parent.

## Suspended and archived tenants

Normal tenant operations require an active organization and active membership. Suspension or archival does not delete associated records. Platform-level lifecycle operations remain a separate permission path.

## Required Step 19 integration tests

With Supabase Auth configured, seed two organizations, two communities, distinct memberships and records. Execute the following as authenticated users:

- Organization A cannot select, update or delete Organization B records.
- A community-scoped request cannot read another organization's members/resources.
- A user without membership receives no private rows.
- Changing the selected organization cookie cannot bypass membership validation.
- Cross-tenant community foreign keys fail.
- Suspended organizations cannot perform normal writes.
- A verified platform administrator can perform only the explicit platform operations granted by policy.

The current sandbox has no PostgreSQL/Supabase credentials, so live RLS execution is pending Step 19. The local structural test validates the migration inventory and a deterministic in-memory model of these scenarios.
