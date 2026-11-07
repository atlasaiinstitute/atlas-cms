-- ATLAS CMS Step 09: centralized tenant-aware RBAC.
-- Authentication remains deferred to Step 19; policies resolve auth.uid() when available.

alter table public.roles add column if not exists is_system boolean not null default false;
alter table public.roles add column if not exists is_active boolean not null default true;
alter table public.roles add column if not exists created_by uuid references public.user_profiles(id) on delete set null;
alter table public.roles add column if not exists delegation_scope jsonb not null default '{}'::jsonb;
create unique index if not exists roles_scope_key_uidx on public.roles(scope, key);
create index if not exists roles_scope_active_idx on public.roles(scope, is_active, name);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_id, role_id);

alter table public.user_role_assignments add column if not exists assignment_scope text not null default 'organization' check (assignment_scope in ('organization','community'));
alter table public.user_role_assignments add column if not exists revoked_at timestamptz;
alter table public.user_role_assignments add constraint user_role_assignments_scope_check check ((assignment_scope = 'community' and community_id is not null) or (assignment_scope = 'organization' and community_id is null));
create index if not exists user_role_assignments_effective_idx on public.user_role_assignments(user_id, organization_id, community_id, revoked_at);

create table if not exists public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.user_profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, role_id)
);
create table if not exists public.role_assignment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  community_id uuid references public.communities(id) on delete set null,
  target_user_id uuid not null references public.user_profiles(id) on delete cascade,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  role_id uuid not null references public.roles(id) on delete cascade,
  action text not null check (action in ('assigned','changed','revoked','delegated','denied')),
  scope text not null check (scope in ('platform','organization','community')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists role_assignment_history_target_idx on public.role_assignment_history(target_user_id, created_at desc);
create index if not exists role_assignment_history_tenant_idx on public.role_assignment_history(organization_id, community_id, created_at desc);

insert into public.permissions (key, name, description) values
('platform.roles.manage','Manage platform roles','Manage explicit platform role assignments.'),
('organization.view','View organization','View permitted organization records.'),('organization.update','Update organization','Edit organization profile.'),('organization.settings.manage','Manage organization settings','Manage tenant settings.'),('organization.members.view','View organization members','View organization members.'),('organization.members.invite','Invite organization members','Invite members.'),('organization.members.manage','Manage organization members','Add, update, archive memberships.'),('organization.roles.manage','Manage organization roles','Assign organization roles.'),('organization.analytics.view','View organization analytics','View organization insights.'),
('community.view','View community','View permitted community records.'),('community.create','Create community','Create communities.'),('community.update','Update community','Edit community.'),('community.archive','Archive community','Archive community.'),('community.members.view','View community members','View community members.'),('community.members.manage','Manage community members','Manage community memberships.'),('community.settings.manage','Manage community settings','Manage community settings.'),
('applications.view','View applications','View applications.'),('applications.review','Review applications','Review submissions.'),('applications.assign','Assign applications','Assign reviewers.'),('applications.approve','Approve applications','Approve applications.'),('applications.reject','Reject applications','Reject applications.'),('applications.documents.verify','Verify application documents','Verify application documents.'),
('content.view','View content','View content.'),('content.create','Create content','Create content.'),('content.update','Update content','Edit content.'),('content.publish','Publish content','Publish content.'),('content.delete','Delete content','Delete content.'),('events.view','View events','View events.'),('events.create','Create events','Create events.'),('events.update','Update events','Edit events.'),('events.publish','Publish events','Publish events.'),('events.cancel','Cancel events','Cancel events.'),('resources.view','View resources','View resources.'),('resources.upload','Upload resources','Upload resources.'),('resources.update','Update resources','Edit resources.'),('resources.delete','Delete resources','Delete resources.'),('audit_logs.view','View audit logs','View audit records.'),('analytics.view','View analytics','View analytics.'),('notifications.manage','Manage notifications','Manage notification preferences.'),('members.export','Export members','Export authorized member data.')
on conflict (key) do update set name = excluded.name, description = excluded.description;

insert into public.roles (name,key,description,scope,is_system) values
('Super Administrator','super_admin','Platform-wide administration with explicit platform permissions.','system',true),('Platform Administrator','platform_admin','Platform administration without automatic tenant-private access.','system',true),('Platform Moderator','platform_moderator','Platform moderation duties.','system',true),('Platform Auditor','platform_auditor','Platform audit access.','system',true),('Organization Owner','organization_owner','Owns one organization scope.','organization',true),('Organization Administrator','organization_admin','Administrates one organization scope.','organization',true),('Organization Manager','organization_manager','Manages delegated organization operations.','organization',true),('Organization Reviewer','organization_reviewer','Reviews organization applications.','organization',true),('Organization Editor','organization_editor','Edits delegated organization content.','organization',true),('Organization Member','organization_member','Standard organization membership.','organization',true),('Community Administrator','community_admin','Administrates one community scope.','community',true),('Community Moderator','community_moderator','Moderates one community scope.','community',true),('Community Reviewer','community_reviewer','Reviews community applications.','community',true),('Community Editor','community_editor','Edits delegated community content.','community',true),('Community Member','community_member','Standard community participation.','community',true)
on conflict (key) do update set name = excluded.name, description = excluded.description, is_system = true;

alter table public.platform_role_assignments enable row level security;
alter table public.role_assignment_history enable row level security;
create policy platform_role_assignments_access on public.platform_role_assignments for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy role_assignment_history_access on public.role_assignment_history for select using (public.is_platform_admin() or (organization_id is not null and public.is_active_org_member(organization_id)));
create policy roles_manage_access on public.roles for all using (public.is_platform_admin() or (scope = 'organization' and public.is_org_admin((current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid))) with check (public.is_platform_admin() or (scope = 'organization' and public.is_org_admin((current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id')::uuid)));
create policy role_permissions_manage_access on public.role_permissions for all using (public.is_platform_admin()) with check (public.is_platform_admin());

comment on table public.platform_role_assignments is 'Explicit platform-scope assignments; platform roles do not automatically grant tenant-private data access.';
comment on table public.role_assignment_history is 'Audit trail for role assignment, delegation, revocation, and denied escalation attempts.';
