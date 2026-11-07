-- ATLAS CMS Step 17: centralized database-backed audit logs and activity tracking.
-- Audit rows are generated inside the same transaction as selected business-table writes.
-- This is application/database-level append-only protection, not protection from database owners,
-- superusers, backups administrators, or infrastructure-level deletion.

alter table public.audit_logs
  add column if not exists event_type text,
  add column if not exists outcome text not null default 'success',
  add column if not exists severity text not null default 'informational',
  add column if not exists actor_display_name text,
  add column if not exists actor_role_context jsonb not null default '{}'::jsonb,
  add column if not exists request_id text,
  add column if not exists change_summary text,
  add column if not exists change_details jsonb not null default '{}'::jsonb,
  add column if not exists source_module text,
  add column if not exists is_administrative boolean not null default false;

update public.audit_logs
set event_type = coalesce(nullif(event_type, ''), lower(regexp_replace(coalesce(module, 'legacy'), '[^a-zA-Z0-9_.-]+', '_', 'g')) || '.' || lower(regexp_replace(coalesce(action, 'recorded'), '[^a-zA-Z0-9_.-]+', '_', 'g'))),
    source_module = coalesce(nullif(source_module, ''), module),
    change_summary = coalesce(nullif(change_summary, ''), initcap(replace(coalesce(action, 'recorded'), '_', ' ')) || ' · ' || coalesce(module, 'legacy'))
where event_type is null or source_module is null or change_summary is null;

alter table public.audit_logs alter column event_type set not null;
alter table public.audit_logs alter column event_type set default 'platform.event.recorded';
alter table public.audit_logs alter column source_module set not null;
alter table public.audit_logs alter column change_summary set not null;
alter table public.audit_logs drop constraint if exists audit_logs_outcome_check;
alter table public.audit_logs add constraint audit_logs_outcome_check check (outcome in ('success','failure','denied'));
alter table public.audit_logs drop constraint if exists audit_logs_severity_check;
alter table public.audit_logs add constraint audit_logs_severity_check check (severity in ('informational','warning','high_risk'));
alter table public.audit_logs drop constraint if exists audit_logs_event_type_check;
alter table public.audit_logs add constraint audit_logs_event_type_check check (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.-]*$');
alter table public.audit_logs drop constraint if exists audit_logs_changes_object_check;
alter table public.audit_logs add constraint audit_logs_changes_object_check check (jsonb_typeof(change_details) = 'object' and jsonb_typeof(metadata) = 'object' and jsonb_typeof(actor_role_context) = 'object');
-- Keep historical UUID references after account/tenant deletion; FK SET NULL would issue
-- UPDATEs against audit_logs and conflict with the append-only trigger below.
alter table public.audit_logs drop constraint if exists audit_logs_organization_id_fkey;
alter table public.audit_logs drop constraint if exists audit_logs_community_id_fkey;
alter table public.audit_logs drop constraint if exists audit_logs_actor_user_id_fkey;
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc, id desc);
create index if not exists audit_logs_scope_created_idx on public.audit_logs (organization_id, community_id, created_at desc, id desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_module_created_idx on public.audit_logs (source_module, created_at desc);
create index if not exists audit_logs_event_created_idx on public.audit_logs (event_type, created_at desc);
create index if not exists audit_logs_outcome_created_idx on public.audit_logs (outcome, created_at desc);
create index if not exists audit_logs_metadata_gin_idx on public.audit_logs using gin (metadata jsonb_path_ops);

insert into public.permissions (key,name,description) values
  ('audit_logs.view','View audit records','View permitted audit records in an assigned tenant scope.'),
  ('audit_logs.view_platform','View platform audit records','View platform-level audit records.'),
  ('audit_logs.view_security','View security-related audit records','View observable security and access-control events.'),
  ('audit_logs.view_sensitive','View safe before-and-after audit details','View redacted structured change details and actor context.'),
  ('audit_logs.export','Export authorized audit records','Export audit records within an assigned scope.'),
  ('audit_logs.retention.manage','Manage audit retention policy','Configure audit retention metadata; does not run purge jobs.'),
  ('audit_logs.integrity.verify','Verify audit configuration','Inspect database-level append-only controls and coverage notes.')
on conflict (key) do update set name=excluded.name,description=excluded.description;

create or replace function public.can_view_audit_logs(target_org uuid, target_community uuid, required_permission text default 'audit_logs.view')
returns boolean language plpgsql stable security definer set search_path=public
as $$
declare allowed boolean := false;
begin
  if auth.uid() is null then return false; end if;
  if required_permission not in ('audit_logs.view','audit_logs.view_platform','audit_logs.view_security','audit_logs.view_sensitive','audit_logs.export','audit_logs.retention.manage','audit_logs.integrity.verify') then return false; end if;
  if target_org is null then
    if not public.is_platform_admin() then return false; end if;
    if required_permission in ('audit_logs.view','audit_logs.view_platform','audit_logs.view_security','audit_logs.view_sensitive','audit_logs.export','audit_logs.retention.manage','audit_logs.integrity.verify') then return true; end if;
  end if;
  if public.is_platform_admin() then return true; end if;
  if target_community is not null and not exists(select 1 from public.communities c where c.id=target_community and c.organization_id=target_org) then return false; end if;
  select exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id=ura.role_id and r.is_active=true
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id and p.key=required_permission
    join public.organization_memberships m on m.organization_id=ura.organization_id and m.user_id=ura.user_id and m.membership_status='active'
    where ura.user_id=auth.uid() and ura.organization_id=target_org and ura.revoked_at is null
      and ((target_community is null and ura.assignment_scope='organization' and ura.community_id is null)
        or (target_community is not null and ((ura.assignment_scope='organization' and ura.community_id is null) or (ura.assignment_scope='community' and ura.community_id=target_community))))
      and (target_community is null or exists(select 1 from public.community_memberships cm where cm.organization_id=target_org and cm.community_id=target_community and cm.user_id=auth.uid() and cm.membership_status='active') or (ura.assignment_scope='organization' and ura.community_id is null))
  ) into allowed;
  return coalesce(allowed,false);
