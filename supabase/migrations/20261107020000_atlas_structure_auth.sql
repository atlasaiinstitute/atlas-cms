-- ATLAS CMS additive organization structure and secure member authentication.
-- No passwords are stored in this migration. Auth credentials belong only to Supabase Auth.

create table if not exists public.organization_member_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, key),
  unique (organization_id, name)
);

create table if not exists public.organization_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  position_group text not null default 'team' check (position_group in ('founder','advisory','coordination','representation','team')),
  description text,
  max_members integer not null default 1 check (max_members > 0),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, key),
  unique (organization_id, name)
);

create table if not exists public.organization_position_teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position_id uuid not null references public.organization_positions(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, position_id),
  unique (organization_id, key),
  unique (organization_id, name)
);

alter table public.organization_memberships add column if not exists position_id uuid references public.organization_positions(id) on delete restrict;
alter table public.organization_memberships add column if not exists category_id uuid references public.organization_member_categories(id) on delete restrict;
alter table public.community_memberships add column if not exists position_id uuid references public.organization_positions(id) on delete restrict;
alter table public.community_memberships add column if not exists category_id uuid references public.organization_member_categories(id) on delete restrict;

create table if not exists public.member_auth_provisioning (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null unique references public.organization_memberships(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  login_email text not null,
  provisioning_status text not null default 'pending' check (provisioning_status in ('pending','invited','active','suspended','revoked')),
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  provisioned_by uuid references auth.users(id) on delete set null,
  provisioned_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, login_email)
);

create index if not exists organization_positions_org_order_idx on public.organization_positions(organization_id, display_order, name);
create index if not exists organization_position_teams_position_idx on public.organization_position_teams(organization_id, position_id);
create index if not exists organization_membership_structure_idx on public.organization_memberships(organization_id, position_id, category_id);
create index if not exists member_auth_provisioning_org_status_idx on public.member_auth_provisioning(organization_id, provisioning_status);

alter table public.organization_member_categories enable row level security;
alter table public.organization_positions enable row level security;
alter table public.organization_position_teams enable row level security;
alter table public.member_auth_provisioning enable row level security;

drop policy if exists organization_member_categories_access on public.organization_member_categories;
create policy organization_member_categories_access on public.organization_member_categories for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists organization_positions_access on public.organization_positions;
create policy organization_positions_access on public.organization_positions for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists organization_position_teams_access on public.organization_position_teams;
create policy organization_position_teams_access on public.organization_position_teams for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists member_auth_provisioning_admin_manage on public.member_auth_provisioning;
drop policy if exists member_auth_provisioning_member_select on public.member_auth_provisioning;
create policy member_auth_provisioning_admin_manage on public.member_auth_provisioning for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy member_auth_provisioning_member_select on public.member_auth_provisioning for select using (auth_user_id = auth.uid());

create or replace function public.mark_my_password_changed()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  update public.member_auth_provisioning p
  set must_change_password = false,
      password_changed_at = coalesce(p.password_changed_at, timezone('utc', now())),
      provisioning_status = case when p.provisioning_status in ('pending','invited') then 'active' else p.provisioning_status end,
      updated_at = timezone('utc', now())
  where p.auth_user_id = current_user_id
    and exists (select 1 from public.organization_memberships m where m.id = p.membership_id and m.user_id = current_user_id and m.membership_status = 'active');
  if not found then raise exception 'No active member authentication record found'; end if;
end;
$$;
revoke all on function public.mark_my_password_changed() from public;
revoke all on function public.mark_my_password_changed() from anon;
grant execute on function public.mark_my_password_changed() to authenticated;

alter table public.organization_memberships enable row level security;
drop policy if exists organization_memberships_self_select on public.organization_memberships;
create policy organization_memberships_self_select on public.organization_memberships for select using (user_id = auth.uid());
alter table public.user_profiles enable row level security;
drop policy if exists user_profiles_self_select on public.user_profiles;
drop policy if exists user_profiles_self_update on public.user_profiles;
create policy user_profiles_self_select on public.user_profiles for select using (id = auth.uid());
create policy user_profiles_self_update on public.user_profiles for update using (id = auth.uid()) with check (id = auth.uid());

insert into public.organizations (name, slug, description, organization_type, status)
values
  ('Atlas AI Institute', 'atlas-ai-institute', 'Research, collaboration, and impact organization.', 'institute', 'active'),
  ('Atlas Global South AI Policy Coalition Committee', 'atlas-global-south-ai-policy-coalition-committee', 'Global South AI policy coalition committee.', 'coalition_committee', 'active')
on conflict (slug) do update set name = excluded.name, description = excluded.description, organization_type = excluded.organization_type, status = excluded.status;

insert into public.organization_member_categories (organization_id, key, name, description)
select o.id, c.key, c.name, c.description
from public.organizations o
cross join (values ('founding_members','Founding Members','Founding members of the organization.'), ('members','Members','Regular organization members.')) c(key,name,description)
where o.slug in ('atlas-ai-institute','atlas-global-south-ai-policy-coalition-committee')
on conflict (organization_id,key) do update set name=excluded.name, description=excluded.description, is_active=true;

insert into public.organization_positions (organization_id,key,name,position_group,description,max_members,display_order)
select o.id,p.key,p.name,p.position_group,p.description,p.max_members,p.display_order
from public.organizations o
cross join (values
 ('founding_director','Founding Director','founder','Leads the organization as founding director.',1,1),
 ('international_advisory_council_board','International Advisory Council Board','advisory','Provides international strategic advice and governance guidance.',11,2),
 ('international_adviser','International Adviser','advisory','Provides international subject-matter and policy advice.',15,3),
 ('regional_coordinator','Regional Coordinator','coordination','Coordinates regional programs, partnerships, and representatives.',15,4),
 ('country_representatives','Country Representatives','representation','Represents the organization at country level.',100,5),
 ('country_director','Country Director','representation','Leads country-level operations and engagement.',1,6),
 ('research_head','Research Head','team','Leads research priorities, programs, and outputs.',1,7),
 ('policy_head','Policy Head','team','Leads policy analysis, advocacy, and policy outputs.',1,8)
) p(key,name,position_group,description,max_members,display_order)
where o.slug in ('atlas-ai-institute','atlas-global-south-ai-policy-coalition-committee')
on conflict (organization_id,key) do update set name=excluded.name,position_group=excluded.position_group,description=excluded.description,max_members=excluded.max_members,display_order=excluded.display_order,is_active=true;

insert into public.organization_position_teams (organization_id,position_id,key,name,description)
select p.organization_id,p.id,p.key || '_team',p.name || ' Team','Team supporting the ' || p.name || ' position.'
from public.organization_positions p join public.organizations o on o.id=p.organization_id
where o.slug in ('atlas-ai-institute','atlas-global-south-ai-policy-coalition-committee')
on conflict (organization_id,position_id) do update set key=excluded.key,name=excluded.name,description=excluded.description,is_active=true;

comment on table public.member_auth_provisioning is 'Per-member login provisioning state. Passwords are managed only by Supabase Auth and never stored in ATLAS tables.';
comment on function public.mark_my_password_changed() is 'Called only after Supabase Auth password update succeeds; marks the current member password as changed.';
