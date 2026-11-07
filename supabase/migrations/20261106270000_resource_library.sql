-- ATLAS CMS Step 13: Resource Library.
-- Extends the existing resources table; binary objects remain in private Supabase Storage.
alter table public.resources add column if not exists title text;
alter table public.resources add column if not exists short_description text;
alter table public.resources add column if not exists detailed_description text;
alter table public.resources add column if not exists resource_type text not null default 'Other / Custom';
alter table public.resources add column if not exists language text not null default 'en';
alter table public.resources add column if not exists geographic_coverage text;
alter table public.resources add column if not exists subject_area text;
alter table public.resources add column if not exists publisher text;
alter table public.resources add column if not exists version text not null default '1.0';
alter table public.resources add column if not exists identifier text;
alter table public.resources add column if not exists citation text;
alter table public.resources add column if not exists license text not null default 'Unspecified';
alter table public.resources add column if not exists attribution_requirements text;
alter table public.resources add column if not exists visibility text not null default 'organization_members';
alter table public.resources add column if not exists publication_date date;
alter table public.resources add column if not exists review_date date;
alter table public.resources add column if not exists external_url text;
alter table public.resources add column if not exists status text not null default 'draft';
alter table public.resources add column if not exists published_at timestamptz;
alter table public.resources add column if not exists archived_at timestamptz;
alter table public.resources add column if not exists deleted_at timestamptz;
alter table public.resources add column if not exists tags text[] not null default '{}';
alter table public.resources add column if not exists thumbnail_path text;
alter table public.resources add column if not exists current_version_id uuid;
alter table public.resources add column if not exists download_count bigint not null default 0;
alter table public.resources add column if not exists view_count bigint not null default 0;
update public.resources set title = coalesce(title, name), short_description = coalesce(short_description, description) where title is null or short_description is null;
alter table public.resources alter column title set not null;
alter table public.resources drop constraint if exists resources_visibility_check;
alter table public.resources add constraint resources_visibility_check check (visibility in ('public','organization_members','community_members','selected_roles','private'));
alter table public.resources drop constraint if exists resources_status_check;
alter table public.resources add constraint resources_status_check check (status in ('draft','submitted_for_review','under_review','changes_requested','approved','published','archived'));
create index if not exists resources_library_discovery_idx on public.resources(organization_id, status, resource_type, language, updated_at desc);
create index if not exists resources_library_community_idx on public.resources(organization_id, community_id, status, updated_at desc);
create index if not exists resources_library_search_idx on public.resources using gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(detailed_description,'')));