end;
$$;
revoke all on function public.can_view_audit_logs(uuid,uuid,text) from public, anon;
grant execute on function public.can_view_audit_logs(uuid,uuid,text) to authenticated;

create table if not exists public.audit_retention_policies (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('platform','organization','community')),
  organization_id uuid,
  community_id uuid,
  retention_days integer not null check (retention_days between 365 and 3650),
  archive_before_purge boolean not null default true,
  enabled boolean not null default true,
  notes text,
  changed_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  check ((scope_type='platform' and organization_id is null and community_id is null) or (scope_type='organization' and organization_id is not null and community_id is null) or (scope_type='community' and organization_id is not null and community_id is not null))
);
create unique index if not exists audit_retention_policies_scope_uidx on public.audit_retention_policies(scope_type, coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(community_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists audit_retention_policies_scope_idx on public.audit_retention_policies(organization_id,community_id);
alter table public.audit_retention_policies enable row level security;
revoke all on public.audit_retention_policies from anon,authenticated;
grant select on public.audit_retention_policies to authenticated;
create policy audit_retention_scoped_select on public.audit_retention_policies for select to authenticated using (
  (scope_type='platform' and public.can_view_audit_logs(null,null,'audit_logs.retention.manage'))
  or (scope_type='organization' and public.can_view_audit_logs(organization_id,null,'audit_logs.retention.manage'))
  or (scope_type='community' and public.can_view_audit_logs(organization_id,community_id,'audit_logs.retention.manage'))
);

create table if not exists public.audit_exports (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  organization_id uuid,
  community_id uuid,
  export_format text not null check (export_format in ('csv','json')),
  record_count integer not null check (record_count between 0 and 5000),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters)='object'),
  generated_at timestamptz not null default timezone('utc',now())
);
create index if not exists audit_exports_actor_created_idx on public.audit_exports(actor_user_id,generated_at desc);
alter table public.audit_exports enable row level security;
revoke all on public.audit_exports from anon,authenticated;

