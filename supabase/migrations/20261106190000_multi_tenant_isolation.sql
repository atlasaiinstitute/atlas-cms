-- ATLAS CMS Step 05: multi-tenant integrity and RLS preparation.
-- Authentication is intentionally not implemented yet. Policies remain deny-by-default
-- unless a verified Supabase auth identity and membership/role record exists.

-- Stable composite references prevent a child row from pairing an organization with a
-- community owned by a different organization.
alter table public.communities drop constraint if exists communities_id_organization_key;
alter table public.communities add constraint communities_id_organization_key unique (id, organization_id);

alter table public.community_memberships drop constraint if exists community_memberships_community_org_fkey;
alter table public.community_memberships add constraint community_memberships_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.membership_applications drop constraint if exists membership_applications_community_org_fkey;
alter table public.membership_applications add constraint membership_applications_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.committees drop constraint if exists committees_community_org_fkey;
alter table public.committees add constraint committees_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.appointments drop constraint if exists appointments_community_org_fkey;
alter table public.appointments add constraint appointments_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.events drop constraint if exists events_community_org_fkey;
alter table public.events add constraint events_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.content_items drop constraint if exists content_items_community_org_fkey;
alter table public.content_items add constraint content_items_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.publications drop constraint if exists publications_community_org_fkey;
alter table public.publications add constraint publications_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.resources drop constraint if exists resources_community_org_fkey;
alter table public.resources add constraint resources_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.announcements drop constraint if exists announcements_community_org_fkey;
alter table public.announcements add constraint announcements_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.conversations drop constraint if exists conversations_community_org_fkey;
alter table public.conversations add constraint conversations_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;
alter table public.user_role_assignments drop constraint if exists user_role_assignments_community_org_fkey;
alter table public.user_role_assignments add constraint user_role_assignments_community_org_fkey foreign key (community_id, organization_id) references public.communities (id, organization_id) on delete cascade;

-- The initial migration already provides unique (organization_id, user_id), which
-- is reused by the composite membership foreign keys below.
alter table public.community_memberships drop constraint if exists community_memberships_org_user_fkey;
alter table public.community_memberships add constraint community_memberships_org_user_fkey foreign key (organization_id, user_id) references public.organization_memberships (organization_id, user_id) on delete cascade;
alter table public.user_role_assignments drop constraint if exists user_role_assignments_org_user_fkey;
alter table public.user_role_assignments add constraint user_role_assignments_org_user_fkey foreign key (organization_id, user_id) references public.organization_memberships (organization_id, user_id) on delete cascade;

create index if not exists organization_memberships_org_status_idx on public.organization_memberships (organization_id, membership_status, user_id);
create index if not exists user_role_assignments_org_user_idx on public.user_role_assignments (organization_id, user_id, community_id);
create index if not exists audit_logs_org_target_idx on public.audit_logs (organization_id, target_record_type, created_at desc);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'platform_admin', false) $$;

create or replace function public.is_active_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_org and m.user_id = auth.uid()
      and m.membership_status = 'active' and o.status = 'active'
  )
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    join public.organization_memberships m on m.organization_id = ura.organization_id and m.user_id = ura.user_id
    where ura.organization_id = target_org and ura.user_id = auth.uid()
      and m.membership_status = 'active' and r.scope in ('system', 'organization')
      and r.key in ('platform_admin', 'organization_admin', 'organization_manager')
  )
$$;

create or replace function public.community_belongs_to_org(target_community uuid, target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.communities where id = target_community and organization_id = target_org and status <> 'archived') $$;

create or replace function public.can_view_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin() or target_profile = auth.uid() or exists (
    select 1 from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and mine.membership_status = 'active'
      and theirs.user_id = target_profile and theirs.membership_status = 'active'
  )
$$;

-- Protected tables are enabled before policies are added. Any table omitted from a
-- future migration is therefore inaccessible through the API by default.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations','organization_memberships','organization_settings','organization_domains',
    'communities','community_memberships','membership_applications','application_reviews','application_documents',
    'committees','committee_members','committee_meetings','committee_minutes','committee_resolutions','appointments',
    'events','event_registrations','event_attendance','content_categories','content_items','content_revisions','publications',
    'resource_categories','resources','resource_access_rules','announcements','notifications','conversations','conversation_members',
    'messages','user_role_assignments','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
  alter table public.user_profiles enable row level security;
  alter table public.roles enable row level security;
  alter table public.permissions enable row level security;
  alter table public.role_permissions enable row level security;
end $$;

-- Organization-level records. No anon policy is intentionally provided.
create policy organizations_select on public.organizations for select using (public.is_platform_admin() or public.is_active_org_member(id));
create policy organizations_insert on public.organizations for insert with check (public.is_platform_admin());
create policy organizations_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy organizations_delete on public.organizations for delete using (public.is_platform_admin());
create policy organization_memberships_select on public.organization_memberships for select using (public.is_platform_admin() or public.is_active_org_member(organization_id));
create policy organization_memberships_write on public.organization_memberships for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy organization_settings_access on public.organization_settings for all using (public.is_org_admin(organization_id) or public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy organization_domains_access on public.organization_domains for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

-- Community-owned tables validate both parent organization membership and the composite relationship.
create policy communities_select on public.communities for select using (public.is_active_org_member(organization_id));
create policy communities_write on public.communities for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy community_memberships_access on public.community_memberships for all using (public.is_active_org_member(organization_id) and public.community_belongs_to_org(community_id, organization_id)) with check (public.is_org_admin(organization_id) and public.community_belongs_to_org(community_id, organization_id));
create policy membership_applications_access on public.membership_applications for all using (public.is_active_org_member(organization_id) and public.community_belongs_to_org(community_id, organization_id)) with check (public.is_org_admin(organization_id) and public.community_belongs_to_org(community_id, organization_id));
create policy committees_access on public.committees for all using (public.is_active_org_member(organization_id) and public.community_belongs_to_org(community_id, organization_id)) with check (public.is_org_admin(organization_id) and public.community_belongs_to_org(community_id, organization_id));
create policy events_access on public.events for all using (public.is_active_org_member(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id))) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy content_items_access on public.content_items for all using (public.is_active_org_member(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id))) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy publications_access on public.publications for all using (public.is_active_org_member(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id))) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy resources_access on public.resources for all using (public.is_active_org_member(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id))) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy announcements_access on public.announcements for all using (public.is_active_org_member(organization_id) and public.community_belongs_to_org(community_id, organization_id)) with check (public.is_org_admin(organization_id) and public.community_belongs_to_org(community_id, organization_id));
create policy conversations_access on public.conversations for all using (public.is_active_org_member(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id))) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy role_assignments_access on public.user_role_assignments for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));

