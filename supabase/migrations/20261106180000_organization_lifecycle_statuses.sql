-- ATLAS CMS Step 04: organization lifecycle states.
-- Existing rows remain intact; archiving and suspension preserve associated records.
alter table public.organizations drop constraint if exists organizations_status_check;
alter table public.organizations add constraint organizations_status_check
  check (status in ('active', 'pending', 'suspended', 'inactive', 'archived'));
