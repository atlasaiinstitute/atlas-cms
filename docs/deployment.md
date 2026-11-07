# ATLAS CMS deployment guide

## Current deployment state

The source is in the private GitHub repository `rafiatlasaiinstitute/atlas-cms`, on branch `main`. The Vercel project has **not** been imported or deployed; deploy manually from the Vercel dashboard when ready.

The connected Supabase project is `ghzowcopcditbhipqgax` (Singapore, `ap-southeast-1`), API URL `https://ghzowcopcditbhipqgax.supabase.co`. Do not use the separate `redflagbd` project.

## Before deploying database-backed features

At the latest check the Supabase project was `ACTIVE_HEALTHY`, its `public` schema had no tables, and its migration history was empty. The ATLAS SQL files in `supabase/migrations/` have not been applied. The read-only database connection test succeeded, but feature routes that require ATLAS tables are not ready to work against this project until migrations have been reviewed and applied in filename order.

A Supabase security advisory also reported `public.rls_auto_enable()` as a `SECURITY DEFINER` function executable by `anon` and `authenticated`. It was not invoked or changed; review and resolve this warning before treating the database as production-ready. No production data was seeded. `supabase/seed.sql` contains development/demo rows and should not be applied to production without a separate review.

## Import from GitHub into Vercel

1. In Vercel, choose **Add New → Project** and authorize GitHub access to the private `rafiatlasaiinstitute/atlas-cms` repository if prompted.
2. Import `rafiatlasaiinstitute/atlas-cms`, with the project root set to `/` and production branch set to `main`.
3. Use the detected Next.js framework. Build command: `npm run build`; install command: `npm ci`; output directory: leave the Next.js default.
4. Add the two required public environment variables below for **Production**, **Preview**, and **Development**. Obtain the public publishable key from Supabase Project Settings → API Keys. Never paste a Supabase secret/service-role key into a `NEXT_PUBLIC_` variable.
5. Deploy. Verify the resulting deployment URL, build logs, homepage, and relevant routes. Do not treat a successful HTTP response alone as proof that database-backed features work.
6. Once Git is connected, pushes to `main` should trigger production deployment, with previews for branches/pull requests. Confirm these settings in Vercel after import.

## Environment variables

| Variable | Classification | Required | Value source |
|---|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes for Supabase use | `https://ghzowcopcditbhipqgax.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes for Supabase use | Supabase **publishable** key (`sb_publishable_…`); current SDK wrapper reads this existing variable name |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, privileged | No, not currently read by the app | Do not add unless a reviewed server-only feature specifically needs it; never expose it to browser code |

No real key is stored in Git. `.env.local` is ignored and is configured only in the working copy. `.env.example` contains placeholders; use Vercel's encrypted environment-variable form for any future privileged secret.

## Database migration checklist

Before applying the migration set to the connected Supabase project:

1. Review the ordered SQL files under `supabase/migrations/`, including RLS policies and changes to constraints/triggers.
2. Confirm project reference `ghzowcopcditbhipqgax` in the Supabase dashboard. Never run a reset against a production database.
3. Use the Supabase CLI linked to this exact project and review its proposed pending migration list/dry-run output.
4. Apply only the reviewed migrations in order, then verify migration history, tables, RLS, and storage policies. Do not run `supabase/seed.sql` in production.
5. Re-run Supabase security and performance advisors and resolve warnings before enabling database-backed production workflows.

## Local verification

The project has passed `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build` in the current workspace. Dependency installation reported 9 audit findings (7 moderate, 2 high); no automatic dependency upgrades were made. Re-run those commands from the repository root before release.
