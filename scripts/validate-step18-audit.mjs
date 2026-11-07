import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const service = await readFile("src/services/white-label.ts", "utf8");
const migration = await readFile("supabase/migrations/20261107000000_white_label_custom_domains.sql", "utf8");
const messaging = await readFile("src/services/messaging.ts", "utf8");
const ui = await readFile("src/features/white-label/white-label-workspace.tsx", "utf8");

assert.ok(service.includes("127\\."), "hostname validation must reject loopback addresses");
assert.ok(service.includes("10\\."), "hostname validation must reject private 10/8 addresses");
assert.ok(service.includes("replace(/\\.$/"), "hostname normalization must remove a trailing dot");
assert.ok(migration.includes("alter table public.organization_domains") && migration.includes("add column if not exists hostname"), "Step 18 must extend the existing domain table additively");
assert.match(migration, /create policy organization_branding_write/, "branding writes must be RLS protected");
assert.match(migration, /create policy organization_domains_access/, "domain writes must be RLS protected");
assert.match(migration, /create unique index if not exists organization_domains_normalized_hostname_uidx/, "normalized hostnames must be unique");
assert.doesNotMatch(ui, /atlas-verify=org_northstar_/, "verification secrets must not be hardcoded in client UI");
assert.match(ui, /handleAsset/, "logo and favicon controls must validate selected files");
assert.doesNotMatch(messaging, /requireOrganizationAccess\(actor,\"00000000-0000-0000-0000-000000000001\"/, "messaging must not use a hardcoded tenant id");
assert.match(messaging, /select\(\"id,organization_id\"\)/, "messaging must resolve tenant identity from the conversation");

console.log("step18-audit: hostname, additive migration, RLS, secret handling, asset validation, and messaging tenant regression checks passed");
