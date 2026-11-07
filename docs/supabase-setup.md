# Supabase setup — ATLAS CMS

## Connected project

- Project name: `atlasaiinstitute@gmail.com's Project`
- Project reference: `ghzowcopcditbhipqgax`
- API URL: `https://ghzowcopcditbhipqgax.supabase.co`
- Region: Singapore (`ap-southeast-1`)
- State observed: `ACTIVE_HEALTHY`

Use this project for ATLAS CMS. Do not use the separate `redflagbd` project.

## Local environment

The local `.env.local` file is ignored by Git and contains the URL and a public publishable API key. Never commit `.env.local`, Supabase secret keys, or service-role credentials. The application currently reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the Supabase publishable key is compatible with the existing Supabase client setup when supplied under that variable name. No service-role key is currently needed by the client wrappers.

For a fresh checkout, copy `.env.example` to `.env.local` and fill in the project URL and public publishable key from Supabase Project Settings → API Keys.

## Database status at connection check

The project was healthy, but its `public` schema had no tables and its migration history was empty. The `supabase/migrations/` directory contains the ATLAS schema migrations. They have **not** been applied to the project yet. Review and apply those migrations in filename order before using database-backed CMS modules. Do not run `supabase/seed.sql` against production without a separate explicit review; it contains demo records.

## API probe results

- Supabase Auth health endpoint: HTTP 200.
- A direct organizations-table read returned `PGRST205` because the table does not exist yet.
- The REST root endpoint requires a secret API key; that root-only result is not a valid test of anonymous table access. Use specific table endpoints after migrations and verify the corresponding RLS policies.

## Deployment

Configure these values separately in Vercel Preview and Production environment settings. Use only the public publishable key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add server-only credentials only if a reviewed server-side feature actually requires them; never expose a secret or service-role key to browser code. The Vercel project has not yet been connected or deployed.
