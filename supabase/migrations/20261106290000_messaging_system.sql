-- ATLAS CMS Step 15: Internal Messaging System.
-- Extends existing conversations/messages; private attachments use a separate bucket.
alter table public.conversations add column if not exists conversation_type text not null default 'group';
alter table public.conversations add column if not exists title text;
alter table public.conversations add column if not exists description text;
alter table public.conversations add column if not exists committee_id uuid references public.committees(id) on delete set null;
alter table public.conversations add column if not exists created_by uuid references public.user_profiles(id) on delete set null;
alter table public.conversations add column if not exists archived_at timestamptz;
alter table public.conversations add column if not exists deleted_at timestamptz;
alter table public.conversations drop constraint if exists conversations_type_check;
alter table public.conversations add constraint conversations_type_check check(conversation_type in ('direct','group','organization','community','committee','working_group','administrative'));
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
create index if not exists conversations_scope_activity_idx on public.conversations(organization_id,community_id,archived_at,updated_at desc);
create index if not exists messages_conversation_cursor_idx on public.messages(conversation_id,sent_at desc);
create index if not exists messages_search_idx on public.messages using gin(to_tsvector('simple',coalesce(body,'')));

create table if not exists public.conversation_participants(
 conversation_id uuid not null references public.conversations(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references public.user_profiles(id) on delete cascade,
 participant_role text not null default 'participant' check(participant_role in ('participant','moderator','owner')), joined_at timestamptz not null default timezone('utc',now()), left_at timestamptz, muted_until timestamptz, pinned_at timestamptz, last_read_at timestamptz, primary key(conversation_id,user_id)
);
create table if not exists public.message_attachments(
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete cascade, conversation_id uuid not null references public.conversations(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade,
 storage_bucket text not null default 'message-attachments', storage_path text not null, file_name text not null, mime_type text, file_size_bytes bigint check(file_size_bytes is null or file_size_bytes>=0), uploaded_by uuid references public.user_profiles(id) on delete set null, deleted_at timestamptz, created_at timestamptz not null default timezone('utc',now()), unique(storage_bucket,storage_path)
);
create table if not exists public.message_read_receipts(
 message_id uuid not null references public.messages(id) on delete cascade, user_id uuid not null references public.user_profiles(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, read_at timestamptz not null default timezone('utc',now()), primary key(message_id,user_id)
);
create table if not exists public.message_edit_history(
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete cascade, conversation_id uuid not null references public.conversations(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, edited_by uuid references public.user_profiles(id) on delete set null, previous_body text not null, edited_at timestamptz not null default timezone('utc',now())
);
create table if not exists public.conversation_moderators(
 conversation_id uuid not null references public.conversations(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references public.user_profiles(id) on delete cascade, assigned_by uuid references public.user_profiles(id) on delete set null, created_at timestamptz not null default timezone('utc',now()), primary key(conversation_id,user_id)
);
create table if not exists public.message_reports(
 id uuid primary key default gen_random_uuid(), message_id uuid references public.messages(id) on delete set null, conversation_id uuid not null references public.conversations(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, reporter_user_id uuid references public.user_profiles(id) on delete set null, reason text not null, status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')), moderator_notes text, resolved_by uuid references public.user_profiles(id) on delete set null, created_at timestamptz not null default timezone('utc',now()), resolved_at timestamptz
);
create table if not exists public.messaging_preferences(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_profiles(id) on delete cascade, organization_id uuid references public.organizations(id) on delete cascade, allow_direct_messages boolean not null default true, allow_group_invitations boolean not null default true, read_receipts_enabled boolean not null default true, presence_visible boolean not null default false, message_notifications boolean not null default true, created_at timestamptz not null default timezone('utc',now()), updated_at timestamptz not null default timezone('utc',now()), unique(user_id,organization_id)
);

insert into public.permissions(key,name,description) values
('messages.view','View messages','View conversations where the actor is a participant.'),('messages.send','Send messages','Send messages to authorized conversations.'),('messages.create_group','Create group conversations','Create scoped group conversations.'),('messages.manage_participants','Manage participants','Add, remove and moderate conversation participants.'),('messages.edit_own','Edit own messages','Edit own messages within the configured window.'),('messages.delete_own','Delete own messages','Delete own messages with tombstone retention.'),('messages.moderate','Moderate messages','Review reports and moderate authorized conversations.'),('messages.settings.manage','Manage messaging settings','Manage organization messaging policy.') on conflict(key) do update set name=excluded.name,description=excluded.description;

alter table public.conversation_participants enable row level security; alter table public.message_attachments enable row level security; alter table public.message_read_receipts enable row level security; alter table public.message_edit_history enable row level security; alter table public.conversation_moderators enable row level security; alter table public.message_reports enable row level security; alter table public.messaging_preferences enable row level security;
create policy conversation_participants_access on public.conversation_participants for all using(user_id=auth.uid() or exists(select 1 from public.conversation_participants mine where mine.conversation_id=conversation_id and mine.user_id=auth.uid() and mine.left_at is null)) with check(public.is_active_org_member(organization_id));
create policy message_attachments_access on public.message_attachments for all using(exists(select 1 from public.conversation_participants p where p.conversation_id=message_attachments.conversation_id and p.user_id=auth.uid() and p.left_at is null)) with check(public.is_active_org_member(organization_id));
create policy message_read_receipts_access on public.message_read_receipts for all using(user_id=auth.uid() or exists(select 1 from public.conversation_participants p where p.conversation_id=(select conversation_id from public.messages where id=message_id) and p.user_id=auth.uid() and p.left_at is null)) with check(user_id=auth.uid());
create policy message_edit_history_access on public.message_edit_history for select using(exists(select 1 from public.conversation_participants p where p.conversation_id=message_edit_history.conversation_id and p.user_id=auth.uid() and p.left_at is null));
create policy conversation_moderators_access on public.conversation_moderators for all using(exists(select 1 from public.conversation_participants p where p.conversation_id=conversation_id and p.user_id=auth.uid() and p.left_at is null)) with check(public.is_org_admin(organization_id));
create policy message_reports_access on public.message_reports for insert with check(public.is_active_org_member(organization_id));
create policy message_reports_review on public.message_reports for all using(public.is_org_admin(organization_id) or exists(select 1 from public.conversation_moderators m where m.conversation_id=message_reports.conversation_id and m.user_id=auth.uid())) with check(public.is_org_admin(organization_id) or exists(select 1 from public.conversation_moderators m where m.conversation_id=message_reports.conversation_id and m.user_id=auth.uid()));
create policy messaging_preferences_access on public.messaging_preferences for all using(user_id=auth.uid() or (organization_id is not null and public.is_org_admin(organization_id))) with check(user_id=auth.uid() or (organization_id is not null and public.is_org_admin(organization_id)));
insert into storage.buckets(id,name,public) values('message-attachments','message-attachments',false) on conflict(id) do update set public=false;
create policy message_attachments_storage_select on storage.objects for select using(bucket_id='message-attachments' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
create policy message_attachments_storage_insert on storage.objects for insert with check(bucket_id='message-attachments' and public.is_active_org_member(((storage.foldername(name))[1])::uuid));
comment on table public.messages is 'Internal tenant-scoped messages. Access requires conversation participation; deleted messages remain as tombstones.';
