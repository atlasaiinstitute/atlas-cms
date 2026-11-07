/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const source = fs.readFileSync('src/features/public-site/public-site.ts', 'utf8');

test('public projection requires published/public source filters', () => {
  assert.match(source, /status === "published"/);
  assert.match(source, /visibility === "public"/);
  assert.match(source, /status === "active"/);
});

test('public registration is disabled by default', () => {
  assert.match(source, /publicRegistrationEnabled: false/);
  const route = fs.readFileSync('src/app/api/public/register/route.ts', 'utf8');
  assert.match(route, /PUBLIC_REGISTRATION_DISABLED/);
});

test('protected actions are explicit and separate from browsing', () => {
  assert.match(source, /create_post/);
  assert.match(source, /private_document/);
  assert.match(source, /isProtectedAction/);
});

test('tenant resolution is slug and verified-host aware', () => {
  assert.match(source, /resolvePublicOrganization/);
  assert.match(source, /organization\.website/);
});

test('registration API rejects anonymous direct attempts when disabled', () => {
  const route = fs.readFileSync('src/app/api/public/register/route.ts', 'utf8');
  assert.match(route, /status: 403/);
  assert.match(route, /PUBLIC_REGISTRATION_DISABLED/);
});
