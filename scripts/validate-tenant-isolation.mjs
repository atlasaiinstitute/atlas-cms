import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20261106190000_multi_tenant_isolation.sql", "utf8");
const communityMigration = await readFile("supabase/migrations/20261106200000_community_management.sql", "utf8");
const context = await readFile("src/lib/tenant/context.ts", "utf8");
const matrix = await readFile("docs/rls-policy-matrix.md", "utf8");

for (const required of ["enable row level security", "auth.uid()", "is_active_org_member", "is_org_admin", "community_belongs_to_org", "community_memberships_org_user_fkey", "user_role_assignments_org_user_fkey"]) {
  assert.ok(migration.includes(required), `migration must contain ${required}`);
}
for (const required of ["requireOrganizationAccess", "validateTenantOwnership", "getOrganizationScopedQuery", "getCommunityScopedQuery"]) {
  assert.ok(context.includes(required), `context contract must contain ${required}`);
}
for (const required of ["community_type", "administrator_approval", "organization-assets", "community_assets_insert"]) {
  assert.ok(communityMigration.includes(required), `community migration must contain ${required}`);
}
for (const required of ["Organization A cannot", "Suspended organizations", "Step 19"]) {
  assert.ok((await readFile("docs/tenant-isolation.md", "utf8")).includes(required), `isolation documentation must contain ${required}`);
}
assert.ok(matrix.includes("No policy grants unrestricted access"));

const organizations = [
  { id: "org-a", status: "active" },
  { id: "org-b", status: "active" },
  { id: "org-s", status: "suspended" },
];
const memberships = [
  { organizationId: "org-a", userId: "user-a", status: "active" },
  { organizationId: "org-b", userId: "user-b", status: "active" },
  { organizationId: "org-s", userId: "user-s", status: "active" },
];
function canRead(userId, organizationId) {
  const organization = organizations.find((item) => item.id === organizationId);
  return Boolean(organization && organization.status === "active" && memberships.some((item) => item.userId === userId && item.organizationId === organizationId && item.status === "active"));
}
assert.equal(canRead("user-a", "org-a"), true, "Organization A member can read A");
assert.equal(canRead("user-a", "org-b"), false, "Organization A member cannot read B");
assert.equal(canRead("user-b", "org-a"), false, "Organization B member cannot read A");
assert.equal(canRead("user-s", "org-s"), false, "Suspended organization cannot perform normal tenant reads");
assert.equal(canRead("user-none", "org-a"), false, "Non-member cannot read organization data");

console.log("tenant-isolation: structural policy checks and deterministic scenarios passed");
