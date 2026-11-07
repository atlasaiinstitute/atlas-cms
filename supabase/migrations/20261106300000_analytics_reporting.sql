-- ATLAS CMS Step 16: Analytics & Reporting.
-- Analytics is derived from operational records; no duplicate event warehouse is created.

insert into public.permissions(key, name, description) values
  ('analytics.platform.view', 'View platform analytics', 'View privacy-safe aggregate platform analytics.'),
  ('analytics.organization.view', 'View organization analytics', 'View analytics for an authorized organization.'),
  ('analytics.community.view', 'View community analytics', 'View analytics for an authorized community.'),
  ('analytics.reports.create', 'Create analytics reports', 'Save authorized report configurations.'),
  ('analytics.reports.export', 'Export analytics reports', 'Export authorized aggregate reports.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

create or replace function public.can_view_analytics(
  target_org uuid,
  target_community uuid,
  target_module text
) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  allowed_community boolean;
begin
  if auth.uid() is null then return false; end if;
  if target_org is null then
    return target_community is null and target_module = 'platform' and public.is_platform_admin();
  end if;
  if target_module not in ('overview','organizations','communities','members','applications','events','governance','content','resources','engagement','messaging') then
    return false;
  end if;
  if not public.is_active_org_member(target_org) then return false; end if;
  if target_community is not null and not public.community_belongs_to_org(target_community, target_org) then return false; end if;
  if public.is_org_admin(target_org) then return true; end if;
  if target_community is null then return false; end if;
  if target_module in ('governance','messaging','engagement') then return false; end if;
  select exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.organization_id = target_org
      and ura.community_id = target_community
      and ura.assignment_scope = 'community'
      and ura.revoked_at is null
      and r.is_active = true
      and r.key = 'community_admin'
  ) into allowed_community;
  return coalesce(allowed_community, false);
end;
$$;

comment on function public.can_view_analytics(uuid,uuid,text) is
  'Server-side analytics scope check. Tenant scope is verified against active membership and explicit community-admin role assignments.';

create or replace function public.get_analytics_scopes()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'communities', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
          from public.communities c
          where c.organization_id = o.id
            and c.status = 'active'
            and public.can_view_analytics(o.id, c.id, 'overview')
        ), '[]'::jsonb)
      ) order by o.name)
      from public.organizations o
      where o.status = 'active'
        and (public.can_view_analytics(o.id, null, 'overview') or exists (
          select 1 from public.communities c
          where c.organization_id = o.id and c.status = 'active'
            and public.can_view_analytics(o.id, c.id, 'overview')
        ))
    ), '[]'::jsonb),
    'canViewPlatform', public.is_platform_admin()
  )
  where auth.uid() is not null;
$$;

comment on function public.get_analytics_scopes() is
  'Returns only active tenant scopes individually authorized for analytics overview access; performs scope discovery in one database round trip.';

create or replace function public.get_platform_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'platform analytics permission required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '2 years' then
    raise exception 'invalid analytics date range' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'organizations_total', (select count(*) from public.organizations),
    'organizations_active', (select count(*) from public.organizations where status = 'active'),
    'organizations_created_period', (select count(*) from public.organizations where created_at >= p_from and created_at < p_to),
    'communities_total', (select count(*) from public.communities),
    'communities_active', (select count(*) from public.communities where status = 'active'),
    'profiles_unique', (select count(distinct user_id) from public.organization_memberships),
    'organization_memberships_active', (select count(*) from public.organization_memberships where membership_status = 'active'),
    'community_memberships_active', (select count(*) from public.community_memberships where membership_status = 'active'),
    'applications_submitted_period', (select count(*) from public.membership_applications where submitted_at >= p_from and submitted_at < p_to),
    'applications_pending', (select count(*) from public.membership_applications where status in ('submitted','under_review','information_requested')),
    'applications_approved_period', (select count(*) from public.membership_applications where status = 'approved' and reviewed_at >= p_from and reviewed_at < p_to),
    'events_published_period', (select count(*) from public.events where status in ('published','registration_open','registration_closed','ongoing','completed') and created_at >= p_from and created_at < p_to),
    'events_upcoming', (select count(*) from public.events where status in ('published','registration_open','registration_closed') and starts_at >= now()),
    'content_published_period', (select count(*) from public.content_items where status = 'published' and published_at >= p_from and published_at < p_to),
    'resources_published_period', (select count(*) from public.resources where status = 'published' and published_at >= p_from and published_at < p_to),
    'announcements_published_period', (select count(*) from public.announcements where status = 'published' and published_at >= p_from and published_at < p_to),
    'generated_at', now()
  ) into result;
  return result;
end;
$$;

comment on function public.get_platform_analytics(timestamptz,timestamptz) is
  'Returns only aggregate, non-message-content platform metrics after a verified platform-admin claim check. Does not expose tenant names, personal data, or confidential governance records.';

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.user_profiles(id) on delete cascade,
  scope_level text not null check (scope_level in ('platform','organization','community')),
  organization_id uuid references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  report_type text not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((scope_level = 'platform' and organization_id is null and community_id is null)
      or (scope_level = 'organization' and organization_id is not null and community_id is null)
      or (scope_level = 'community' and organization_id is not null and community_id is not null))
);

create index if not exists saved_reports_owner_updated_idx on public.saved_reports(created_by, updated_at desc);
create index if not exists saved_reports_tenant_updated_idx on public.saved_reports(organization_id, community_id, updated_at desc);
create trigger saved_reports_set_updated_at before update on public.saved_reports
  for each row execute function public.set_updated_at();
alter table public.saved_reports enable row level security;
create policy saved_reports_select on public.saved_reports for select using (
  created_by = auth.uid() and public.can_view_analytics(organization_id, community_id, report_type)
);
create policy saved_reports_insert on public.saved_reports for insert with check (
  created_by = auth.uid() and public.can_view_analytics(organization_id, community_id, report_type)
);
create policy saved_reports_update on public.saved_reports for update using (
  created_by = auth.uid() and public.can_view_analytics(organization_id, community_id, report_type)
) with check (
  created_by = auth.uid() and public.can_view_analytics(organization_id, community_id, report_type)
);
create policy saved_reports_delete on public.saved_reports for delete using (created_by = auth.uid());

-- Date and tenant access paths for high-use aggregate queries.
create index if not exists organization_memberships_analytics_idx on public.organization_memberships(organization_id, created_at desc, membership_status);
create index if not exists community_memberships_analytics_idx on public.community_memberships(organization_id, community_id, created_at desc, membership_status);
create index if not exists membership_applications_analytics_idx on public.membership_applications(organization_id, community_id, created_at desc, status);
create index if not exists content_views_analytics_idx on public.content_view_events(organization_id, created_at desc);
create index if not exists resource_activity_analytics_idx on public.resource_activity_logs(organization_id, created_at desc, activity_type);
create index if not exists notifications_analytics_idx on public.notifications(organization_id, created_at desc, read_at);
create index if not exists messages_sent_at_analytics_idx on public.messages(sent_at desc);

revoke all on function public.get_platform_analytics(timestamptz,timestamptz) from public;
grant execute on function public.get_platform_analytics(timestamptz,timestamptz) to authenticated;
revoke all on function public.can_view_analytics(uuid,uuid,text) from public;
grant execute on function public.can_view_analytics(uuid,uuid,text) to authenticated;
revoke all on function public.get_analytics_scopes() from public;
grant execute on function public.get_analytics_scopes() to authenticated;
