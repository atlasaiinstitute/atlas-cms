# Public Website & Private Workspace Architecture

## Implementation approach

- Keep the existing CMS fixtures and module contracts as the source of truth; derive public website sections through explicit published/public filters.
- Make `/` and the public content routes institutional website experiences, while preserving all existing dashboard/module URLs as the authenticated workspace surface.
- Add tenant-aware public site resolution by organization slug and a host-resolution helper for verified custom domains.
- Add a central access policy contract with secure defaults, an admin-facing configuration screen, and server-side policy helpers for protected actions.
- Add Supabase schema/RLS preparation for website settings, public navigation, and explicit public visibility. Authentication remains a later provider integration.

## Project structure

- `src/features/public-site/`: public site data projection, access policy, and public website UI.
- `src/app/(public)/`: public route pages for the default tenant and content sections.
- `src/app/api/public/`: tenant-safe public read endpoint and registration guard endpoint.
- `src/app/settings/public-access/`: administrator configuration surface.
- `supabase/migrations/20261107010000_public_website_access.sql`: policy/settings schema and RLS preparation.
- `tests/public-access.test.cjs`: regression tests for public/private filtering and registration blocking.

## Design

- **Style options:** editorial institutional (0.06); quiet civic archive (0.04); warm research journal (0.08).
- **Chosen movement:** editorial institutional, combining a serious policy-institute masthead with a calm, high-trust reading experience.
- **Core principles:** public-first clarity; generous reading width; visible provenance; protected actions clearly separated from browsing.
- **Color philosophy:** preserve ATLAS navy and gold, using warm paper neutrals so the public site feels like an institutional publication rather than an admin console.
- **Layout paradigm:** asymmetric masthead and editorial rails, with content sections flowing vertically instead of dashboard grids.
- **Signature elements:** gold rule markers, serif display headlines, and compact “public / protected” status labels.
- **Interaction philosophy:** browsing is frictionless; any protected action explains why login or membership is required.
- **Typography:** existing system UI sans for controls, Georgia-style serif for public display headlines.
- **Brand essence:** a trustworthy public front door for organizations doing consequential work; clear, rigorous, welcoming.
- **Brand voice:** precise and human. Example: “Research that travels beyond the room.” / “Read the work. Join the conversation when you’re ready.”
