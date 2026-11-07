-- ATLAS CMS Step 06: community management extension.
-- Reuses communities, user_role_assignments and audit_logs; no duplicate admin or audit table.

alter table public.communities add column if not exists short_description text;
alter table public.communities add column if not exists community_type text;
alter table public.communities add column if not exists focus_area text;
alter table public.communities add column if not exists geographic_coverage text;
alter table public.communities add column if not exists primary_language text not null default 'en';
alter table public.communities add column if not exists additional_languages jsonb not null default '[]'::jsonb;
alter table public.communities add column if not exists contact_email text;
alter table public.communities add column if not exists website text;
alter table public.communities drop constraint if exists communities_status_check;
alter table public.communities add constraint communities_status_check check (status in ('draft', 'pending', 'active', 'suspended', 'archived'));
alter table public.communities drop constraint if exists communities_membership_type_check;
alter table public.communities add constraint communities_membership_type_check check (membership_type in ('open', 'application', 'invitation', 'administrator_approval'));
create index if not exists communities_org_status_idx on public.communities (organization_id, status, created_at desc);
create index if not exists communities_org_type_idx on public.communities (organization_id, community_type);
create index if not exists user_role_assignments_community_role_idx on public.user_role_assignments (organization_id, community_id, role_id, user_id);

-- Community administrators are organization-scoped role assignments. This index supports
-- one current administrator assignment per role and makes the relationship auditable.
create index if not exists community_admin_assignments_idx on public.user_role_assignments (community_id, user_id) where community_id is not null;

-- Storage paths must begin with organizations/{organization_id}/communities/{community_id}/.
-- These policies are inert until Supabase Storage and authenticated sessions are configured.
create policy community_assets_select on storage.objects for select using (
  bucket_id = 'organization-assets' and (storage.foldername(name))[1] = 'organizations'
  and public.is_active_org_member(((storage.foldername(name))[2])::uuid)
  and exists (select 1 from public.communities c where c.id = ((storage.foldername(name))[4])::uuid and c.organization_id = ((storage.foldername(name))[2])::uuid)
);
create policy community_assets_insert on storage.objects for insert with check (
  bucket_id = 'organization-assets' and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_admin(((storage.foldername(name))[2])::uuid)
  and exists (select 1 from public.communities c where c.id = ((storage.foldername(name))[4])::uuid and c.organization_id = ((storage.foldername(name))[2])::uuid)
);
create policy community_assets_update on storage.objects for update using (
  bucket_id = 'organization-assets' and public.is_org_admin(((storage.foldername(name))[2])::uuid)
) with check (bucket_id = 'organization-assets' and public.is_org_admin(((storage.foldername(name))[2])::uuid));
create policy community_assets_delete on storage.objects for delete using (
  bucket_id = 'organization-assets' and public.is_org_admin(((storage.foldername(name))[2])::uuid)
);

comment on table public.communities is 'Tenant-owned community. Every row belongs to exactly one organization; Step 06 extends profile, policy and branding metadata.';
