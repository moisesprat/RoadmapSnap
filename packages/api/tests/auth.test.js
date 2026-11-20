import { build } from '../src/server.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initTestAuth, signToken, signForeignToken, signHs256Token, bearer } from './helpers/auth.js';
import {
  requireDbEnv,
  uniq,
  createUser,
  createOrg,
  addMember,
  cleanup,
  closePools,
} from './helpers/db.js';

let app;
const fx = {};
const newSub = uniq('auth-new');
const newEmail = `${newSub}@example.com`;
const otherSub = uniq('auth-other');

async function me(claims, headers = {}) {
  const token = await signToken(claims);
  return app.inject({ method: 'GET', url: '/auth/me', headers: { ...bearer(token), ...headers } });
}

before(async () => {
  requireDbEnv();
  await initTestAuth();

  fx.aliceSub = uniq('auth-alice');
  fx.aliceEmail = `${fx.aliceSub}@example.com`;
  fx.alice = await createUser({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  fx.org = await createOrg({ name: 'Auth Test Org', slug: uniq('auth-org') });
  await addMember(fx.org.id, fx.alice.id, 'admin');

  app = await build();
  await app.ready();
});

after(async () => {
  await cleanup({
    orgIds: [fx.org?.id].filter(Boolean),
    userIds: [fx.alice?.id].filter(Boolean),
    subs: [newSub, otherSub],
  });
  if (app) await app.close();
  await closePools();
});

test('GET /auth/me without any Authorization header returns 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/auth/me', headers: {} });
  assert.equal(res.statusCode, 401);
  const body = res.json();
  assert.equal(body.error, 'Unauthorized');
  assert.ok(body.message.includes('Missing'));
});

test('GET /auth/me with malformed Bearer token returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Bearer thisisnotavalidtoken' },
  });
  assert.equal(res.statusCode, 401);
  const body = res.json();
  assert.equal(body.error, 'Unauthorized');
});

test('GET /auth/me with empty Bearer value returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Bearer ' },
  });
  assert.equal(res.statusCode, 401);
});

test('GET /auth/me with wrong auth scheme returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Basic dXNlcjpwYXNz' },
  });
  assert.equal(res.statusCode, 401);
});

test('GET /auth/me with only the x-test-user-sub header returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { 'x-test-user-sub': fx.aliceSub },
  });
  assert.equal(res.statusCode, 401);
});

test('x-test-user-sub next to a valid token is ignored and the token subject wins', async () => {
  const res = await me(
    { sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' },
    { 'x-test-user-sub': otherSub }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sub, fx.aliceSub);
});

test('GET /auth/me with valid test token returns 200', async () => {
  const res = await me({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.sub, fx.aliceSub);
  assert.equal(body.email, fx.aliceEmail);
});

test('GET /auth/me response contains required user fields', async () => {
  const res = await me({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  const body = res.json();
  assert.ok('sub' in body);
  assert.ok('email' in body);
  assert.ok('name' in body);
  assert.equal(typeof body.sub, 'string');
  assert.equal(typeof body.email, 'string');
  assert.equal(typeof body.name, 'string');
  assert.equal(body.name, 'Alice Admin');
});

test('GET /auth/me correctly reflects the sub from the token', async () => {
  const res = await me({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sub, fx.aliceSub);
});

test('GET /auth/me for a member reports orgId, orgs and role', async () => {
  const res = await me({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.orgId, fx.org.id);
  assert.equal(body.role, 'admin');
  assert.deepEqual(body.orgs, [{ id: fx.org.id, name: 'Auth Test Org', role: 'admin' }]);
});

test('GET /auth/me does not echo raw JWT claims', async () => {
  const token = await signToken({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  const res = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  const body = res.json();
  for (const claim of ['iss', 'aud', 'iat', 'exp']) {
    assert.ok(!(claim in body), `${claim} must not appear in /auth/me`);
  }
});

test('GET /auth/me for a brand-new subject returns 200 with orgs [] and role null', async () => {
  const res = await me({ sub: newSub, email: newEmail, name: 'Newcomer' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.sub, newSub);
  assert.deepEqual(body.orgs, []);
  assert.equal(body.role, null);
  assert.equal(body.orgId, null);
});

test('PATCH /auth/me returns only sub, email, name and preferences', async () => {
  const token = await signToken({ sub: fx.aliceSub, email: fx.aliceEmail, name: 'Alice Admin' });
  const res = await app.inject({
    method: 'PATCH',
    url: '/auth/me',
    headers: bearer(token),
    payload: { preferences: { theme: 'dark' } },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.deepEqual(Object.keys(body).sort(), ['email', 'name', 'preferences', 'sub']);
  assert.equal(body.sub, fx.aliceSub);
  assert.equal(body.preferences.theme, 'dark');
});

test('a token signed by a foreign key returns 401', async () => {
  const token = await signForeignToken({ sub: fx.aliceSub, email: fx.aliceEmail });
  const res = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(res.statusCode, 401);
});

test('an HS256 token returns 401', async () => {
  const token = await signHs256Token({ sub: fx.aliceSub, email: fx.aliceEmail });
  const res = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(res.statusCode, 401);
});

test('an expired token returns 401', async () => {
  const token = await signToken({ sub: fx.aliceSub, email: fx.aliceEmail, expiresIn: '-1m' });
  const res = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(res.statusCode, 401);
});

test('a token for the wrong audience returns 401', async () => {
  const token = await signToken({
    sub: fx.aliceSub,
    email: fx.aliceEmail,
    audience: 'https://other.api',
  });
  const res = await app.inject({ method: 'GET', url: '/auth/me', headers: bearer(token) });
  assert.equal(res.statusCode, 401);
});
