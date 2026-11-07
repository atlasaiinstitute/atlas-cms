/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { csvEscape } = require('../.audit-test/audit-csv.js');
const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261106310000_audit_logs_activity_tracking.sql'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/audit-logs.ts'), 'utf8');

test('CSV cell values are quoted and embedded quotes are escaped', () => {
  assert.equal(csvEscape('hello,"world"'), '"hello,""world"""');
});
test('CSV formula-leading text is neutralized after leading whitespace', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-cmd', '@SUM(1)', '\t=HYPERLINK("x")']) {
    assert.match(csvEscape(value), /^"'/, `expected formula marker to be neutralized for ${JSON.stringify(value)}`);
  }
});
test('CSV values preserve ordinary values and represent structured JSON', () => {
  assert.equal(csvEscape('ordinary'), '"ordinary"');
  assert.equal(csvEscape({ safe: true }), '"{""safe"":true}"');
  assert.equal(csvEscape(null), '""');
});
test('database writes are append-only and client mutation grants are absent', () => {
  assert.match(migration, /create trigger audit_logs_no_update before update or delete on public\.audit_logs/i);
  assert.match(migration, /revoke all on public\.audit_logs from anon,authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all)\s+on\s+public\.audit_logs\s+to\s+authenticated/i);
});
test('business mutations are captured by triggers and only allowlisted change keys are saved', () => {
  assert.match(migration, /create trigger audit_capture_%I after insert or update or delete/i);
  assert.match(migration, /when 'messages' then array\[\]::text\[\].*Never capture message content/s);
  assert.match(migration, /when 'membership_applications' then array\['status','application_category'\]/);
  assert.match(migration, /to_jsonb\(v_changed\),'previous',v_previous,'new',v_current/);
});
test('RBAC scope checks, retention floor, and server-side export limits are present', () => {
  assert.match(migration, /function public\.can_view_audit_logs\(/);
  assert.match(migration, /function public\.record_audit_access_denied\(/);
  assert.match(migration, /interval '1 minute'/);
  assert.match(service, /record_audit_access_denied/);
  assert.match(migration, /retention_days between 365 and 3650/i);
  assert.match(migration, /record_audit_export/);
  assert.match(service, /required_permission: permission/);
  assert.match(service, /5000/);
  assert.match(service, /The export could not be audited, so no file was created/);
});
test('the audit API requires authorization and private non-cacheable responses', () => {
  assert.match(service, /client\.auth\.getUser\(\)/);
  assert.match(service, /can_view_audit_logs/);
  assert.doesNotMatch(service, /Cache-Control/i); // cache policy is set at the API route boundary
  const api = fs.readFileSync(path.join(root, 'src/app/api/audit-logs/route.ts'), 'utf8');
  assert.match(api, /private, no-store/);
});
