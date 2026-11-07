-- ATLAS CMS Step 18: white-label branding and custom domain management.
-- Provider credentials and DNS checks stay server-side; this migration stores state, not secrets.
create table if not exists public.organization_branding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  display_name text not null,
  short_name text not null,
  description text not null default '',
  public_website_url text,
  contact_email text,
  footer_text text not null default '',
  welcome_message text not null default '',
  logo_url text,
  light_logo_url text,
  dark_logo_url text,
  favicon_url text,
  primary_color text not null default '#233B5B' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#B69A62' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#527AA6' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#F8F8F6' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  typography_token text not null default 'Inter' check (typography_token in ('Inter','DM Sans','Source Sans 3')),
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
-- organization_domains already exists from the foundation schema. Extend it
-- additively so existing domain rows and verification history are preserved.
alter table public.organization_domains
  add column if not exists hostname text,
  add column if not exists domain_kind text,
  add column if not exists status text,
  add column if not exists normalized_hostname text generated always as (lower(trim(trailing '.' from coalesce(hostname, domain)))) stored,
  add column if not exists verification_token_hash text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists provider_domain_id text,
  add column if not exists provider_error text,
  add column if not exists created_by uuid references public.user_profiles(id) on delete set null;
update public.organization_domains
set hostname = coalesce(hostname, domain),
    domain_kind = coalesce(domain_kind, 'custom'),
    status = coalesce(status, case verification_status when 'verified' then 'verified' when 'failed' then 'failed' else 'verification_required' end)
where hostname is null or domain_kind is null or status is null;
alter table public.organization_domains alter column hostname set not null;
alter table public.organization_domains alter column domain_kind set default 'custom';
alter table public.organization_domains alter column domain_kind set not null;
alter table public.organization_domains alter column status set default 'pending';
alter table public.organization_domains alter column status set not null;
alter table public.organization_domains drop constraint if exists organization_domains_domain_kind_check;
alter table public.organization_domains add constraint organization_domains_domain_kind_check check (domain_kind in ('subdomain','custom'));
alter table public.organization_domains drop constraint if exists organization_domains_status_check;
alter table public.organization_domains add constraint organization_domains_status_check check (status in ('pending','verification_required','verified','provisioning','active','failed','removed'));
create unique index if not exists organization_domains_normalized_hostname_uidx on public.organization_domains(normalized_hostname);
create index if not exists organization_domains_resolution_idx on public.organization_domains(normalized_hostname, status);
create table if not exists public.organization_email_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  sender_display_name text,
  sender_email text,
  reply_to_email text,
  email_logo_url text,
  email_footer text,
  provider_identity_id text,
  provider_verification_status text not null default 'not_configured' check (provider_verification_status in ('not_configured','pending','verified','failed')),
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.reserved_subdomains (
  value text primary key check (value = lower(value)),
  reason text not null default 'platform reserved',
  created_at timestamptz not null default timezone('utc', now())
);
insert into public.reserved_subdomains(value) values ('www'),('app'),('admin'),('api'),('auth'),('docs'),('support'),('status'),('mail') on conflict do nothing;

alter table public.organization_branding enable row level security;
alter table public.organization_domains enable row level security;
alter table public.organization_email_settings enable row level security;
alter table public.reserved_subdomains enable row level security;
-- Tenant-aware access: members may read their organization's branding, but only
-- organization/platform administrators may change identity, domains, or email settings.
drop policy if exists organization_branding_select on public.organization_branding;
create policy organization_branding_select on public.organization_branding for select to authenticated
  using (public.is_active_org_member(organization_id));
drop policy if exists organization_branding_write on public.organization_branding;
create policy organization_branding_write on public.organization_branding for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists organization_domains_access on public.organization_domains;
create policy organization_domains_access on public.organization_domains for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists organization_email_settings_access on public.organization_email_settings;
create policy organization_email_settings_access on public.organization_email_settings for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists reserved_subdomains_platform_select on public.reserved_subdomains;
create policy reserved_subdomains_platform_select on public.reserved_subdomains for select to authenticated
  using (public.is_platform_admin() or exists (select 1 from public.organization_memberships m where m.user_id = auth.uid() and m.membership_status = 'active'));
drop policy if exists reserved_subdomains_platform_write on public.reserved_subdomains;
create policy reserved_subdomains_platform_write on public.reserved_subdomains for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create index if not exists organization_branding_updated_idx on public.organization_branding(updated_at desc);
create index if not exists organization_email_settings_updated_idx on public.organization_email_settings(updated_at desc);

-- Step 17 audit trigger coverage: all sensitive changes are recorded without token hashes or provider credentials.
-- Apply the existing capture_audit_event trigger only where the trigger function exists.
drop trigger if exists organization_branding_audit on public.organization_branding;
create trigger organization_branding_audit after insert or update or delete on public.organization_branding for each row execute function public.capture_audit_event();
drop trigger if exists organization_domains_audit on public.organization_domains;
create trigger organization_domains_audit after insert or update or delete on public.organization_domains for each row execute function public.capture_audit_event();
drop trigger if exists organization_email_settings_audit on public.organization_email_settings;
create trigger organization_email_settings_audit after insert or update or delete on public.organization_email_settings for each row execute function public.capture_audit_event();
