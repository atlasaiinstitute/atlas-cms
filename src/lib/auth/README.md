# Authentication boundary

Authentication remains intentionally unimplemented. Step 05 tenant utilities accept a verified `TenantActor` contract but do not create sessions, trust browser user IDs, or bypass Supabase Auth.

Step 19 must connect Supabase Auth sessions to `TenantActor`, configure verified platform claims where appropriate, and run live RLS integration tests for organization and community isolation.
