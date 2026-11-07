# RLS policy matrix

All policies depend on verified Supabase Auth identity. `auth.uid()` is the only user identity source. A selected organization cookie or client payload is never used as authorization.

| Ownership/table family | Read | Insert/update/delete | Tenant check |
|---|---|---|---|
| `organizations` | Active members; platform admin | Platform admin; organization admin for updates | `is_active_org_member(id)` / `is_org_admin(id)` |
| `organization_memberships`, `organization_settings`, `organization_domains` | Active organization members | Organization admins | `organization_id` and active organization status |
| `communities` | Active organization members | Organization admins | `organization_id` |
| Community records (`community_memberships`, applications, committees, events, content, publications, resources, announcements, conversations) | Active organization members plus parent community check | Organization admins plus parent community check | `organization_id` + `community_belongs_to_org()` |
| Child records (reviews, documents, committee children, event registrations, revisions, conversation children, messages) | Authorized parent tenant | Authorized parent tenant; admin where mutation is administrative | Parent lookup resolves organization before access |
| `user_profiles` | Own profile, shared active-organization profiles, platform admin | Own profile only | `can_view_profile(id)` |
| Roles and permissions | Platform admin | Reserved for platform administration | Verified platform claim/role |
| `user_role_assignments` | Organization admin | Organization admin and valid organization membership | Composite `(organization_id, user_id)` plus role scope |
| `notifications` | Recipient in active organization | Recipient for read state | `user_id = auth.uid()` |
| `audit_logs` | Platform admin or active organization member | No public client insert policy | Organization context; writes should use trusted server path |

## Policy invariants

- RLS is enabled on all tenant-owned tables.
- No policy grants unrestricted access to `anon` or `authenticated`.
- `WITH CHECK` repeats the ownership condition for writes.
- Community policies verify the community's parent organization.
- `security definer` helper functions set `search_path = public` and use `auth.uid()`.
- Platform administration is not inferred from organization selection.

Authentication, JWT claim configuration and end-to-end policy execution are intentionally deferred to Step 19.
