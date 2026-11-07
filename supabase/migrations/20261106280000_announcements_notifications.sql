-- ATLAS CMS Step 14: Announcements & Notifications.
-- Extends existing announcements and notifications; external channels remain opt-in abstractions.
alter table public.announcements add column if not exists summary text;
alter table public.announcements add column if not exists announcement_type text not null default 'General Announcement';
alter table public.announcements add column if not exists priority text not null default 'normal';
alter table public.announcements add column if not exists visibility text not null default 'members';
alter table public.announcements add column if not exists audience_type text not null default 'organization';
alter table public.announcements add column if not exists publish_at timestamptz;
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements add column if not exists timezone text not null default 'UTC';
alter table public.announcements add column if not exists external_url text;
alter table public.announcements add column if not exists author_user_id uuid references public.user_profiles(id) on delete set null;
alter table public.announcements add column if not exists deleted_at timestamptz;
alter table public.announcements drop constraint if exists announcements_status_check;
alter table public.announcements add constraint announcements_status_check check(status in ('draft','submitted_for_review','under_review','changes_requested','approved','scheduled','published','expired','archived','rejected','cancelled'));
alter table public.announcements drop constraint if exists announcements_priority_check;
alter table public.announcements add constraint announcements_priority_check check(priority in ('normal','important','urgent'));
alter table public.announcements drop constraint if exists announcements_audience_type_check;
alter table public.announcements add constraint announcements_audience_type_check check(audience_type in ('organization','community','organization_roles','community_roles','individual_members','platform'));
update public.announcements set summary=coalesce(summary, left(body,300)) where summary is null;
alter table public.announcements alter column summary set not null;
create index if not exists announcements_workflow_idx on public.announcements(organization_id,status,publish_at,expires_at);
create index if not exists announcements_audience_idx on public.announcements(organization_id,community_id,audience_type);

alter table public.notifications add column if not exists category text not null default 'General';
alter table public.notifications add column if not exists related_type text;
alter table public.notifications add column if not exists related_id uuid;
alter table public.notifications add column if not exists deep_link text;
alter table public.notifications add column if not exists priority text not null default 'normal';
alter table public.notifications add column if not exists dismissed_at timestamptz;
alter table public.notifications add column if not exists delivered_at timestamptz;
create index if not exists notifications_inbox_idx on public.notifications(user_id, dismissed_at, read_at, created_at desc);

