-- ATLAS CMS development seed data only.
-- No real personal profiles or authentication records are inserted here.

insert into public.organizations (id, name, slug, description, website, contact_email, country, organization_type)
values (
  '00000000-0000-0000-0000-000000000001',
  'Atlas AI Institute',
  'atlas-ai-institute',
  'A development tenant for the Atlas AI Institute community network.',
  'https://atlas.ai',
  'operations@example.invalid',
  'Bangladesh',
  'research_institute'
)
on conflict (id) do update set name = excluded.name, description = excluded.description;

insert into public.organization_settings (organization_id, default_language, default_timezone)
values ('00000000-0000-0000-0000-000000000001', 'en', 'Asia/Dhaka')
on conflict (organization_id) do nothing;

insert into public.organization_domains (organization_id, domain, is_primary, verification_status)
values ('00000000-0000-0000-0000-000000000001', 'atlas.example.invalid', true, 'pending')
on conflict (domain) do nothing;

insert into public.communities (id, organization_id, name, slug, description, category, visibility, membership_type, status)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Atlas Global South AI Policy Coalition', 'global-south-ai-policy-coalition', 'Development community for responsible AI policy and public interest technology.', 'Policy & Governance', 'members', 'application', 'active'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Atlas Women''s Safety Network', 'womens-safety-network', 'Development community for safer digital environments and inclusive technology practice.', 'Safety & Wellbeing', 'members', 'application', 'active'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Atlas AI Research Community', 'ai-research-community', 'Development community for applied AI research and institutional collaboration.', 'Research', 'members', 'application', 'active'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Atlas AI Education Community', 'ai-education-community', 'Development community for AI literacy, teaching practice and peer learning.', 'Education', 'members', 'application', 'active')
on conflict (id) do update set name = excluded.name, description = excluded.description;

insert into public.roles (id, name, key, description, scope)
values
  ('00000000-0000-0000-0000-000000001001', 'Super Administrator', 'super_admin', 'System-wide platform administration.', 'system'),
  ('00000000-0000-0000-0000-000000001002', 'Organization Administrator', 'organization_admin', 'Administration within one organization.', 'organization'),
  ('00000000-0000-0000-0000-000000001003', 'Community Administrator', 'community_admin', 'Administration within an assigned community.', 'community'),
  ('00000000-0000-0000-0000-000000001004', 'Committee Administrator', 'committee_admin', 'Governance administration for assigned committees.', 'community'),
  ('00000000-0000-0000-0000-000000001005', 'Moderator', 'moderator', 'Community moderation and member support.', 'community'),
  ('00000000-0000-0000-0000-000000001006', 'Reviewer', 'reviewer', 'Application and verification review.', 'organization'),
  ('00000000-0000-0000-0000-000000001007', 'Member', 'member', 'Standard community participation.', 'community')
on conflict (id) do update set name = excluded.name;

insert into public.permissions (id, key, name, description)
values
  ('00000000-0000-0000-0000-000000002001', 'view', 'View', 'Read permitted records.'),
  ('00000000-0000-0000-0000-000000002002', 'create', 'Create', 'Create permitted records.'),
  ('00000000-0000-0000-0000-000000002003', 'edit', 'Edit', 'Edit permitted records.'),
  ('00000000-0000-0000-0000-000000002004', 'delete', 'Delete', 'Delete permitted records.'),
  ('00000000-0000-0000-0000-000000002005', 'approve', 'Approve', 'Approve applications or workflow items.'),
  ('00000000-0000-0000-0000-000000002006', 'manage_members', 'Manage members', 'Manage membership records.'),
  ('00000000-0000-0000-0000-000000002007', 'manage_applications', 'Manage applications', 'Review and manage applications.'),
  ('00000000-0000-0000-0000-000000002008', 'manage_content', 'Manage content', 'Manage content and publications.'),
  ('00000000-0000-0000-0000-000000002009', 'manage_settings', 'Manage settings', 'Manage organization or community settings.')
on conflict (id) do update set name = excluded.name;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000001001', id from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000001002', id from public.permissions where key in ('view','create','edit','approve','manage_members','manage_applications','manage_content','manage_settings')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000001003', id from public.permissions where key in ('view','create','edit','manage_members','manage_content')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000001006', id from public.permissions where key in ('view','approve','manage_applications')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000001007', id from public.permissions where key = 'view'
on conflict do nothing;

insert into public.content_categories (organization_id, name, slug)
values
  ('00000000-0000-0000-0000-000000000001', 'Pages', 'pages'),
  ('00000000-0000-0000-0000-000000000001', 'Articles', 'articles'),
  ('00000000-0000-0000-0000-000000000001', 'Reports', 'reports'),
  ('00000000-0000-0000-0000-000000000001', 'Guidelines', 'guidelines')
on conflict (organization_id, slug) do nothing;

insert into public.resource_categories (organization_id, name, slug)
values
  ('00000000-0000-0000-0000-000000000001', 'Governance', 'governance'),
  ('00000000-0000-0000-0000-000000000001', 'Reports', 'reports'),
  ('00000000-0000-0000-0000-000000000001', 'Education', 'education'),
  ('00000000-0000-0000-0000-000000000001', 'Operations', 'operations')
on conflict (organization_id, slug) do nothing;
