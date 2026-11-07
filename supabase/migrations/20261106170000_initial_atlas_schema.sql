-- ATLAS CMS Step 03: normalized multi-tenant schema
-- Authentication and RLS policies are intentionally deferred to a later stage.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  logo_url text,
  website text,
  contact_email text,
  country text,
  organization_type text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Future Supabase Auth profile bridge. The auth.users relation is provided by Supabase.
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  designation text,
  organization_name text,
  country text,
  preferred_language text not null default 'en',
  profile_visibility text not null default 'members' check (profile_visibility in ('public', 'members', 'private')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  scope text not null check (scope in ('system', 'organization', 'community')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  membership_status text not null default 'active' check (membership_status in ('invited', 'active', 'suspended', 'archived')),
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create table if not exists public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  default_language text not null default 'en',
  default_timezone text not null default 'UTC',
  notification_preferences jsonb not null default '{}'::jsonb,
  security_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists organization_domains_one_primary
  on public.organization_domains (organization_id) where is_primary;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  logo_url text,
  cover_image_url text,
  category text,
  visibility text not null default 'members' check (visibility in ('public', 'members', 'private')),
  membership_type text not null default 'application' check (membership_type in ('open', 'application', 'invitation')),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, slug)
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  membership_category text,
  membership_status text not null default 'pending' check (membership_status in ('pending', 'active', 'suspended', 'archived')),
  joined_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (community_id, user_id),
  check (organization_id is not null)
);

create index if not exists community_memberships_org_idx on public.community_memberships (organization_id);
create index if not exists community_memberships_community_idx on public.community_memberships (community_id);
create index if not exists community_memberships_user_idx on public.community_memberships (user_id);
create unique index if not exists community_memberships_one_active
  on public.community_memberships (community_id, user_id) where membership_status = 'active';

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  applicant_user_id uuid references public.user_profiles(id) on delete set null,
  applicant_name text not null,
  applicant_email text not null,
  application_category text,
  submitted_information jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'information_requested', 'withdrawn')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists membership_applications_context_idx on public.membership_applications (organization_id, community_id, status);

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.membership_applications(id) on delete cascade,
  reviewer_user_id uuid references public.user_profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'information_requested', 'note')),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.membership_applications(id) on delete cascade,
  document_type text,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.committees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null,
  description text,
  responsibilities text,
  status text not null default 'active' check (status in ('forming', 'active', 'inactive', 'archived')),
  term_start date,
  term_end date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (term_end is null or term_start is null or term_end >= term_start)
);

create table if not exists public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  committee_role text not null default 'member' check (committee_role in ('chairperson', 'secretary', 'member')),
  appointed_at date,
  term_start date,
  term_end date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (committee_id, user_id),
  check (term_end is null or term_start is null or term_end >= term_start)
);

create unique index if not exists committee_one_chair
  on public.committee_members (committee_id) where committee_role = 'chairperson';
create unique index if not exists committee_one_secretary
  on public.committee_members (committee_id) where committee_role = 'secretary';

create table if not exists public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  scheduled_at timestamptz not null,
  location text,
  meeting_type text not null default 'online' check (meeting_type in ('online', 'offline', 'hybrid')),
  agenda text,
  status text not null default 'scheduled' check (status in ('scheduled', 'held', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.committee_minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.committee_meetings(id) on delete cascade,
  recorded_by uuid references public.user_profiles(id) on delete set null,
  minutes text not null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.committee_resolutions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  meeting_id uuid references public.committee_meetings(id) on delete set null,
  title text not null,
  resolution_text text not null,
  decision_status text not null default 'proposed' check (decision_status in ('proposed', 'approved', 'rejected', 'deferred')),
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  committee_id uuid references public.committees(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  appointment_title text not null,
  appointed_by uuid references public.user_profiles(id) on delete set null,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'revoked')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  title text not null,
  description text,
  event_type text,
  mode text not null default 'online' check (mode in ('online', 'offline', 'hybrid')),
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  registration_required boolean not null default true,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  registration_status text not null default 'registered' check (registration_status in ('registered', 'waitlisted', 'cancelled')),
  registered_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  attendance_status text not null check (attendance_status in ('present', 'absent', 'excused')),
  recorded_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.content_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, slug)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  category_id uuid references public.content_categories(id) on delete set null,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  slug text not null,
  content_type text not null check (content_type in ('page', 'article', 'news', 'announcement', 'report', 'publication', 'guideline')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  excerpt text,
  body jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, slug)
);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  revision_number integer not null check (revision_number > 0),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (content_item_id, revision_number)
);

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  title text not null,
  publication_type text,
  publisher text,
  publication_date date,
  identifier text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, slug)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  category_id uuid references public.resource_categories(id) on delete set null,
  uploaded_by uuid references public.user_profiles(id) on delete set null,
  name text not null,
  description text,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  access_classification text not null default 'members' check (access_classification in ('public', 'organization', 'members', 'administrators')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resource_access_rules (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (role_id is not null or community_id is not null)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  author_user_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  subject text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references public.user_profiles(id) on delete set null,
  body text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz
);

create table if not exists public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, community_id, user_id, role_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  community_id uuid references public.communities(id) on delete set null,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  module text not null,
  target_record_id uuid,
  target_record_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists communities_org_idx on public.communities (organization_id);
create index if not exists organization_memberships_user_idx on public.organization_memberships (user_id);
create index if not exists committees_context_idx on public.committees (organization_id, community_id);
create index if not exists events_context_idx on public.events (organization_id, community_id, starts_at);
create index if not exists content_items_context_idx on public.content_items (organization_id, community_id, status);
create index if not exists resources_context_idx on public.resources (organization_id, community_id);
create index if not exists announcements_context_idx on public.announcements (organization_id, community_id, status);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index if not exists audit_logs_context_idx on public.audit_logs (organization_id, community_id, created_at desc);

-- Keep updated_at consistent without destructive migrations.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','user_profiles','roles','organization_memberships','organization_settings','organization_domains',
    'communities','community_memberships','membership_applications','committees','committee_members','committee_meetings',
    'committee_minutes','committee_resolutions','appointments','events','content_categories','content_items','publications',
    'resource_categories','resources','announcements','conversations','user_role_assignments'
  ] loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

comment on table public.organizations is 'Top-level tenant. All tenant-owned records resolve back to this table.';
comment on table public.user_profiles is 'Future auth.users profile bridge; authentication is not implemented by this migration.';
comment on table public.community_memberships is 'Shared user identity to community relationship; one row per user/community pair.';
comment on table public.resources is 'Stores metadata and Supabase Storage paths, never binary file contents.';
comment on table public.audit_logs is 'Append-only administrative activity record; RLS is required before production use.';
