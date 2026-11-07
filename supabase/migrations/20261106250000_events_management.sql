-- ATLAS CMS Step 11: Events Management.
-- Reuses events, event_registrations and event_attendance.
-- Authentication and external calendar integration remain deferred.

alter table public.events add column if not exists slug text;
alter table public.events add column if not exists short_description text;
alter table public.events add column if not exists category text;
alter table public.events add column if not exists organizer_name text;
alter table public.events add column if not exists contact_email text;
alter table public.events add column if not exists contact_phone text;
alter table public.events add column if not exists timezone text not null default 'UTC';
alter table public.events add column if not exists registration_opens_at timestamptz;
alter table public.events add column if not exists registration_closes_at timestamptz;
alter table public.events add column if not exists physical_address text;
alter table public.events add column if not exists meeting_url text;
alter table public.events add column if not exists access_instructions text;
alter table public.events add column if not exists location_visibility text not null default 'members' check (location_visibility in ('public','members','private'));
alter table public.events add column if not exists public_registration boolean not null default false;
alter table public.events add column if not exists member_only_registration boolean not null default false;
alter table public.events add column if not exists approval_required boolean not null default false;
alter table public.events add column if not exists waitlist_enabled boolean not null default true;
alter table public.events add column if not exists cover_image_url text;
alter table public.events add column if not exists visibility text not null default 'members' check (visibility in ('public','members','private'));
alter table public.events add column if not exists event_summary text;
alter table public.events add column if not exists key_outcomes text;
alter table public.events add column if not exists lessons_learned text;
alter table public.events add column if not exists follow_up_actions text;
alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check (status in ('draft','published','registration_open','registration_closed','ongoing','completed','cancelled','archived'));
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (mode in ('online','offline','hybrid'));
create unique index if not exists events_org_slug_uidx on public.events(organization_id, slug) where slug is not null;
create index if not exists events_dashboard_idx on public.events(organization_id, community_id, status, starts_at);

alter table public.event_registrations alter column user_id drop not null;
alter table public.event_registrations add column if not exists registration_reference text;
alter table public.event_registrations add column if not exists guest_name text;
alter table public.event_registrations add column if not exists guest_email text;
alter table public.event_registrations add column if not exists institution text;
alter table public.event_registrations add column if not exists designation text;
alter table public.event_registrations add column if not exists country text;
alter table public.event_registrations add column if not exists contact_number text;
alter table public.event_registrations add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.event_registrations add column if not exists administrative_notes text;
alter table public.event_registrations drop constraint if exists event_registrations_status_check;
alter table public.event_registrations add constraint event_registrations_status_check check (registration_status in ('pending','approved','waitlisted','rejected','cancelled','attended','no_show','registered'));
create unique index if not exists event_registrations_reference_uidx on public.event_registrations(registration_reference) where registration_reference is not null;
create unique index if not exists event_registrations_guest_email_idx on public.event_registrations(event_id, lower(guest_email)) where guest_email is not null and registration_status not in ('cancelled','rejected');

alter table public.event_attendance alter column user_id drop not null;
alter table public.event_attendance add column if not exists attendance_status text not null default 'present';
alter table public.event_attendance add column if not exists check_in_token_hash text;
alter table public.event_attendance add column if not exists checked_in_at timestamptz;
alter table public.event_attendance drop constraint if exists event_attendance_status_check;
alter table public.event_attendance add constraint event_attendance_status_check check (attendance_status in ('present','absent','late','excused'));

