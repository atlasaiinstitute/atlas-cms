# Step 12 — Content Management System

ATLAS reuses `content_items`, `content_categories`, and `content_revisions`, extending content records with editorial metadata, visibility, featured/scheduled fields, SEO fields, language, and structured body support. Supporting tables provide configurable content types, tenant-aware tags, review history, page hierarchy/sections, private media metadata, view-event preparation, and server-managed discovery indexes.

The editor stores structured JSON blocks rather than arbitrary unsanitized HTML. Content transitions are explicit and validated by the server-side content service. Authors, reviewers, approvers, and publishers should map to Step 09 permissions; a role that can create content does not automatically gain publish authority. Public content requires both explicit `published` status and `public` visibility. Scheduled content stores metadata but does not claim publication without a configured scheduler; the current fallback is manual publishing.

Media uses the private `content-media` bucket and tenant paths. Analytics are intentionally labeled as tracking preparation until reliable view events are captured. Authentication, authenticated author identity, and unattended scheduled execution remain Step 19/automation dependencies.
