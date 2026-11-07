-- ATLAS CMS Step 07: centralized member management.
-- Authentication is intentionally deferred to Step 19; policies are prepared for auth.uid().

alter table public.user_profiles add column if not exists phone text;
alter table public.user_profiles add column if not exists city text;
alter table public.user_profiles add column if not exists timezone text not null default 'UTC';
alter table public.user_profiles add column if not exists professional_bio text;
alter table public.user_profiles add column if not exists areas_of_expertise text[] not null default '{}';
alter table public.user_profiles add column if not exists professional_interests text[] not null default '{}';
alter table public.user_profiles add column if not exists website text;
alter table public.user_profiles add column if not exists linkedin_url text;
alter table public.user_profiles add column if not exists orcid text;
alter table public.user_profiles add column if not exists directory_visibility text not null default 'members' check (directory_visibility in ('public','members','private'));
alter table public.user_profiles add column if not exists preferred_contact_method text not null default 'email' check (preferred_contact_method in ('email','phone','none'));
alter table public.user_profiles add column if not exists profile_completion_status text not null default 'incomplete' check (profile_completion_status in ('incomplete','partial','complete'));

alter table public.organization_memberships drop constraint if exists organization_memberships_status_check;
alter table public.organization_memberships add constraint organization_memberships_status_check check (membership_status in ('pending','active','suspended','rejected','left','archived','invited'));
alter table public.organization_memberships add column if not exists membership_start_date date;
alter table public.organization_memberships add column if not exists membership_end_date date;
alter table public.organization_memberships add column if not exists administrative_notes text;
alter table public.organization_memberships add column if not exists archived_at timestamptz;
alter table public.organization_memberships add constraint organization_memberships_dates_check check (membership_end_date is null or membership_start_date is null or membership_end_date >= membership_start_date);

alter table public.community_memberships drop constraint if exists community_memberships_status_check;
alter table public.community_memberships add constraint community_memberships_status_check check (membership_status in ('pending','active','suspended','rejected','left','archived'));
alter table public.community_memberships add column if not exists membership_start_date date;
alter table public.community_memberships add column if not exists membership_end_date date;
alter table public.community_memberships add column if not exists administrative_notes text;
alter table public.community_memberships add column if not exists archived_at timestamptz;
alter table public.community_memberships add constraint community_memberships_dates_check check (membership_end_date is null or membership_start_date is null or membership_end_date >= membership_start_date);

create table if not exists public.membership_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  organization_membership_id uuid references public.organization_memberships(id) on delete cascade,
  community_membership_id uuid references public.community_memberships(id) on delete cascade,
  action text not null check (action in ('created','status_changed','updated','archived','removed','note_added')),
  from_status text,
  to_status text,
  notes text,
  changed_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (organization_membership_id is not null or community_membership_id is not null)
);

create index if not exists user_profiles_directory_idx on public.user_profiles (lower(full_name), lower(email), country, city);
create index if not exists organization_memberships_directory_idx on public.organization_memberships (organization_id, membership_status, membership_start_date desc);
create index if not exists community_memberships_directory_idx on public.community_memberships (organization_id, community_id, membership_status);
create index if not exists membership_history_member_idx on public.membership_history (organization_id, user_id, created_at desc);

alter table public.membership_history enable row level security;
create policy membership_history_access on public.membership_history for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy user_profiles_member_management on public.user_profiles for update using (public.is_platform_admin() or exists (select 1 from public.organization_memberships m where m.user_id = user_profiles.id and public.is_org_admin(m.organization_id))) with check (public.is_platform_admin() or exists (select 1 from public.organization_memberships m where m.user_id = user_profiles.id and public.is_org_admin(m.organization_id)));

comment on table public.membership_history is 'Append-only administrative history for organization and community memberships. Private notes remain administrator-only.';
comment on table public.user_profiles is 'Central profile record. Authentication account provisioning and auth.users linkage remain Step 19 responsibilities.';
