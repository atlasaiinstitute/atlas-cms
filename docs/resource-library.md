# Step 13 — Resource Library

The Resource Library is separate from the CMS editorial module. CMS stores articles, pages and publishing content; Resource Library stores reusable files, datasets, templates, toolkits and reference assets.

## Routes

- `/resources` — tenant-scoped discovery dashboard with search, type/status filters and grid/list views.
- `/resources/new` — validated metadata and file/external URL form.
- `/resources/[id]` — details, citation copy, access indicator, related resources, activity and version history.
- `/resources/[id]/edit` — metadata editing entry point.
- `/resources/categories` and `/resources/collections` — category/type/collection management workspace.
- `/resources/my-resources` and `/resources/review` — owner and review queue views.
- `/organizations/[organizationId]/resources` and `/communities/[communityId]/resources` — organization/community scoped views.

## Database

Migration `20261106270000_resource_library.sql` incrementally extends the existing `resources` table and does not replace the earlier resource architecture. It adds validated metadata, lifecycle status, visibility, publication/review dates, external URLs, tags and usage counters. New tenant-aware tables cover resource types, tags, files, versions, collections, contributors, reviews and activity logs.

The status lifecycle is `draft → submitted_for_review → under_review → changes_requested / approved → published → archived`. Version records retain historical metadata and file references. Collection membership is many-to-many, so a resource can appear in several thematic groups without duplicated resource records.

## Storage and security

Files use the private `resource-files` Supabase Storage bucket. Safe paths are generated as `organizationId/resourceId/version/sanitized-file-name`. Private downloads use short-lived signed URLs through `createResourceDownloadUrl`; the UI does not expose predictable public URLs. MIME type, executable extensions and a 100 MB size ceiling are validated before upload. RLS policies require verified organization membership and administrator permissions for writes.

Authentication remains intentionally deferred to Step 19, consistent with the existing project. Development fixtures are clearly labeled in the dashboard until the project's temporary identity mechanism is connected to live writes.

## Configuration

No new environment variables are required. Existing Supabase variables remain the source of truth:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never client-side)

Reliable scheduled review reminders are not claimed because no scheduler is connected in this step. Analytics record activity types in the database, and successful downloads are distinct from download attempts.