-- Join/child records are reachable only through an already-authorized parent.
create policy user_profiles_access on public.user_profiles for select using (public.can_view_profile(id));
create policy user_profiles_update on public.user_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy platform_roles_access on public.roles for select using (public.is_platform_admin());
create policy platform_permissions_access on public.permissions for select using (public.is_platform_admin());
create policy platform_role_permissions_access on public.role_permissions for select using (public.is_platform_admin());
create policy audit_logs_access on public.audit_logs for select using (public.is_platform_admin() or (organization_id is not null and public.is_active_org_member(organization_id)));

comment on function public.is_active_org_member(uuid) is 'RLS helper: verified auth.uid membership and active organization status are required.';
comment on function public.is_org_admin(uuid) is 'RLS helper: verified auth.uid role assignment; never based on browser-supplied identity.';

-- Child records inherit authorization from their tenant-owned parent.
create policy application_reviews_access on public.application_reviews for all using (exists (select 1 from public.membership_applications a where a.id = application_id and public.is_active_org_member(a.organization_id))) with check (exists (select 1 from public.membership_applications a where a.id = application_id and public.is_org_admin(a.organization_id)));
create policy application_documents_access on public.application_documents for all using (exists (select 1 from public.membership_applications a where a.id = application_id and public.is_active_org_member(a.organization_id))) with check (exists (select 1 from public.membership_applications a where a.id = application_id and public.is_org_admin(a.organization_id)));
create policy committee_members_access on public.committee_members for all using (exists (select 1 from public.committees c where c.id = committee_id and public.is_active_org_member(c.organization_id))) with check (exists (select 1 from public.committees c where c.id = committee_id and public.is_org_admin(c.organization_id)));
create policy committee_meetings_access on public.committee_meetings for all using (exists (select 1 from public.committees c where c.id = committee_id and public.is_active_org_member(c.organization_id))) with check (exists (select 1 from public.committees c where c.id = committee_id and public.is_org_admin(c.organization_id)));
create policy committee_minutes_access on public.committee_minutes for all using (exists (select 1 from public.committee_meetings m join public.committees c on c.id = m.committee_id where m.id = meeting_id and public.is_active_org_member(c.organization_id))) with check (exists (select 1 from public.committee_meetings m join public.committees c on c.id = m.committee_id where m.id = meeting_id and public.is_org_admin(c.organization_id)));
create policy committee_resolutions_access on public.committee_resolutions for all using (exists (select 1 from public.committees c where c.id = committee_id and public.is_active_org_member(c.organization_id))) with check (exists (select 1 from public.committees c where c.id = committee_id and public.is_org_admin(c.organization_id)));
create policy appointments_access on public.appointments for all using (public.is_active_org_member(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id))) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy event_registrations_access on public.event_registrations for all using (exists (select 1 from public.events e where e.id = event_id and public.is_active_org_member(e.organization_id))) with check (exists (select 1 from public.events e where e.id = event_id and public.is_active_org_member(e.organization_id)));
create policy event_attendance_access on public.event_attendance for all using (exists (select 1 from public.events e where e.id = event_id and public.is_org_admin(e.organization_id))) with check (exists (select 1 from public.events e where e.id = event_id and public.is_org_admin(e.organization_id)));
create policy content_categories_access on public.content_categories for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy content_revisions_access on public.content_revisions for all using (exists (select 1 from public.content_items i where i.id = content_item_id and public.is_active_org_member(i.organization_id))) with check (exists (select 1 from public.content_items i where i.id = content_item_id and public.is_org_admin(i.organization_id)));
create policy resource_categories_access on public.resource_categories for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy resource_access_rules_access on public.resource_access_rules for all using (exists (select 1 from public.resources r where r.id = resource_id and public.is_active_org_member(r.organization_id))) with check (exists (select 1 from public.resources r where r.id = resource_id and public.is_org_admin(r.organization_id)));
create policy notifications_access on public.notifications for select using (user_id = auth.uid() and public.is_active_org_member(organization_id));
create policy notifications_update on public.notifications for update using (user_id = auth.uid() and public.is_active_org_member(organization_id)) with check (user_id = auth.uid() and public.is_active_org_member(organization_id));
create policy conversation_members_access on public.conversation_members for all using (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_active_org_member(c.organization_id))) with check (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_org_admin(c.organization_id)));
create policy messages_access on public.messages for all using (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_active_org_member(c.organization_id))) with check (exists (select 1 from public.conversations c where c.id = conversation_id and public.is_active_org_member(c.organization_id) and sender_user_id = auth.uid()));
