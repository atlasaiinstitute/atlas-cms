# Step 07 — Member Management

ATLAS now treats `user_profiles` as the central person record and keeps organization and community relationships in the existing `organization_memberships` and `community_memberships` tables. A person may therefore have many organization memberships and many community memberships without duplicating their profile.

## Security boundary

All live service methods require an organization context before querying. Organization and community IDs are constrained server-side, community memberships inherit the composite `(community_id, organization_id)` relationship, and the migration adds RLS policies for membership history and administrative profile changes. Administrative notes are stored on membership rows and are not rendered in member-facing profile views.

The current UI uses clearly labeled development fixtures when Supabase/Auth are not configured, matching the previous modules. Authentication is not implemented in Step 07. In Step 19, an admin-created profile must be linked to a verified `auth.users.id` (the current `user_profiles.id` bridge), and all server actions must derive the actor from `auth.uid()` rather than from form data. Existing RLS helpers (`is_active_org_member`, `is_org_admin`, `community_belongs_to_org`) remain the source of truth.

## Import/export

The directory UI provides CSV export of the currently filtered, tenant-scoped result. The import panel validates CSV structure, required name/email fields, duplicate emails, and reports row-level failures before confirmation; it never silently overwrites profiles or memberships. Live insertion should be wired to the same `createMemberProfile` service after Auth is available.

## Known limitation

Supabase's current schema intentionally requires a profile ID to reference `auth.users`. Therefore profile creation remains an authenticated-admin integration point until Step 19 provisions or links the Auth identity. No password, login, registration, or activation state is created by Step 07.
