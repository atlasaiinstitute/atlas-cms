# Step 10 — Committees & Governance

ATLAS reuses the existing `committees`, `appointments`, `committee_meetings`, `committee_minutes`, and `committee_resolutions` structures. The governance migration extends committee scope/configuration and appointment metadata, then adds configurable positions, appointment history-safe records, meeting participants, action items, private governance documents, committee history, and organization governance rules.

Committee creation and appointment services validate the organization context and parent community relationship server-side. Appointments require existing active organization membership and, for community-scoped structures, active parent community membership. Position capacity, duplicate active appointment protection, and term dates are database-backed. No committee member automatically receives administrative permissions; governance actions should call the Step 09 permission engine at authenticated server-action boundaries.

Governance records and documents are private by default. The `governance-documents` bucket is private and document validation is limited to common office/image formats up to 15 MB. Governance rules are recordkeeping configuration, not legal certification or a parliamentary voting engine. Calendar integration, automated term renewal, and authentication remain deferred.
