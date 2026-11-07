/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in test runner loads the temporary CommonJS compilation. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { countDistinct, calculateRate, calculateChange, averageElapsedHours, createDateBuckets, csvCell } = require("../.analytics-test/analytics-calculations.js");

const root = path.resolve(__dirname, "..");

test("unique profile fixtures count people once, separately from membership rows", () => {
  assert.equal(countDistinct(["person-a", "person-a", "person-b", null, undefined, ""]), 2);
});

test("rates use an explicit denominator and are null when no denominator exists", () => {
  assert.equal(calculateRate(7, 10), 70);
  assert.equal(calculateRate(0, 0), null);
  assert.equal(calculateRate(2, Number.NaN), null);
});

test("application processing time excludes missing, invalid, and negative intervals", () => {
  const rows = [
    { submitted_at: "2026-01-01T00:00:00Z", reviewed_at: "2026-01-03T00:00:00Z" },
    { submitted_at: "2026-01-01T00:00:00Z", reviewed_at: "2026-01-02T00:00:00Z" },
    { submitted_at: "2026-01-01T00:00:00Z", reviewed_at: null },
    { submitted_at: "2026-01-03T00:00:00Z", reviewed_at: "2026-01-02T00:00:00Z" },
    { submitted_at: "invalid", reviewed_at: "2026-01-02T00:00:00Z" },
  ];
  assert.equal(averageElapsedHours(rows), 36);
  assert.equal(averageElapsedHours([{ submitted_at: null, reviewed_at: null }]), null);
});

test("previous-period percent change handles zero denominators without fabricating a rate", () => {
  assert.equal(calculateChange(15, 10), 50);
  assert.equal(calculateChange(0, 0), 0);
  assert.equal(calculateChange(1, 0), null);
});

test("date buckets are inclusive, contiguous, and non-overlapping", () => {
  assert.deepEqual(createDateBuckets("2026-03-09", "2026-03-14", 3), [
    { from: "2026-03-09", to: "2026-03-11" },
    { from: "2026-03-12", to: "2026-03-14" },
  ]);
  assert.deepEqual(createDateBuckets("2026-02-28", "2026-03-01", 1), [
    { from: "2026-02-28", to: "2026-02-28" },
    { from: "2026-03-01", to: "2026-03-01" },
  ]);
});

test("CSV cells neutralize formula prefixes and escape quotes", () => {
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell("  @SUM(A1:A2)"), `"'  @SUM(A1:A2)"`);
  assert.equal(csvCell('A "quoted" value'), `"A ""quoted"" value"`);
  assert.equal(csvCell(42), `"42"`);
  assert.equal(csvCell(null), `""`);
});

test("analytics authorization uses server-side scope checks and owner-scoped saved-report policies", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261106300000_analytics_reporting.sql"), "utf8");
  const service = fs.readFileSync(path.join(root, "src/services/analytics.ts"), "utf8");
  for (const expected of ["security definer", "public.is_platform_admin()", "public.is_active_org_member(target_org)", "public.community_belongs_to_org(target_community, target_org)", "r.key = 'community_admin'", "created_by = auth.uid()", "alter table public.saved_reports enable row level security"]) {
    assert.ok(migration.includes(expected), `analytics migration must include ${expected}`);
  }
  assert.ok(service.includes("client.rpc(\"can_view_analytics\""), "analytics service must check access server-side");
  assert.ok(service.includes('query.eq("organization_id", scope.organizationId)'), "tenant-bound aggregate queries must filter organization ID");
  assert.ok(service.includes('query.eq("community_id", scope.communityId)'), "community aggregates must filter community ID");
  assert.ok(!service.includes('from("messages").select("body"'), "message analytics must not read message bodies");
});

test("scope discovery uses a single server-authorized RPC instead of per-tenant query loops", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261106300000_analytics_reporting.sql"), "utf8");
  const route = fs.readFileSync(path.join(root, "src/app/api/analytics/scopes/route.ts"), "utf8");
  assert.ok(migration.includes("create or replace function public.get_analytics_scopes()"));
  assert.ok(migration.includes("public.can_view_analytics(o.id, c.id, 'overview')"));
  assert.ok(route.includes('client.rpc("get_analytics_scopes")'));
  assert.ok(!route.includes('client.from("organizations")'));
});

test("community overview omits organization-only governance metrics and scopes view events through related content", () => {
  const service = fs.readFileSync(path.join(root, "src/services/analytics.ts"), "utf8");
  assert.ok(service.includes('if (!communityMode) await addCount("committees_active"'));
  assert.ok(service.includes("async function contentViewCount"));
  assert.ok(service.includes('.in("content_item_id", contentIds)'));
  assert.ok(service.includes('const completedApprovedRegs = await countChildRows'));
  assert.ok(service.includes("calculateRate(attendance, completedApprovedRegs)"));
});