create table if not exists public.resource_types (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  name text not null, key text not null, description text, is_system boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(organization_id,key)
);
create table if not exists public.resource_tags (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, slug text not null, created_at timestamptz not null default timezone('utc', now()), unique(organization_id,slug)
);
create table if not exists public.resource_tag_assignments (
  resource_id uuid not null references public.resources(id) on delete cascade, tag_id uuid not null references public.resource_tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()), primary key(resource_id,tag_id)
);
create table if not exists public.resource_files (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade, storage_bucket text not null default 'resource-files', storage_path text not null,
  file_name text not null, mime_type text, file_size_bytes bigint check(file_size_bytes is null or file_size_bytes >= 0), checksum text,
  is_current boolean not null default false, is_archived boolean not null default false, uploaded_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()), unique(storage_bucket,storage_path)
);
create table if not exists public.resource_versions (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade, version_number text not null, change_notes text,
  metadata_snapshot jsonb not null default '{}'::jsonb, file_id uuid references public.resource_files(id) on delete restrict,
  uploaded_by uuid references public.user_profiles(id) on delete set null, published_at timestamptz, created_at timestamptz not null default timezone('utc', now()),
  unique(resource_id,version_number)
);
create table if not exists public.resource_collections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, slug text not null, description text, parent_collection_id uuid references public.resource_collections(id) on delete set null,
  is_active boolean not null default true, created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(organization_id,slug)
);
create table if not exists public.resource_collection_items (
  collection_id uuid not null references public.resource_collections(id) on delete cascade, resource_id uuid not null references public.resources(id) on delete cascade,
  display_order integer not null default 0, created_at timestamptz not null default timezone('utc', now()), primary key(collection_id,resource_id)
);
create table if not exists public.resource_contributors (
  resource_id uuid not null references public.resources(id) on delete cascade, user_id uuid references public.user_profiles(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade, contributor_name text not null, contributor_role text,
  display_order integer not null default 0, created_at timestamptz not null default timezone('utc', now()), primary key(resource_id,contributor_name)
);
create table if not exists public.resource_reviews (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade, reviewer_user_id uuid references public.user_profiles(id) on delete set null,
  decision text not null check(decision in ('submitted_for_review','under_review','changes_requested','approved','rejected','note')), internal_notes text,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.resource_activity_logs (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade, actor_user_id uuid references public.user_profiles(id) on delete set null,
  activity_type text not null check(activity_type in ('view','download_attempt','download_success','external_click','created','updated','version_uploaded','reviewed','published','archived','restored')),
  session_hash text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default timezone('utc', now())
);

insert into public.resource_types(organization_id,name,key,is_system) values
(null,'Research Paper','research_paper',true),(null,'Research Report','research_report',true),(null,'Policy Brief','policy_brief',true),(null,'Policy Framework','policy_framework',true),(null,'Dataset','dataset',true),(null,'Toolkit','toolkit',true),(null,'Template','template',true),(null,'Handbook','handbook',true),(null,'Guideline','guideline',true),(null,'Training Material','training_material',true),(null,'Presentation','presentation',true),(null,'Book / E-book','book',true),(null,'Software / Digital Tool','software',true),(null,'Video','video',true),(null,'Audio','audio',true),(null,'Image / Infographic','image',true),(null,'Reference Document','reference_document',true),(null,'Legal / Regulatory Document','legal',true),(null,'Other / Custom','other',true) on conflict do nothing;
insert into public.permissions(key,name,description) values
('resources.view','View resources','View permitted resources.'),('resources.upload','Upload resources','Create resources and versions.'),('resources.update','Update resources','Edit resource metadata.'),('resources.review','Review resources','Review resource submissions.'),('resources.publish','Publish resources','Publish approved resources.'),('resources.archive','Archive resources','Archive and restore resources.'),('resources.collections.manage','Manage collections','Manage resource collections and categories.'),('resources.analytics.view','View resource analytics','View authorized resource activity.') on conflict(key) do update set name=excluded.name,description=excluded.description;

alter table public.resource_types enable row level security; alter table public.resource_tags enable row level security; alter table public.resource_tag_assignments enable row level security;
alter table public.resource_files enable row level security; alter table public.resource_versions enable row level security; alter table public.resource_collections enable row level security; alter table public.resource_collection_items enable row level security;
alter table public.resource_contributors enable row level security; alter table public.resource_reviews enable row level security; alter table public.resource_activity_logs enable row level security;
create policy resource_types_access on public.resource_types for all using(organization_id is null or public.is_active_org_member(organization_id)) with check(organization_id is null or public.is_org_admin(organization_id));
create policy resource_tags_access on public.resource_tags for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy resource_tag_assignments_access on public.resource_tag_assignments for all using(exists(select 1 from public.resources r join public.resource_tags t on t.id=tag_id where r.id=resource_id and r.organization_id=t.organization_id and public.is_active_org_member(r.organization_id))) with check(exists(select 1 from public.resources r join public.resource_tags t on t.id=tag_id where r.id=resource_id and r.organization_id=t.organization_id and public.is_org_admin(r.organization_id)));
create policy resource_files_access on public.resource_files for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy resource_versions_access on public.resource_versions for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy resource_collections_access on public.resource_collections for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy resource_collection_items_access on public.resource_collection_items for all using(exists(select 1 from public.resource_collections c join public.resources r on r.organization_id=c.organization_id where c.id=collection_id and r.id=resource_id and public.is_active_org_member(c.organization_id))) with check(exists(select 1 from public.resource_collections c join public.resources r on r.organization_id=c.organization_id where c.id=collection_id and r.id=resource_id and public.is_org_admin(c.organization_id)));
create policy resource_contributors_access on public.resource_contributors for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy resource_reviews_access on public.resource_reviews for all using(public.is_active_org_member(organization_id)) with check(public.is_org_admin(organization_id));
create policy resource_activity_logs_select on public.resource_activity_logs for select using(public.is_active_org_member(organization_id));
create policy resource_activity_logs_insert on public.resource_activity_logs for insert with check(public.is_active_org_member(organization_id));
insert into storage.buckets(id,name,public) values('resource-files','resource-files',false) on conflict(id) do update set public=false;
create policy resource_files_storage_select on storage.objects for select using(bucket_id='resource-files' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
create policy resource_files_storage_insert on storage.objects for insert with check(bucket_id='resource-files' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
comment on table public.resources is 'Resource Library metadata. Binary files are private objects in resource-files and require signed URLs.';
