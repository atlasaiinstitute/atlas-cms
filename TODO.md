# Delivery checklist

- [ ] Anonymous visitors can browse the default organization homepage and public routes without a login redirect.
- [ ] Public pages show organization branding, navigation, public content, and a Login button, with Register/Sign Up hidden by default.
- [ ] Public projections include only active organizations, published content, published announcements, public events, public resources, and explicitly public communities.
- [ ] Private, draft, under-review, scheduled, archived, member-only, and internal records are excluded from public projections.
- [ ] Protected actions expose a clear login-required state and do not grant editing or administrative rights.
- [ ] Central access settings expose public website, registration, membership applications, comments, reactions, messaging, posting, event registration, profile visibility, public content types, resource downloads, community pages, and disabled features.
- [ ] Registration remains blocked by default in the UI and public API guard; administrator-issued onboarding remains the supported path.
- [ ] Tenant resolution supports organization slugs and verified custom domains without cross-tenant fallback.
- [ ] Supabase migration adds settings/navigation/domain access fields and RLS policies for explicit public visibility.
- [ ] Existing workspace routes remain available and the audit report documents changed files, schema, routes, tests, and limitations.
