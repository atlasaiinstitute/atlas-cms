-- ATLAS CMS Step 12: Content Management System.
-- Reuses content_items, content_categories and content_revisions.
-- Authentication and reliable scheduled execution remain deferred.

alter table public.content_items add column if not exists subtitle text;
alter table public.content_items add column if not exists content_type_key text;
alter table public.content_items add column if not exists visibility text not null default 'private' check (visibility in ('public','members','private'));
alter table public.content_items add column if not exists featured boolean not null default false;
alter table public.content_items add column if not exists scheduled_for timestamptz;
alter table public.content_items add column if not exists seo_title text;
alter table public.content_items add column if not exists meta_description text;
alter table public.content_items add column if not exists canonical_url text;
alter table public.content_items add column if not exists language text not null default 'en';
alter table public.content_items add column if not exists keywords text[] not null default '{}';
alter table public.content_items add column if not exists cover_media_id uuid;
alter table public.content_items drop constraint if exists content_items_type_check;
alter table public.content_items drop constraint if exists content_items_status_check;
alter table public.content_items add constraint content_items_status_check check (status in ('draft','submitted_for_review','under_review','changes_requested','approved','scheduled','published','rejected','archived'));
create unique index if not exists content_items_scope_slug_uidx on public.content_items(organization_id, coalesce(community_id,'00000000-0000-0000-0000-000000000000'::uuid), slug);
create index if not exists content_items_discovery_idx on public.content_items(organization_id, community_id, status, content_type, updated_at desc);

