# ATLAS CMS — AI Continuation Handoff

## Project identity

ATLAS CMS is a production-oriented, multi-tenant Community and Network Management System developed by Atlas AI Institute. The project workspace is a Next.js App Router application with TypeScript, Tailwind CSS, Supabase integration placeholders, Zod validation, React Hook Form, TanStack Query, and Lucide icons.

## Current completion status

Step 01 — Project Foundation: COMPLETE.

Step 03 — Core Database Architecture & Data Models: COMPLETE.

The application intentionally does not yet implement the dashboard, business modules, authentication, registration, RLS policies, or real Supabase connectivity. The current root page is a foundation-status page only. The original local prototype is preserved under `legacy-prototype/` and is not part of the current Next.js route tree.

## Important architectural decisions

- App Router code lives under `src/app`.
- Shared UI primitives belong under `src/components/ui`.
- Feature boundaries are prepared under `src/features`: organizations, communities, members, applications, committees, events, content, resources, notifications, analytics and settings.
- Supabase browser/server client placeholders are isolated under `src/lib/supabase`.
- Authentication and authorization are intentionally separate under `src/lib/auth` and `src/lib/authorization`.
- Database/service operations must not be placed inside UI components; use `src/services`.
- Typed database/domain contracts live under `src/types/database.ts`.
- Validation schemas live under `src/lib/validation`.
- Environment access is centralized in `src/config/env.ts`.
- No service-role credential is exposed to browser code.
- Tenant-owned records use `organization_id` and, where relevant, `community_id`.
- `user_profiles.id` is designed to reference `auth.users(id)` in Supabase.

## Database deliverables

- Migration: `supabase/migrations/20261106170000_initial_atlas_schema.sql`
- Development seed: `supabase/seed.sql`
- Database documentation: `docs/database.md`
- Mermaid ER diagram: `docs/er-diagram.mmd`
- TypeScript interfaces and a Supabase-style `Database` map: `src/types/database.ts`

The migration covers organizations, user profiles, communities, organization memberships/settings/domains, community memberships, applications/reviews/documents, committees/members/meetings/minutes/resolutions, appointments, events/registrations/attendance, content/categories/revisions/publications, resources/categories/access rules, announcements, notifications, conversations/members/messages, roles/permissions/role permissions/user role assignments, and audit logs.

The migration uses UUIDs, foreign keys, timestamps, indexes, check constraints, unique constraints, a partial unique index to prevent duplicate active community memberships, committee chair/secretary uniqueness indexes, and an `updated_at` trigger function. RLS policies are not implemented yet and must be added in a later security stage.

Seed data uses deterministic placeholder UUIDs and non-personal development records for Atlas AI Institute and four communities. It does not insert fake real-person profiles or auth users.

## Verification already completed

- `npm install` completed successfully.
- `npm run typecheck` passed.
- `npm run lint` passed with one non-blocking warning from the ESLint config file about an anonymous default export.
- `npm run build` passed. Next.js generated the root route and `/_not-found`.
- Development server smoke test passed with HTTP 200 and the foundation page rendered.
- Structural SQL validation passed locally: 36 public tables, referenced-table checks, Supabase auth profile bridge, membership uniqueness protection, seed coverage, and ER diagram relationship checks.
- No remote Supabase migration was attempted because no credentials were provided.
- `psql` and the Supabase CLI were not installed in the sandbox, so SQL validation was structural rather than a live PostgreSQL parse.

## How to continue

From the project root:

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` only when Supabase integration is explicitly introduced. Never commit `.env.local` or service-role credentials.

## Recommended next stage

Do not jump directly into authentication. The next implementation stage should build the shared application shell and design-system primitives, then add organization/community context switching against typed contracts and local development fixtures. After that, implement Supabase data services and only then add authentication and RLS policies in a dedicated security stage.

## Continuation rules for the next AI

1. Inspect this file, `README.md`, `docs/database.md`, the migration, seed, and existing source before editing.
2. Preserve the multi-tenant relationship model; do not flatten community data into global records.
3. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client components.
4. Keep authentication separate from authorization.
5. Do not replace the current design system or delete `legacy-prototype/` without explicit instruction.
6. Run typecheck and production build after structural changes.
7. If Supabase credentials are unavailable, prepare migrations locally but do not claim they were applied remotely.
8. Do not start a later numbered step automatically when a new step brief is provided; complete only the requested stage.
