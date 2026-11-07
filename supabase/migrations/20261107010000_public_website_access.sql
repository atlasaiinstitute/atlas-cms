-- Public Website & Private Workspace Architecture
-- Authentication is intentionally not provisioned here; auth.uid() becomes live once Step 19 connects Supabase Auth.

create table if not exists public.organization_public_access_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  public_website_enabled boolean not null default true,
  public_browsing_enabled boolean not null default true,
  public_registration_enabled boolean not null default false,
  membership_applications_enabled boolean not null default false,
  comments_require_login boolean not null default true,
  reactions_require_login boolean not null default true,
  messaging_requires_login boolean not null default true,
  posting_requires_login boolean not null default true,
  event_registration_requires_account boolean not null default true,
  public_profiles_enabled boolean not null default false,
  public_content_types text[] not null default array['article','news','research_report','policy_brief','publication','report','page'],
  publicly_downloadable_resources boolean not null default true,
  public_community_pages_enabled boolean not null default true,
  disabled_features text[] not null default '{}',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_public_navigation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  href text not null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, href)
);

alter table public.organizations add column if not exists public_website_enabled boolean not null default true;
alter table public.organizations add column if not exists public_website_slug text;
alter table public.organizations add column if not exists custom_domain_verified boolean not null default false;

create index if not exists organization_public_navigation_org_idx on public.organization_public_navigation(organization_id, sort_order);
create unique index if not exists organizations_public_slug_unique on public.organizations(public_website_slug) where public_website_slug is not null;

alter table public.organization_public_access_settings enable row level security;
alter table public.organization_public_navigation enable row level security;

-- Public reads are deliberately narrow. Record-level public visibility still applies to each source table.
create policy "public can read enabled website settings"
  on public.organization_public_access_settings for select
  using (public_website_enabled = true and public_browsing_enabled = true);

create policy "public can read enabled navigation"
  on public.organization_public_navigation for select
  using (is_enabled = true and exists (
    select 1 from public.organization_public_access_settings s
    where s.organization_id = organization_public_navigation.organization_id
      and s.public_website_enabled = true and s.public_browsing_enabled = true
  ));

create policy "organization admins manage public settings"
  on public.organization_public_access_settings for all
  using (exists (select 1 from public.user_role_assignments a where a.organization_id = organization_public_access_settings.organization_id and a.user_id = auth.uid() and a.revoked_at is null))
  with check (exists (select 1 from public.user_role_assignments a where a.organization_id = organization_public_access_settings.organization_id and a.user_id = auth.uid() and a.revoked_at is null));

create policy "organization admins manage public navigation"
  on public.organization_public_navigation for all
  using (exists (select 1 from public.user_role_assignments a where a.organization_id = organization_public_navigation.organization_id and a.user_id = auth.uid() and a.revoked_at is null))
  with check (exists (select 1 from public.user_role_assignments a where a.organization_id = organization_public_navigation.organization_id and a.user_id = auth.uid() and a.revoked_at is null));

-- Public projections must be implemented through views/repositories that require status = published,
-- visibility = public, and organization_id = the resolved tenant. No public policy grants drafts,
-- member-only records, private messages, profile details, or guessed cross-tenant IDs.
comment on table public.organization_public_access_settings is 'Central public/private policy. Secure defaults: public site on, public registration off, interactive actions authenticated.';
