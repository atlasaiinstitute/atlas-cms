# Step 15 — Messaging System

Messaging is an internal collaboration module, separate from public social feeds and external messaging platforms. Conversations are tenant-scoped and may be direct, group, organization, community, committee, working-group or administrative conversations.

The inbox supports search, active/archive views, unread indicators, pinned labels and organization/community scope routes. Conversation threads show sender identity, timestamps, reply previews, read markers, attachment metadata, copy actions, a plain-text composer and participant information. The UI deliberately labels the development identity and does not expose private records to unauthorized users.

The database reuses the existing `conversations` and `messages` tables. Migration `20261106290000_messaging_system.sql` adds explicit participants, private attachments, read receipts, edit history, moderator assignments, reports and messaging preferences. RLS policies enforce participant access and administrative moderation paths. Deleted messages are represented as tombstones rather than disappearing as if they never existed.

Messaging integrates with Step 14 by generating in-app notification rows for participants other than the sender. Notification upserts use the existing related-entity idempotency key. No email, SMS, WhatsApp or push delivery is claimed.

Supabase Realtime was not enabled because an authenticated, tenant-aware channel could not be safely tested in this environment. Production should add participant-authorized channels with cleanup and reconnection handling, or use refresh/polling fallback. File attachments use private `message-attachments` storage and short-lived signed URLs after participant validation.