create or replace function public.set_audit_retention_policy(p_scope_type text,p_organization_id uuid,p_community_id uuid,p_retention_days integer,p_archive_before_purge boolean,p_enabled boolean,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare saved public.audit_retention_policies;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_retention_days < 365 or p_retention_days > 3650 then raise exception 'retention must be between 365 and 3650 days' using errcode='22023'; end if;
  if p_scope_type='platform' then
    if p_organization_id is not null or p_community_id is not null or not public.can_view_audit_logs(null,null,'audit_logs.retention.manage') then raise exception 'platform retention permission required' using errcode='42501'; end if;
  elsif p_scope_type='organization' then
    if p_organization_id is null or p_community_id is not null or not public.can_view_audit_logs(p_organization_id,null,'audit_logs.retention.manage') then raise exception 'organization retention permission required' using errcode='42501'; end if;
  elsif p_scope_type='community' then
    if p_organization_id is null or p_community_id is null or not public.can_view_audit_logs(p_organization_id,p_community_id,'audit_logs.retention.manage') then raise exception 'community retention permission required' using errcode='42501'; end if;
  else raise exception 'invalid retention scope' using errcode='22023'; end if;
  insert into public.audit_retention_policies(scope_type,organization_id,community_id,retention_days,archive_before_purge,enabled,notes,changed_by)
    values(p_scope_type,p_organization_id,p_community_id,p_retention_days,coalesce(p_archive_before_purge,true),coalesce(p_enabled,true),left(p_notes,500),auth.uid())
  on conflict (scope_type,coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(community_id,'00000000-0000-0000-0000-000000000000'::uuid))
  do update set retention_days=excluded.retention_days,archive_before_purge=excluded.archive_before_purge,enabled=excluded.enabled,notes=excluded.notes,changed_by=auth.uid(),updated_at=timezone('utc',now())
  returning * into saved;
  -- The AFTER trigger on audit_retention_policies writes exactly one audit event in this transaction.
  return to_jsonb(saved);
end;
$$;
revoke all on function public.set_audit_retention_policy(text,uuid,uuid,integer,boolean,boolean,text) from public,anon;
grant execute on function public.set_audit_retention_policy(text,uuid,uuid,integer,boolean,boolean,text) to authenticated;

create or replace function public.record_audit_export(p_organization_id uuid,p_community_id uuid,p_export_format text,p_record_count integer,p_filters jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare saved_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_export_format not in ('csv','json') or p_record_count < 0 or p_record_count > 5000 or jsonb_typeof(coalesce(p_filters,'{}'::jsonb))<>'object' then raise exception 'invalid audit export request' using errcode='22023'; end if;
  if p_organization_id is null then
    if p_community_id is not null or not public.can_view_audit_logs(null,null,'audit_logs.export') then raise exception 'platform export permission required' using errcode='42501'; end if;
  elsif not public.can_view_audit_logs(p_organization_id,p_community_id,'audit_logs.export') then raise exception 'export permission required for this tenant' using errcode='42501'; end if;
  insert into public.audit_exports(actor_user_id,organization_id,community_id,export_format,record_count,filters)
    values(auth.uid(),p_organization_id,p_community_id,p_export_format,p_record_count,left(coalesce(p_filters,'{}'::jsonb)::text,4000)::jsonb)
    returning id into saved_id;
  return saved_id;
end;
$$;
revoke all on function public.record_audit_export(uuid,uuid,text,integer,jsonb) from public,anon;
grant execute on function public.record_audit_export(uuid,uuid,text,integer,jsonb) to authenticated;

create or replace function public.audit_log_append_only()
returns trigger language plpgsql set search_path=public
as $$ begin raise exception 'audit records are append-only through the application database role' using errcode='42501'; end $$;
drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update before update or delete on public.audit_logs for each row execute function public.audit_log_append_only();

create or replace function public.capture_audit_event()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
  v_row jsonb;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_org uuid;
  v_community uuid;
  v_actor uuid := auth.uid();
  v_target uuid;
  v_action text;
  v_module text;
  v_event text;
  v_fields text[] := array[]::text[];
  v_previous jsonb := '{}'::jsonb;
  v_current jsonb := '{}'::jsonb;
  v_changed text[] := array[]::text[];
  v_field text;
  v_request_id text;
  v_summary text;
  v_is_administrative boolean;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := case when tg_op='DELETE' then v_old else v_new end;
  v_org := nullif(v_row->>'organization_id','')::uuid;
  v_community := nullif(v_row->>'community_id','')::uuid;
  v_target := nullif(v_row->>'id','')::uuid;

  if tg_table_name='organizations' then v_org:=v_target; end if;
  if tg_table_name='communities' then v_community:=v_target; end if;
  if tg_table_name in ('messages','message_reports','conversation_members','conversation_participants','conversation_moderators') and v_row ? 'conversation_id' then
    select c.organization_id,c.community_id into v_org,v_community from public.conversations c where c.id=(v_row->>'conversation_id')::uuid;
  end if;
  if tg_table_name in ('committee_appointments','committee_positions','committee_meetings','committee_resolutions','committee_members') and v_org is null and v_row ? 'committee_id' then
    select c.organization_id,c.community_id into v_org,v_community from public.committees c where c.id=(v_row->>'committee_id')::uuid;
  end if;
  if tg_table_name in ('resource_versions','resource_access_rules') and v_org is null and v_row ? 'resource_id' then
    select r.organization_id,r.community_id into v_org,v_community from public.resources r where r.id=(v_row->>'resource_id')::uuid;
  end if;
  if tg_table_name='content_revisions' and v_org is null and v_row ? 'content_item_id' then
    select i.organization_id,i.community_id into v_org,v_community from public.content_items i where i.id=(v_row->>'content_item_id')::uuid;
  end if;
  if tg_table_name='content_page_sections' and v_row ? 'page_id' then
    select p.organization_id,p.community_id into v_org,v_community from public.content_pages p where p.id=(v_row->>'page_id')::uuid;
  end if;
  if tg_table_name in ('event_sessions','event_speakers','event_registration_forms','event_registrations','event_attendance') and v_row ? 'event_id' then
    select e.organization_id,e.community_id into v_org,v_community from public.events e where e.id=(v_row->>'event_id')::uuid;
  end if;
  -- Parent cascades may remove the referenced row before child triggers run; never mislabel such rows as platform events.
  if v_org is null and tg_table_name in ('event_sessions','event_speakers','event_registration_forms','event_registrations','event_attendance','content_page_sections','content_revisions','committee_meetings','committee_resolutions','resource_access_rules','messages') then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if v_target is null then
    v_target := coalesce(nullif(v_row->>'application_id','')::uuid,nullif(v_row->>'resource_id','')::uuid,nullif(v_row->>'content_item_id','')::uuid,nullif(v_row->>'conversation_id','')::uuid);
  end if;

  v_module := case
    when tg_table_name in ('organizations','organization_settings','organization_domains') then 'organizations'
    when tg_table_name in ('communities') then 'communities'
    when tg_table_name in ('organization_memberships','community_memberships','user_profiles') then 'members'
    when tg_table_name in ('membership_applications') then 'applications'
    when tg_table_name in ('roles','role_permissions','user_role_assignments','platform_role_assignments') then 'roles'
    when tg_table_name in ('committees','committee_appointments','committee_positions','committee_members','committee_meetings','committee_resolutions','appointments','governance_documents') then 'governance'
    when tg_table_name in ('events','event_registrations','event_attendance','event_sessions','event_speakers') then 'events'
    when tg_table_name in ('content_items','content_revisions','publications','content_pages','content_page_sections') then 'cms'
    when tg_table_name in ('resources','resource_versions','resource_access_rules','resource_files') then 'resources'
    when tg_table_name in ('announcements','announcement_audiences') then 'announcements'
    when tg_table_name in ('notification_templates') then 'notifications'
    when tg_table_name in ('conversations','conversation_members','conversation_participants','conversation_moderators','messages','message_reports') then 'messaging'
    when tg_table_name in ('audit_exports','audit_retention_policies') then 'audit_logs'
    else 'platform' end;

  v_action := case when tg_op='INSERT' then 'created' when tg_op='DELETE' then 'deleted' else 'updated' end;
  if tg_op='UPDATE' and v_old->>'status' is distinct from v_new->>'status' and nullif(v_new->>'status','') is not null then
    v_action := case when v_new->>'status' in ('approved','published','archived','cancelled','rejected','withdrawn','suspended','reactivated') then v_new->>'status' else 'status_changed' end;
  end if;
  if tg_table_name='messages' then v_action := case when tg_op='INSERT' then 'message_created' when tg_op='DELETE' then 'message_deleted' else 'message_edited' end; end if;
  if tg_table_name='message_reports' and tg_op='UPDATE' then v_action:='moderation_action'; end if;
  if tg_table_name='audit_exports' then v_action:='export_generated'; end if;
  if tg_table_name='audit_retention_policies' then v_action:='retention_policy_changed'; end if;
  v_event := v_module || '.' || lower(regexp_replace(v_action,'[^a-zA-Z0-9_.-]+','_','g'));
  -- User-initiated messages, event registrations, and newly submitted applications are not admin actions.
  -- The remaining captured records are administrative/configuration operations or governance moderation.
  if tg_table_name in ('messages','event_registrations')
    or (tg_table_name='membership_applications' and tg_op='INSERT')
    or (tg_table_name in ('organization_memberships','community_memberships') and v_row->>'user_id'=v_actor::text)
    or (tg_table_name='user_profiles' and v_row->>'id'=v_actor::text) then
    v_is_administrative := false;
  else
    v_is_administrative := true;
  end if;

  v_fields := case tg_table_name
    when 'organizations' then array['name','slug','organization_type','status']
    when 'organization_settings' then array['default_language','default_timezone']
    when 'organization_domains' then array['domain','verification_status','is_primary']
    when 'communities' then array['name','slug','status','visibility','membership_type','community_type']
    when 'organization_memberships' then array['membership_status','membership_start_date','membership_end_date']
    when 'community_memberships' then array['membership_status','membership_category','membership_start_date','membership_end_date']
    when 'membership_applications' then array['status','application_category']
    when 'roles' then array['name','key','scope','is_active']
    when 'role_permissions' then array['role_id','permission_id']
    when 'user_role_assignments' then array['assignment_scope','community_id','role_id','revoked_at']
    when 'platform_role_assignments' then array['role_id','revoked_at']
    when 'committees' then array['name','status','committee_type','effective_date']
    when 'committee_appointments' then array['position_id','start_date','end_date','status','appointment_type']
    when 'committee_positions' then array['name','is_active']
    when 'committee_members' then array['role','status']
    when 'committee_meetings' then array['status','scheduled_at']
    when 'committee_resolutions' then array['status','published_at']
    when 'appointments' then array['status','start_date','end_date']
    when 'events' then array['title','status','starts_at','ends_at','mode']
    when 'event_registrations' then array['registration_status']
    when 'event_attendance' then array['attendance_status','checked_in_at']
    when 'content_items' then array['title','status','content_type','visibility','published_at']
    when 'content_revisions' then array['revision_number','change_summary']
    when 'publications' then array['status','published_at']
    when 'resources' then array['name','status','visibility','version']
    when 'resource_versions' then array['version','created_at']
    when 'resource_access_rules' then array['access_type','role_id']
    when 'announcements' then array['title','status','audience_scope','published_at']
    when 'announcement_audiences' then array['audience_type','audience_id']
    when 'notification_templates' then array['name','is_active','channel']
    when 'conversations' then array['conversation_type','status']
    when 'conversation_members' then array['user_id','membership_status']
    when 'conversation_participants' then array['user_id','status']
    when 'conversation_moderators' then array['user_id','is_active']
    when 'messages' then array[]::text[] -- Never capture message content, subject, or attachments.
    when 'message_reports' then array['status','reviewed_at','resolution']
    when 'audit_exports' then array['export_format','record_count']
    when 'audit_retention_policies' then array['retention_days','archive_before_purge','enabled']
    else array[]::text[] end;

  foreach v_field in array v_fields loop
    if v_old->v_field is distinct from v_new->v_field then
      v_changed := array_append(v_changed,v_field);
      if tg_op <> 'INSERT' and v_old ? v_field then v_previous := v_previous || jsonb_build_object(v_field,v_old->v_field); end if;
      if tg_op <> 'DELETE' and v_new ? v_field then v_current := v_current || jsonb_build_object(v_field,v_new->v_field); end if;
    end if;
  end loop;
  if tg_op='INSERT' then v_changed:=v_fields; end if;
  if tg_op='DELETE' then v_changed:=v_fields; end if;

  begin
    v_request_id := left(coalesce(current_setting('request.headers',true)::jsonb->>'x-correlation-id',current_setting('request.headers',true)::jsonb->>'x-request-id'),128);
  exception when others then v_request_id:=null; end;
  v_summary := case when tg_table_name='messages' then 'Messaging message ' || replace(v_action,'message_','') || ' (content omitted)' else initcap(replace(v_action,'_',' ')) || ' · ' || replace(tg_table_name,'_',' ') end;
  insert into public.audit_logs(organization_id,community_id,actor_user_id,action,module,target_record_id,target_record_type,metadata,created_at,event_type,outcome,severity,actor_display_name,actor_role_context,request_id,change_summary,change_details,source_module,is_administrative)
  values(v_org,v_community,v_actor,v_action,v_module,v_target,tg_table_name,jsonb_build_object('source_table',tg_table_name),timezone('utc',now()),v_event,'success','informational',null,'{}'::jsonb,v_request_id,v_summary,jsonb_build_object('fields',to_jsonb(v_changed),'previous',v_previous,'new',v_current),v_module,v_is_administrative);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.capture_audit_event() from public,anon,authenticated;

-- Rebuild controlled audit reading. Platform-only rows never become visible to tenant roles.
drop policy if exists audit_logs_access on public.audit_logs;
create policy audit_logs_scoped_select on public.audit_logs for select to authenticated using (
  (organization_id is null and public.can_view_audit_logs(null,null,'audit_logs.view_platform'))
  or (organization_id is not null and public.can_view_audit_logs(organization_id,community_id,'audit_logs.view')
    and (event_type not like 'security.%' or public.can_view_audit_logs(organization_id,community_id,'audit_logs.view_security')))
);
revoke all on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;
-- Only SECURITY DEFINER trigger/RPC owners can append. No client INSERT/UPDATE/DELETE grant or policy exists.

-- Include only selected high-value business tables. Allowlisted before/after snapshots avoid complete rows,
-- applicant submissions, private messages, credentials, tokens, and free-form notes.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','organization_settings','organization_domains','communities',
    'organization_memberships','community_memberships','membership_applications',
    'roles','role_permissions','user_role_assignments','platform_role_assignments',
    'committees','committee_appointments','committee_positions','committee_members','committee_meetings','committee_resolutions','appointments','governance_documents',
    'events','event_registrations','event_attendance','event_sessions','event_speakers',
    'content_items','content_revisions','publications','content_pages','content_page_sections',
    'resources','resource_versions','resource_access_rules','resource_files',
    'announcements','announcement_audiences','notification_templates',
    'conversations','conversation_members','conversation_participants','conversation_moderators','messages','message_reports',
    'audit_exports','audit_retention_policies'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists audit_capture_%I on public.%I',t,t);
      execute format('create trigger audit_capture_%I after insert or update or delete on public.%I for each row execute function public.capture_audit_event()',t,t);
    end if;
  end loop;
end $$;

-- Retention is configuration only. There is deliberately no automatic archive or purge job.
comment on table public.audit_logs is 'Structured, tenant-scoped audit trail. Normal application writes are append-only; row triggers capture selected business changes transactionally. Database owners/privileged operators remain able to alter storage.';
comment on table public.audit_retention_policies is 'Configured retention metadata only. This schema does not schedule archive or purge operations; minimum configured period is 365 days.';
comment on table public.audit_exports is 'Metadata about generated on-demand audit exports; exported files are streamed to authorized requesters and are not persisted here.';
comment on function public.capture_audit_event() is 'Transactional trigger-based event capture with per-table allowlisted snapshots; message content and applicant free text are excluded.';
comment on function public.can_view_audit_logs(uuid,uuid,text) is 'RBAC-aware audit access check using authenticated database identity and explicitly assigned scoped permission keys.';


create or replace function public.get_audit_dashboard(p_organization_id uuid,p_community_id uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '2 years' then raise exception 'invalid audit dashboard date range' using errcode='22023'; end if;
  if p_organization_id is null then
    if p_community_id is not null or not public.can_view_audit_logs(null,null,'audit_logs.view_platform') then raise exception 'platform audit permission required' using errcode='42501'; end if;
  elsif not public.can_view_audit_logs(p_organization_id,p_community_id,'audit_logs.view') then
    raise exception 'audit dashboard permission required' using errcode='42501';
  end if;
  with scoped as (
    select l.id,l.event_type,l.action,l.source_module,l.outcome,l.severity,l.is_administrative,l.organization_id,l.community_id,l.actor_user_id,l.target_record_type,l.target_record_id,l.change_summary,l.created_at
    from public.audit_logs l
    where l.created_at>=p_from and l.created_at<p_to
      and ((p_organization_id is null and l.organization_id is null)
        or (p_organization_id is not null and l.organization_id=p_organization_id and (p_community_id is null or l.community_id=p_community_id)))
      and (l.event_type not like 'security.%' or public.can_view_audit_logs(p_organization_id,p_community_id,'audit_logs.view_security'))
  )
  select jsonb_build_object(
    'total',count(*),
    'administrative',count(*) filter (where is_administrative),
    'security',count(*) filter (where event_type like 'security.%'),
    'organization_activity',count(*) filter (where organization_id is not null and community_id is null),
    'community_activity',count(*) filter (where community_id is not null),
    'failed',count(*) filter (where outcome in ('failure','denied')),
    'recent_sensitive',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'event_type',r.event_type,'action',r.action,'module',r.source_module,'outcome',r.outcome,'severity',r.severity,'summary',r.change_summary,'created_at',r.created_at,'target_type',r.target_record_type,'target_id',r.target_record_id) order by r.created_at desc) from (select * from scoped where is_administrative or severity<>'informational' order by created_at desc limit 8) r),'[]'::jsonb),
    'by_module',coalesce((select jsonb_agg(jsonb_build_object('module',m.source_module,'count',m.n) order by m.n desc,m.source_module) from (select source_module,count(*) n from scoped group by source_module order by n desc,source_module limit 12) m),'[]'::jsonb),
    'trend',coalesce((select jsonb_agg(jsonb_build_object('date',d.day,'count',d.n) order by d.day) from (select to_char(date_trunc('day',created_at at time zone 'UTC'),'YYYY-MM-DD') day,count(*) n from scoped group by 1 order by 1) d),'[]'::jsonb),
    'period',jsonb_build_object('from',p_from,'to',p_to),
    'generated_at',timezone('utc',now())
  ) into result from scoped;
  return result;
