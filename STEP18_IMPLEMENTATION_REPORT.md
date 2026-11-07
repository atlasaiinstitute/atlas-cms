# Step 18 — White-label & Custom Domains

## 1. Features implemented

- Organization branding workspace at `/settings/branding` with structured display identity, public information, logos/favicon state, supported color tokens, typography tokens, and instant live preview.
- Custom domain workspace at `/settings/domains` with normalized hostname registration, duplicate prevention in the UI, DNS TXT verification instructions, lifecycle status presentation, primary-domain context, and removal behavior.
- White-label controls at `/settings/white-label` for structured welcome-page content, cover image validation affordance, public CTA, contact information, and configuration-ready email identity.
- Organization-scoped route aliases at `/organizations/[organizationId]/settings/branding` and `/organizations/[organizationId]/settings/domains`.
- Server-reusable typed contracts and safe helpers in `src/services/white-label.ts` for branding validation, hostname normalization, reserved subdomains, and trusted-host handling.

## 2. Database changes

Added `supabase/migrations/20261107000000_white_label_custom_domains.sql` with `organization_branding`, `organization_domains`, `organization_email_settings`, and `reserved_subdomains`. Domains use a unique normalized hostname constraint, explicit lifecycle states, verification timestamps, provider state, and organization foreign keys. Step 17 audit trigger coverage is attached to sensitive white-label tables; verification hashes and provider credentials are not exposed in metadata.

## 3. Branding resolution architecture

The intended production flow is `trusted request hostname -> normalized hostname -> active verified organization_domains mapping -> organization-scoped branding -> CSS design tokens`. The app preserves platform defaults when no tenant mapping or branding row exists. The UI only exposes supported design tokens and does not accept arbitrary CSS or JavaScript.

## 4. Domain verification and hosting status

The preview demonstrates the registration and verification-required states. DNS checks, provider provisioning, SSL confirmation, and live custom-host routing remain deployment configuration work because no hosting-provider credentials or DNS resolver are configured in this fixture-driven project. The UI deliberately does not claim a domain is live until provider confirmation exists.

## 5. Security and tenant isolation

The server helper rejects malformed, localhost, private/internal, and scheme-bearing hostnames; reserved subdomains are centrally defined; domain identity is designed to be derived from the trusted request host rather than a client organization ID. Existing tenant context and RBAC remain the source of authorization. Production integration should add the corresponding RLS policies using the project's existing permission helpers before enabling writes.

## 6. Validation

- TypeScript contracts and UI states were implemented for branding fallback, domain conflict, reserved subdomain, verification pending, and provider-not-configured behavior.
- Automated DNS/provider behavior is intentionally mocked by the preview; no external DNS verification is claimed.
- Existing Step 17 audit and tenant modules were preserved.
- Run `npm run typecheck`, `npm run lint`, `npm run test:tenant`, and `npm run build` in the project environment before applying the migration to a connected Supabase project.

## 7. Known limitations

Authentication, live Supabase writes, actual Supabase Storage uploads, DNS resolver calls, hosting provider API integration, SSL provisioning, and email sender verification are not enabled in this Step 18 preview. Step 19 authentication was not started.
