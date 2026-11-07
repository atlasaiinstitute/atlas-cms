# Step 11 — Events Management

ATLAS reuses `events`, `event_registrations`, and `event_attendance`, extending them with event slugs, lifecycle states, registration windows, visibility, capacity controls, guest registration fields, references, attendance/check-in metadata, and reporting fields. Supporting tables cover sessions, speakers, private resources, reports, feedback, and configurable registration forms.

Server-side event services validate the tenant organization, parent community, lifecycle transitions, event dates, registration deadlines, and resource file types. Guest registration remains separate from authenticated member registration, validates email shape through the submission contract, and does not claim email verification. Participant exports and administrative registration/attendance actions must use the Step 09 permission engine in authenticated server actions.

The `event-resources` bucket is private by default. QR check-in is prepared with token-hash fields rather than embedding participant identity. Calendar views are represented by the event list/calendar routes without external Google Calendar integration. Notification events should remain behind the Step 08/14 notification abstraction.
