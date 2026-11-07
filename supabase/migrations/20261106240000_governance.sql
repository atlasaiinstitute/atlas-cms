-- ATLAS CMS Step 10: configurable Committees & Governance.
-- Reuses existing committees, appointments, meetings, minutes and resolutions tables.
-- Authentication and calendar integration remain deferred.

alter table public.committees alter column community_id drop not null;
alter table public.committees add column if not exists committee_code text;
alter table public.committees add column if not exists committee_type text not null default 'custom';
alter table public.committees add column if not exists establishment_date date;
alter table public.committees add column if not exists effective_date date;
alter table public.committees add column if not exists term_duration_months integer;
alter table public.committees add column if not exists scope_of_authority text;
alter table public.committees add column if not exists reporting_authority text;
alter table public.committees add column if not exists public_visibility text not null default 'private' check (public_visibility in ('public','members','private'));
alter table public.committees drop constraint if exists committees_status_check;
alter table public.committees add constraint committees_status_check check (status in ('draft','active','inactive','suspended','dissolved','archived','forming'));
create unique index if not exists committees_org_code_uidx on public.committees(organization_id, committee_code) where committee_code is not null;
create index if not exists committees_governance_scope_idx on public.committees(organization_id, community_id, status, committee_type);

alter table public.appointments add column if not exists appointment_reference text;
alter table public.appointments add column if not exists appointment_type text not null default 'appointed' check (appointment_type in ('elected','appointed','nominated','ex_officio','temporary','observer'));
alter table public.appointments add column if not exists appointment_authority text;
alter table public.appointments add column if not exists internal_notes text;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status in ('pending','active','completed','resigned','removed','suspended','expired','revoked'));
create unique index if not exists appointments_reference_uidx on public.appointments(appointment_reference) where appointment_reference is not null;
create index if not exists appointments_committee_term_idx on public.appointments(committee_id, status, start_date, end_date);

create table if not exists public.committee_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  name text not null,
  description text,
  position_class text not null default 'ordinary' check (position_class in ('leadership','executive','advisory','ordinary')),
  maximum_seats integer not null default 1 check (maximum_seats > 0),
  reporting_position_id uuid references public.committee_positions(id) on delete set null,
  eligibility_rules jsonb not null default '{}'::jsonb,
  voting_rights boolean not null default true,
  tenure_type text not null default 'term_based' check (tenure_type in ('permanent','term_based','temporary')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (committee_id, name)
);
create table if not exists public.committee_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  position_id uuid not null references public.committee_positions(id) on delete restrict,
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  appointment_reference text not null unique,
  appointment_type text not null check (appointment_type in ('elected','appointed','nominated','ex_officio','temporary','observer')),
  start_date date not null,
  end_date date,
  status text not null default 'pending' check (status in ('pending','active','completed','resigned','removed','suspended','expired')),
  appointed_by uuid references public.user_profiles(id) on delete set null,
  appointment_authority text,
  internal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date is null or end_date >= start_date),
  unique (committee_id, position_id, user_id, start_date)
);
create unique index if not exists committee_position_one_active_seat_idx on public.committee_appointments(committee_id, position_id, user_id) where status in ('pending','active');
create table if not exists public.committee_meeting_participants (
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  attendance_status text not null default 'invited' check (attendance_status in ('invited','present','absent','excused')),
  primary key (meeting_id, user_id)
);
create table if not exists public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  title text not null,
  owner_user_id uuid references public.user_profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.governance_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  committee_id uuid references public.committees(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  meeting_id uuid references public.committee_meetings(id) on delete set null,
  decision_id uuid references public.committee_resolutions(id) on delete set null,
  category text not null check (category in ('appointment_letter','terms_of_reference','agenda','minutes','resolution','policy','supporting')),
  file_name text not null,
  storage_bucket text not null default 'governance-documents',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.committee_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  committee_id uuid not null references public.committees(id) on delete cascade,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.governance_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  committee_creation_permission text not null default 'governance.committees.create',
  appointment_authority text not null default 'organization_admin',
  default_term_months integer,
  renewal_allowed boolean not null default true,
  committee_size_limit integer,
  quorum_required integer,
  voting_threshold numeric(5,2),
  meeting_frequency text,
  decision_approval_required boolean not null default true,
  public_disclosure_default text not null default 'private' check (public_disclosure_default in ('public','members','private')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.permissions(key,name,description) values
('governance.view','View governance','View permitted governance records.'),('governance.committees.create','Create committees','Create governance committees.'),('governance.committees.update','Update committees','Edit committee configuration.'),('governance.committees.archive','Archive committees','Archive or dissolve committees.'),('governance.positions.manage','Manage positions','Manage committee positions.'),('governance.appointments.manage','Manage appointments','Appoint and manage committee members.'),('governance.terms.manage','Manage terms','Extend, renew, or end terms.'),('governance.meetings.manage','Manage meetings','Schedule and record meetings.'),('governance.decisions.create','Create decisions','Record governance decisions.'),('governance.decisions.approve','Approve decisions','Approve governance decisions.'),('governance.documents.manage','Manage governance documents','Upload and manage governance records.') on conflict(key) do update set name=excluded.name, description=excluded.description;

create index if not exists committee_positions_scope_idx on public.committee_positions(organization_id, committee_id, is_active);
create index if not exists committee_appointments_scope_idx on public.committee_appointments(organization_id, committee_id, status, end_date);
create index if not exists governance_documents_scope_idx on public.governance_documents(organization_id, committee_id, category, is_archived);
create index if not exists committee_history_idx on public.committee_history(organization_id, committee_id, created_at desc);

alter table public.committee_positions enable row level security;
alter table public.committee_appointments enable row level security;
alter table public.committee_meeting_participants enable row level security;
alter table public.meeting_action_items enable row level security;
alter table public.governance_documents enable row level security;
alter table public.committee_history enable row level security;
alter table public.governance_rules enable row level security;
create policy committee_positions_access on public.committee_positions for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy committee_appointments_access on public.committee_appointments for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy meeting_participants_access on public.committee_meeting_participants for all using (exists(select 1 from public.committee_meetings m join public.committees c on c.id=m.committee_id where m.id=meeting_id and public.is_active_org_member(c.organization_id))) with check (exists(select 1 from public.committee_meetings m join public.committees c on c.id=m.committee_id where m.id=meeting_id and public.is_org_admin(c.organization_id)));
create policy meeting_action_items_access on public.meeting_action_items for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy governance_documents_access on public.governance_documents for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy committee_history_access on public.committee_history for select using (public.is_active_org_member(organization_id));
create policy governance_rules_access on public.governance_rules for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
insert into storage.buckets(id,name,public) values('governance-documents','governance-documents',false) on conflict(id) do update set public=false;
create policy governance_storage_select on storage.objects for select using (bucket_id='governance-documents' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
create policy governance_storage_insert on storage.objects for insert with check (bucket_id='governance-documents' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
comment on table public.governance_rules is 'Organization-configurable governance recordkeeping rules; not legal certification or a parliamentary voting engine.';
