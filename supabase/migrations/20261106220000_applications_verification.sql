-- ATLAS CMS Step 08: Applications & Verification.
-- Reuses membership_applications, application_reviews and application_documents.
-- Authentication remains deferred to Step 19.

alter table public.membership_applications add column if not exists application_reference text;
alter table public.membership_applications add column if not exists application_type text not null default 'community_membership' check (application_type in ('organization_membership','community_membership'));
alter table public.membership_applications add column if not exists form_version_id uuid;
alter table public.membership_applications add column if not exists withdrawn_at timestamptz;
alter table public.membership_applications add column if not exists archived_at timestamptz;
alter table public.membership_applications drop constraint if exists membership_applications_status_check;
alter table public.membership_applications add constraint membership_applications_status_check check (status in ('draft','submitted','under_review','information_requested','approved','rejected','withdrawn','archived'));

create unique index if not exists membership_applications_reference_uidx on public.membership_applications(application_reference) where application_reference is not null;
create unique index if not exists membership_applications_active_duplicate_idx on public.membership_applications (coalesce(applicant_user_id, '00000000-0000-0000-0000-000000000000'::uuid), organization_id, coalesce(community_id, '00000000-0000-0000-0000-000000000000'::uuid), application_type) where status in ('draft','submitted','under_review','information_requested');
create index if not exists membership_applications_dashboard_idx on public.membership_applications (organization_id, application_type, status, submitted_at desc);

create table if not exists public.application_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  name text not null,
  application_type text not null check (application_type in ('organization_membership','community_membership')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, community_id, name)
);
create table if not exists public.application_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.application_forms(id) on delete cascade,
  version integer not null check (version > 0),
  fields jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  eligibility_rules jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (form_id, version)
);
alter table public.membership_applications add constraint membership_applications_form_version_fk foreign key (form_version_id) references public.application_form_versions(id) on delete set null;

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.membership_applications(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  previous_status text,
  new_status text not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.application_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.membership_applications(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_user_id uuid not null references public.user_profiles(id) on delete cascade,
  assigned_by uuid references public.user_profiles(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  unassigned_at timestamptz
);
create unique index if not exists application_one_active_reviewer_idx on public.application_reviewer_assignments(application_id, reviewer_user_id) where unassigned_at is null;

alter table public.application_documents add column if not exists storage_bucket text not null default 'application-documents';
alter table public.application_documents add column if not exists verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected'));
alter table public.application_documents add column if not exists reviewer_user_id uuid references public.user_profiles(id) on delete set null;
alter table public.application_documents add column if not exists reviewer_notes text;
alter table public.application_documents add column if not exists verified_at timestamptz;
alter table public.application_documents add column if not exists uploaded_at timestamptz not null default timezone('utc', now());

create index if not exists application_status_history_idx on public.application_status_history(organization_id, application_id, created_at desc);
create index if not exists application_reviewer_assignments_idx on public.application_reviewer_assignments(organization_id, reviewer_user_id, unassigned_at);
create index if not exists application_documents_verification_idx on public.application_documents(application_id, verification_status);

alter table public.application_forms enable row level security;
alter table public.application_form_versions enable row level security;
alter table public.application_status_history enable row level security;
alter table public.application_reviewer_assignments enable row level security;
create policy application_forms_access on public.application_forms for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id, organization_id)));
create policy application_form_versions_access on public.application_form_versions for all using (exists (select 1 from public.application_forms f where f.id = form_id and public.is_active_org_member(f.organization_id))) with check (exists (select 1 from public.application_forms f where f.id = form_id and public.is_org_admin(f.organization_id)));
create policy application_status_history_access on public.application_status_history for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy application_reviewer_assignments_access on public.application_reviewer_assignments for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));

-- Private bucket policy. No public URL is created for application documents.
insert into storage.buckets (id, name, public) values ('application-documents', 'application-documents', false) on conflict (id) do update set public = false;
create policy application_documents_storage_select on storage.objects for select using (bucket_id = 'application-documents' and exists (select 1 from public.application_documents d join public.membership_applications a on a.id = d.application_id where d.storage_bucket = bucket_id and d.storage_path = name and public.is_active_org_member(a.organization_id)));
create policy application_documents_storage_insert on storage.objects for insert with check (bucket_id = 'application-documents' and public.is_org_admin(((storage.foldername(name))[1])::uuid));

comment on table public.application_status_history is 'Immutable status transition audit trail; internal reasons are never exposed to applicants.';
comment on table public.application_forms is 'Tenant-scoped structured application form definitions; fields are validated JSON, never executable code.';
