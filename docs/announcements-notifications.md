# Step 14 — Announcements & Notifications

Step 14 adds announcements and in-app notifications without rebuilding CMS, Resources, Events or Messaging. Announcements have tenant ownership, optional community scope, configurable type, priority, visibility, target audience, publication/expiry dates, attachments and review workflow.

## Routes

`/announcements`, `/announcements/new`, `/announcements/[id]`, `/announcements/[id]/edit`, `/announcements/scheduled`, `/announcements/archived`, `/announcements/review`, `/notifications`, `/notifications/preferences`, `/notifications/[id]`, `/organizations/[organizationId]/announcements`, and `/communities/[communityId]/announcements` are implemented. The existing header bell links to the full notification inbox and preference page.

## Workflow and targeting

The workflow supports draft, submitted for review, under review, changes requested, approved, scheduled, published, expired, archived, rejected and cancelled states. Server-side service methods validate community ownership, restrict platform-wide audiences to platform administrators, require existing organization access, and create notification events only after publication. Future publication is stored as timezone-aware data; no browser timer is used.

Audience records support organization, community, organization roles, community roles, selected members and platform audiences. Recipient records remain tenant-scoped and individual notification access is restricted to the recipient or authorized administrators. Recipient counts are shown only when reliably available.

## Notification architecture

The initial operational channel is in-app notifications. Notification records support category, related entity, deep link, priority, read/unread state, dismissal and delivered-at tracking. Notification preferences support in-app categories, future email preference and digest frequency. `notification_events` provides event-driven idempotency, while `notification_delivery_logs` separates creation, delivery attempts, failures and read state.

Reusable service functions are provided in `src/services/announcements.ts` for announcement creation, workflow transitions, audience-aware publication notification generation and idempotent event recording. External email, SMS, WhatsApp and push delivery are not claimed as active without a provider.

## Storage and environment

Private announcement attachments use the `announcement-attachments` Supabase Storage bucket and signed-access architecture. Supported attachments are PDF, DOC/DOCX, JPG and PNG up to 20 MB. No new environment variables are needed. Existing Supabase variables remain sufficient; future provider credentials must be server-only.

Authentication remains deferred to Step 19, so the browser UI uses clearly labeled development fixtures while the service, RLS policies and migrations are ready for authenticated Supabase operation. A real scheduler is not connected; scheduled publication therefore requires a future reliable backend scheduler or safe manual publishing.
