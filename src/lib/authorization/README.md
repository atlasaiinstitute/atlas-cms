# Authorization boundary

Step 05 adds the centralized tenant authorization contract in `src/lib/tenant/context.ts`. Server-side repositories must resolve `OrganizationContext`, call `requireOrganizationAccess()` before reads or writes, use `requireOrganizationAdmin()` for administration, and validate community ownership before relationship changes.

The browser organization switcher changes navigation context only. It never grants access. PostgreSQL RLS in `supabase/migrations/20261106190000_multi_tenant_isolation.sql` remains the final enforcement layer and requires verified Supabase Auth identity and database-backed membership/role records.

Authentication is intentionally not implemented until Step 19.