create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade, title text not null, description text, starts_at timestamptz not null, ends_at timestamptz not null, speaker_name text, moderator_name text, session_type text not null default 'session', location text, meeting_url text, display_order integer not null default 0, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), check (ends_at >= starts_at)
);
create table if not exists public.event_speakers (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade, user_id uuid references public.user_profiles(id) on delete set null, full_name text not null, designation text, institution text, biography text, avatar_url text, expertise text, website text, linkedin_url text, speaker_type text not null default 'external' check (speaker_type in ('internal','external','organizer','moderator','facilitator')), created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.event_resources (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, event_id uuid not null references public.events(id) on delete cascade, file_name text not null, storage_bucket text not null default 'event-resources', storage_path text not null, category text not null default 'supporting', access_level text not null default 'organizer' check (access_level in ('public','participants','organizer')), mime_type text, file_size_bytes bigint, is_archived boolean not null default false, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.event_reports (
  id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.events(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, summary text, key_outcomes text, lessons_learned text, follow_up_actions text, published_at timestamptz, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.event_feedback (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade, user_id uuid references public.user_profiles(id) on delete set null, guest_email text, rating integer check (rating between 1 and 5), feedback text, created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.event_registration_forms (
  id uuid primary key default gen_random_uuid(), event_id uuid not null unique references public.events(id) on delete cascade, fields jsonb not null default '[]'::jsonb, is_active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

insert into public.permissions(key,name,description) values
('events.view','View events','View permitted events.'),('events.create','Create events','Create events.'),('events.update','Update events','Edit events.'),('events.publish','Publish events','Publish events.'),('events.cancel','Cancel events','Cancel events.'),('events.archive','Archive events','Archive events.'),('events.registrations.view','View registrations','View event registrations.'),('events.registrations.manage','Manage registrations','Approve, reject, and cancel registrations.'),('events.participants.export','Export participants','Export authorized participant lists.'),('events.attendance.manage','Manage attendance','Record event attendance.'),('events.resources.manage','Manage event resources','Manage event documents.'),('events.reports.view','View event reports','View event reporting.') on conflict(key) do update set name=excluded.name, description=excluded.description;

create index if not exists event_sessions_time_idx on public.event_sessions(event_id, starts_at);
create index if not exists event_speakers_event_idx on public.event_speakers(event_id, speaker_type);
create index if not exists event_resources_scope_idx on public.event_resources(organization_id,event_id,access_level,is_archived);
create index if not exists event_attendance_event_idx on public.event_attendance(event_id,attendance_status);

alter table public.event_sessions enable row level security;
alter table public.event_speakers enable row level security;
alter table public.event_resources enable row level security;
alter table public.event_reports enable row level security;
alter table public.event_feedback enable row level security;
alter table public.event_registration_forms enable row level security;
create policy event_sessions_access on public.event_sessions for all using (exists(select 1 from public.events e where e.id=event_id and public.is_active_org_member(e.organization_id))) with check (exists(select 1 from public.events e where e.id=event_id and public.is_org_admin(e.organization_id)));
create policy event_speakers_access on public.event_speakers for all using (exists(select 1 from public.events e where e.id=event_id and public.is_active_org_member(e.organization_id))) with check (exists(select 1 from public.events e where e.id=event_id and public.is_org_admin(e.organization_id)));
create policy event_resources_access on public.event_resources for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy event_reports_access on public.event_reports for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy event_feedback_access on public.event_feedback for all using (exists(select 1 from public.events e where e.id=event_id and public.is_active_org_member(e.organization_id))) with check (exists(select 1 from public.events e where e.id=event_id and public.is_active_org_member(e.organization_id)));
create policy event_registration_forms_access on public.event_registration_forms for all using (exists(select 1 from public.events e where e.id=event_id and public.is_active_org_member(e.organization_id))) with check (exists(select 1 from public.events e where e.id=event_id and public.is_org_admin(e.organization_id)));
insert into storage.buckets(id,name,public) values('event-resources','event-resources',false) on conflict(id) do update set public=false;
create policy event_resources_storage_select on storage.objects for select using (bucket_id='event-resources' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
create policy event_resources_storage_insert on storage.objects for insert with check (bucket_id='event-resources' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
comment on table public.event_feedback is 'Optional feedback collection; no identity verification is implied before Step 19.';
