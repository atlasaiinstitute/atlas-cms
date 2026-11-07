# Step 08 — Applications & Verification

ATLAS reuses `membership_applications`, `application_reviews`, and `application_documents`. The migration adds application references and types, structured tenant-scoped forms and versions, status history, reviewer assignments, document verification metadata, duplicate-active-application protection, and a private `application-documents` Storage bucket.

Application transitions are controlled by `canTransition` and rechecked by the server-side `transitionApplication` service. Approvals are intentionally routed through a server action boundary so the future Step 19 implementation can transactionally reuse or create the central member profile, create/activate the organization membership, and then create/activate a community membership only after validating the parent organization membership.

The development submission flow validates applicant fields and creates a submitted application only for an authorized tenant actor. It does not verify an email address, create a password, or provision an Auth account. Authentication-dependent public submissions, applicant self-service access, and identity matching belong to Step 19.

Application documents are private and validated for PDF, DOC/DOCX, JPG/JPEG, and PNG up to 10 MB. No public URLs are generated. Notification events are exposed behind a service abstraction and are explicitly not reported as delivered without a configured provider; broader delivery belongs to Step 14.