end;
$$;
revoke all on function public.get_audit_dashboard(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_audit_dashboard(uuid,uuid,timestamptz,timestamptz) to authenticated;
comment on function public.get_audit_dashboard(uuid,uuid,timestamptz,timestamptz) is 'Permission-checked aggregate dashboard derived only from audit_logs rows; does not infer incidents or risk scores.';


create or replace function public.record_audit_access_denied(p_organization_id uuid,p_community_id uuid,p_required_permission text)
returns boolean language plpgsql security definer set search_path=public
as $$
declare
  request_headers jsonb;
  request_key text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_required_permission not in ('audit_logs.view','audit_logs.view_platform','audit_logs.view_security','audit_logs.view_sensitive','audit_logs.export','audit_logs.retention.manage','audit_logs.integrity.verify') then raise exception 'unsupported audit permission' using errcode='22023'; end if;
  if p_organization_id is not null and not exists(select 1 from public.organizations o where o.id=p_organization_id) then raise exception 'invalid audit scope' using errcode='22023'; end if;
  if p_organization_id is not null and p_community_id is not null and not exists(select 1 from public.communities c where c.id=p_community_id and c.organization_id=p_organization_id) then raise exception 'invalid audit scope' using errcode='22023'; end if;
  if p_organization_id is null and p_community_id is not null then raise exception 'invalid audit scope' using errcode='22023'; end if;
  if public.can_view_audit_logs(p_organization_id,p_community_id,p_required_permission) then raise exception 'access is not denied for this permission' using errcode='22023'; end if;
  if exists(select 1 from public.audit_logs l where l.actor_user_id=auth.uid() and l.event_type='security.audit_access_denied' and l.metadata->>'permission'=p_required_permission and l.created_at>timezone('utc',now())-interval '1 minute') then return false; end if;
  begin
    request_headers:=current_setting('request.headers',true)::jsonb;
    request_key:=left(coalesce(request_headers->>'x-correlation-id',request_headers->>'x-request-id'),128);
  exception when others then request_key:=null; end;
  insert into public.audit_logs(organization_id,community_id,actor_user_id,action,module,target_record_type,metadata,created_at,event_type,outcome,severity,actor_display_name,actor_role_context,request_id,change_summary,change_details,source_module,is_administrative)
    values(p_organization_id,p_community_id,auth.uid(),'access_denied','security','audit_scope',jsonb_build_object('permission',p_required_permission),timezone('utc',now()),'security.audit_access_denied','denied','warning',null,'{}'::jsonb,request_key,'Audit access request denied',jsonb_build_object('fields',jsonb_build_array()),'security',true);
  return true;
end;
$$;
revoke all on function public.record_audit_access_denied(uuid,uuid,text) from public,anon;
grant execute on function public.record_audit_access_denied(uuid,uuid,text) to authenticated;
comment on function public.record_audit_access_denied(uuid,uuid,text) is 'Logs a permission-denied audit access request as a neutral warning after rechecking the actual failed permission; repeated actor/permission denials are throttled per minute.';