create table if not exists public.content_types (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade, name text not null, key text not null, description text, is_system boolean not null default false, is_active boolean not null default true, settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()), unique(organization_id,key)
);
create table if not exists public.content_tags (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, community_id uuid references public.communities(id) on delete cascade, name text not null, slug text not null, description text, is_active boolean not null default true, created_at timestamptz not null default timezone('utc',now()), unique(organization_id,slug)
);
create table if not exists public.content_tag_assignments (
  content_item_id uuid not null references public.content_items(id) on delete cascade, tag_id uuid not null references public.content_tags(id) on delete cascade, created_at timestamptz not null default timezone('utc',now()), primary key(content_item_id,tag_id)
);
create table if not exists public.content_reviews (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references public.content_items(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, reviewer_user_id uuid references public.user_profiles(id) on delete set null, decision text not null check(decision in ('submitted_for_review','under_review','changes_requested','approved','rejected','note')), comments text, created_at timestamptz not null default timezone('utc',now())
);
create table if not exists public.content_pages (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null unique references public.content_items(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, community_id uuid references public.communities(id) on delete cascade, parent_page_id uuid references public.content_pages(id) on delete set null, navigation_label text, navigation_visible boolean not null default true, display_order integer not null default 0, seo_settings jsonb not null default '{}'::jsonb
);
create table if not exists public.content_page_sections (
  id uuid primary key default gen_random_uuid(), page_id uuid not null references public.content_pages(id) on delete cascade, section_type text not null, display_order integer not null default 0, content jsonb not null default '{}'::jsonb, is_visible boolean not null default true
);
create table if not exists public.content_media (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, community_id uuid references public.communities(id) on delete cascade, uploaded_by uuid references public.user_profiles(id) on delete set null, file_name text not null, storage_bucket text not null default 'content-media', storage_path text not null, mime_type text, file_size_bytes bigint, alt_text text, caption text, is_archived boolean not null default false, created_at timestamptz not null default timezone('utc',now())
);
create table if not exists public.content_view_events (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references public.content_items(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, viewer_user_id uuid references public.user_profiles(id) on delete set null, session_hash text, created_at timestamptz not null default timezone('utc',now())
);

insert into public.content_types(organization_id,name,key,description,is_system) values
(null,'Article','article','Editorial article content.',true),(null,'News','news','News update.',true),(null,'Blog Post','blog_post','Blog-style publication.',true),(null,'Research Paper','research_paper','Research paper.',true),(null,'Policy Brief','policy_brief','Policy brief.',true),(null,'Research Report','research_report','Research report.',true),(null,'Working Paper','working_paper','Working paper.',true),(null,'Institutional Publication','institutional_publication','Institutional publication.',true),(null,'Case Study','case_study','Case study.',true),(null,'Press Release','press_release','Press release.',true),(null,'Editorial','editorial','Editorial.',true),(null,'Opinion','opinion','Opinion content.',true),(null,'Event Report','event_report','Event report.',true),(null,'Static Page','page','Structured page.',true)
on conflict do nothing;
insert into public.permissions(key,name,description) values
('content.view','View content','View permitted content.'),('content.create','Create content','Create content.'),('content.update','Update content','Edit content.'),('content.delete','Delete content','Delete content.'),('content.review','Review content','Review editorial submissions.'),('content.approve','Approve content','Approve content.'),('content.publish','Publish content','Publish content.'),('content.schedule','Schedule content','Schedule content publication.'),('content.archive','Archive content','Archive content.'),('content.categories.manage','Manage categories','Manage content categories.'),('content.tags.manage','Manage tags','Manage content tags.'),('content.media.manage','Manage media','Manage content media.'),('content.versions.view','View revisions','View revision history.'),('content.versions.restore','Restore revisions','Restore a previous revision as a new revision.') on conflict(key) do update set name=excluded.name,description=excluded.description;

create index if not exists content_reviews_item_idx on public.content_reviews(content_item_id,created_at desc);
create index if not exists content_media_scope_idx on public.content_media(organization_id,community_id,is_archived,created_at desc);
create index if not exists content_view_events_item_idx on public.content_view_events(content_item_id,created_at desc);

alter table public.content_types enable row level security;
alter table public.content_tags enable row level security;
alter table public.content_tag_assignments enable row level security;
alter table public.content_reviews enable row level security;
alter table public.content_pages enable row level security;
alter table public.content_page_sections enable row level security;
alter table public.content_media enable row level security;
alter table public.content_view_events enable row level security;
create policy content_types_access on public.content_types for all using (organization_id is null or public.is_active_org_member(organization_id)) with check (organization_id is null or public.is_org_admin(organization_id));
create policy content_tags_access on public.content_tags for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id) and (community_id is null or public.community_belongs_to_org(community_id,organization_id)));
create policy content_tag_assignments_access on public.content_tag_assignments for all using (exists(select 1 from public.content_items i join public.content_tags t on t.id=tag_id where i.id=content_item_id and i.organization_id=t.organization_id and public.is_active_org_member(i.organization_id))) with check (exists(select 1 from public.content_items i join public.content_tags t on t.id=tag_id where i.id=content_item_id and i.organization_id=t.organization_id and public.is_org_admin(i.organization_id)));
create policy content_reviews_access on public.content_reviews for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy content_pages_access on public.content_pages for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy content_page_sections_access on public.content_page_sections for all using (exists(select 1 from public.content_pages p where p.id=page_id and public.is_active_org_member(p.organization_id))) with check (exists(select 1 from public.content_pages p where p.id=page_id and public.is_org_admin(p.organization_id)));
create policy content_media_access on public.content_media for all using (public.is_active_org_member(organization_id)) with check (public.is_org_admin(organization_id));
create policy content_view_events_access on public.content_view_events for select using (public.is_active_org_member(organization_id));
insert into storage.buckets(id,name,public) values('content-media','content-media',false) on conflict(id) do update set public=false;
create policy content_media_storage_select on storage.objects for select using (bucket_id='content-media' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
create policy content_media_storage_insert on storage.objects for insert with check (bucket_id='content-media' and public.is_org_admin(((storage.foldername(name))[1])::uuid));
comment on table public.content_items is 'Tenant-scoped structured content. Public access requires explicit published status and public visibility.';
