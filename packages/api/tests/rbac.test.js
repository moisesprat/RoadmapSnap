/**
 * requireRole unit tests (SEC-03, WR-06). No database: a bare Fastify instance carries only the
 * rbac plugin, and each case calls the returned preHandler with stub request and reply objects.
 * Any role value that is not exactly viewer, editor or admin must be denied (fail closed).
 */

import Fastify from 'fastify';
import rbacPlugin from '../src/plugins/rbac.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

let app;

before(async () => {
  app = Fastify();
  await app.register(rbacPlugin);
  await app.ready();
});

after(async () => {
  await app.close();
});

function replyStub() {
  return {
    statusCode: 200,
    body: undefined,
    status(n) {
      this.statusCode = n;
      return this;
    },
    send(b) {
      this.body = b;
      return this;
    },
  };
}

/** Run requireRole(minRole) for a caller with `role`; returns the reply stub. */
async function decide(minRole, role, overrides = {}) {
  const request = { orgId: 'org-1', dbUser: { role }, ...overrides };
  const reply = replyStub();
  await app.requireRole(minRole)(request, reply);
  return reply;
}

function assertDenied(reply, label) {
  assert.equal(reply.statusCode, 403, `${label}: status`);
  assert.deepEqual(reply.body, { error: 'Forbidden', message: 'Insufficient permissions' }, `${label}: body`);
}

function assertAllowed(reply, label) {
  assert.equal(reply.statusCode, 200, `${label}: status`);
  assert.equal(reply.body, undefined, `${label}: reply.send was not called`);
}

const UNKNOWN_ROLES = [
  'owner',
  'superadmin',
  'VIEWER',
  '',
  null,
  undefined,
  'toString',
  '__proto__',
  'constructor',
  'hasOwnProperty',
  'valueOf',
];

for (const role of UNKNOWN_ROLES) {
  test(`requireRole('viewer') denies the unknown role ${JSON.stringify(role) ?? String(role)}`, async () => {
    assertDenied(await decide('viewer', role), String(role));
  });
}

test('requireRole denies non-string role values', async () => {
  for (const role of [1, 2, 3, true, {}, ['admin'], () => 'admin']) {
    assertDenied(await decide('viewer', role), typeof role);
  }
});

test('requireRole keeps the viewer < editor < admin hierarchy', async () => {
  assertAllowed(await decide('viewer', 'viewer'), 'viewer passes viewer');
  assertDenied(await decide('editor', 'viewer'), 'viewer fails editor');
  assertDenied(await decide('admin', 'viewer'), 'viewer fails admin');

  assertAllowed(await decide('viewer', 'editor'), 'editor passes viewer');
  assertAllowed(await decide('editor', 'editor'), 'editor passes editor');
  assertDenied(await decide('admin', 'editor'), 'editor fails admin');

  assertAllowed(await decide('viewer', 'admin'), 'admin passes viewer');
  assertAllowed(await decide('editor', 'admin'), 'admin passes editor');
  assertAllowed(await decide('admin', 'admin'), 'admin passes admin');
});

test('requireRole throws at registration for an invalid minimum role', () => {
  for (const bad of ['toString', '__proto__', 'owner', 'constructor', 'hasOwnProperty', '', undefined, null]) {
    assert.throws(() => app.requireRole(bad), /requireRole: invalid role/, String(bad));
  }
});

test('requireRole replies 403 NO_ORG with the D-12 body when orgId is null', async () => {
  const reply = await decide('viewer', 'admin', { orgId: null });
  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { error: 'Forbidden', message: 'No organization', code: 'NO_ORG' });
});

test('requireRole replies 403 User not found when dbUser is null', async () => {
  const reply = await decide('viewer', 'admin', { dbUser: null });
  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.body, { error: 'Forbidden', message: 'User not found' });
});

test('interleaved parallel requireRole decisions are independent per role', async () => {
  const roles = ['viewer', 'admin', 'owner', 'toString'];
  const calls = Array.from({ length: 32 }, (_, i) => {
    const role = roles[i % roles.length];
    return new Promise((resolve) => setImmediate(resolve)).then(async () => ({
      role,
      reply: await decide('editor', role),
    }));
  });
  const results = await Promise.all(calls);
  assert.equal(results.length, 32);
  for (const { role, reply } of results) {
    if (role === 'admin') assertAllowed(reply, `parallel ${role}`);
    else assertDenied(reply, `parallel ${role}`);
  }
});
