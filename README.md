

## Vercel deployment

The repository includes `vercel.json` for the current Next.js deployment flow. Import `atlasaiinstitute/atlas-cms` into Vercel, keep the detected Next.js framework, and use the `main` branch. Vercel will run `npm ci` followed by `npm run build`.

Add these Production environment variables in Vercel Project Settings; do not commit their values:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://ghzowcopcditbhipqgax.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the active Supabase publishable/anonymous key from the connected project

After deployment, configure the Supabase Auth URL Configuration with the Vercel production URL and add the Vercel preview URL pattern if preview logins are needed. The application never stores raw passwords; first-login password changes use Supabase Auth and the `mark_my_password_changed` RPC.