create table if not exists public.announcement_attachments(
 id uuid primary key default gen_random_uuid(), announcement_id uuid not null references public.announcements(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade,
 storage_bucket text not null default 'announcement-attachments', storage_path text not null, file_name text not null, mime_type text, file_size_bytes bigint check(file_size_bytes is null or file_size_bytes>=0), uploaded_by uuid references public.user_profiles(id) on delete set null, created_at timestamptz not null default timezone('utc',now()), unique(storage_bucket,storage_path)
);
create table if not exists public.announcement_audiences(
 id uuid primary key default gen_random_uuid(), announcement_id uuid not null references public.announcements(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, audience_type text not null check(audience_type in ('organization','community','organization_roles','community_roles','individual_members','platform')), community_id uuid references public.communities(id) on delete cascade, role_id uuid references public.roles(id) on delete cascade, member_user_id uuid references public.user_profiles(id) on delete cascade, created_at timestamptz not null default timezone('utc',now()), check((audience_type='community' and community_id is not null) or (audience_type='organization' and community_id is null) or (audience_type in ('organization_roles','community_roles','individual_members','platform')))
);
create table if not exists public.announcement_recipients(
 announcement_id uuid not null references public.announcements(id) on delete cascade, user_id uuid not null references public.user_profiles(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, created_at timestamptz not null default timezone('utc',now()), notified_at timestamptz, read_at timestamptz, primary key(announcement_id,user_id)
);
create table if not exists public.announcement_reviews(
 id uuid primary key default gen_random_uuid(), announcement_id uuid not null references public.announcements(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, reviewer_user_id uuid references public.user_profiles(id) on delete set null, decision text not null check(decision in ('submitted_for_review','under_review','changes_requested','approved','rejected','note')), internal_notes text, created_at timestamptz not null default timezone('utc',now())
);
create table if not exists public.notification_preferences(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_profiles(id) on delete cascade, organization_id uuid references public.organizations(id) on delete cascade, in_app_enabled boolean not null default true, announcements_enabled boolean not null default true, events_enabled boolean not null default true, membership_enabled boolean not null default true, governance_enabled boolean not null default true, content_resources_enabled boolean not null default true, email_enabled boolean not null default false, digest_frequency text not null default 'immediate' check(digest_frequency in ('immediate','daily','weekly','off')), updated_at timestamptz not null default timezone('utc',now()), unique(user_id,organization_id)
);
create table if not exists public.notification_delivery_logs(
 id uuid primary key default gen_random_uuid(), notification_id uuid references public.notifications(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, channel text not null check(channel in ('in_app','email','sms','whatsapp','push','other')), status text not null check(status in ('queued','sent','failed','skipped')), provider text, provider_message_id text, error_message text, attempt_count integer not null default 1, attempted_at timestamptz not null default timezone('utc',now()), unique(notification_id,channel,attempt_count)
);
create table if not exists public.notification_templates(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade, template_key text not null, name text not null, title_template text not null, body_template text not null, allowed_variables text[] not null default '{}', is_active boolean not null default true, created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()), unique(organization_id,template_key)
);
create table if not exists public.notification_events(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, event_key text not null, source_type text, source_id uuid, payload jsonb not null default '{}'::jsonb, idempotency_key text not null, created_at timestamptz not null default timezone('utc',now()), unique(organization_id,idempotency_key)
);
insert into public.permissions(key,name,description) values
('announcements.view','View announcements','View permitted announcements.'),('announcements.create','Create announcements','Create announcements.'),('announcements.update','Edit announcements','Edit own or authorized announcements.'),('announcements.review','Review announcements','Review announcement submissions.'),('announcements.approve','Approve announcements','Approve announcements.'),('announcements.publish','Publish announcements','Publish approved announcements.'),('announcements.archive','Archive announcements','Archive announcements.'),('announcements.templates.manage','Manage notification templates','Manage reusable notification templates.'),('notifications.view','View notifications','View own in-app notifications.'),('notifications.preferences.manage','Manage notification preferences','Manage own or authorized notification preferences.'),('notifications.delivery_logs.view','View delivery logs','View authorized notification delivery logs.') on conflict(key) do update set name=excluded.name,description=excluded.description;

alter table public.announcement_attachments enable row level security; alter table public.announcement_audiences enable row level security; alter table public.announcement_recipients enable row level security; alter table public.announcement_reviews enable row level security; alter table public.notification_preferences enable row level security; alter table public.notification_delivery_logs enable row level security; alter table public.notification_templates enable row level security; alter table public.notification_events enable row level security;
create policy announcement_attachments_access on public.announcement_attachments for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy announcement_audiences_access on public.announcement_audiences for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy announcement_recipients_access on public.announcement_recipients for select using(user_id=auth.uid() or public.is_org_admin(organization_id));
create policy announcement_recipients_write on public.announcement_recipients for all using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));
create policy announcement_reviews_access on public.announcement_reviews for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy notification_preferences_access on public.notification_preferences for all using(user_id=auth.uid() or (organization_id is not null and public.is_org_admin(organization_id))) with check(user_id=auth.uid() or (organization_id is not null and public.is_org_admin(organization_id)));
create policy notification_delivery_logs_access on public.notification_delivery_logs for select using(public.is_org_admin(organization_id));
create policy notification_templates_access on public.notification_templates for all using(organization_id is null or public.is_active_org_member(organization_id)) with check(organization_id is null or public.is_org_admin(organization_id));
create policy notification_events_access on public.notification_events for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
insert into storage.buckets(id,name,public) values('announcement-attachments','announcement-attachments',false) on conflict(id) do update set public=false;
create policy announcement_attachments_storage_select on storage.objects for select using(bucket_id='announcement-attachments' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
create policy announcement_attachments_storage_insert on storage.objects for insert with check(bucket_id='announcement-attachments' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
comment on table public.notification_delivery_logs is 'Delivery attempts are distinct from notification creation and read state. External channels require a configured provider.';
create unique index if not exists notifications_user_related_uidx on public.notifications(user_id, related_type, related_id) where related_type is not null and related_id is not null;
