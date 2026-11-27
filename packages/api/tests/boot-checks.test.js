/**
 * Boot refusal (SEC-02, D-10, D-11): the API must not start under an unsafe database role or
 * an unsafe config. Unit cases cover assertSafeConfig and assertSafeDbRole directly; the
 * integration cases drive build() against the local Postgres with real roles.
 */

import { build } from '../src/server.js';
import * as bootChecks from '../src/db/bootChecks.js';
import { assertSafeConfig, assertSafeDbRole } from '../src/db/bootChecks.js';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireDbEnv, adminPool, closePools } from './helpers/db.js';

const BASE_ENV = {
  NODE_ENV: 'test',
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_AUDIENCE: 'https://test.api',
  AUTH_TEST_JWKS: '',
  CORS_ORIGIN: 'http://localhost:3000',
};

const validConfig = {
  NODE_ENV: 'test',
  APP_DATABASE_URL: 'postgresql://roadmapsnap_app:x@localhost:5432/db',
  CORS_ORIGIN: 'http://localhost:3000',
};

/**
 * Set process.env keys for one case and restore the previous values afterwards. An override whose
 * value is `undefined` deletes the key for the case (Object.assign would store the string 'undefined').
 */
async function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Run build() with BASE_ENV plus overrides; closes the app if it started. */
async function tryBuild(overrides) {
  return withEnv({ ...BASE_ENV, ...overrides }, async () => {
    const app = await build();
    await app.close();
  });
}

/** Run build() with BASE_ENV plus overrides, inject one request, close the app, return the response. */
async function injectWithEnv(overrides, requestOpts) {
  return withEnv({ ...BASE_ENV, ...overrides }, async () => {
    const app = await build();
    try {
      return await app.inject(requestOpts);
    } finally {
      await app.close();
    }
  });
}

/** DATABASE_URL with the credentials replaced (WHATWG URL keeps host, port and database). */
function urlFor(role, password) {
  const url = new URL(process.env.DATABASE_URL);
  url.username = role;
  url.password = password;
  return url.toString();
}

const suffix = `${process.pid}${Date.now()}`;
const bypassRole = `rs_boot_bypass_${suffix}`;
const inheritRole = `rs_boot_inherit_${suffix}`;
const rolePassword = `pw${suffix}`;
let ownerRole = null;
let membershipGranted = false;

before(async () => {
  requireDbEnv();
  const client = await adminPool().connect();
  try {
    const owner = await client.query(
      `SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workspaces'`
    );
    ownerRole = owner.rows[0].tableowner;
    const pw = client.escapeLiteral(rolePassword);
    await client.query(
      `CREATE ROLE ${client.escapeIdentifier(bypassRole)} NOSUPERUSER BYPASSRLS LOGIN PASSWORD ${pw}`
    );
    await client.query(
      `CREATE ROLE ${client.escapeIdentifier(inheritRole)} NOSUPERUSER LOGIN PASSWORD ${pw}`
    );
    await client.query(
      `GRANT ${client.escapeIdentifier(ownerRole)} TO ${client.escapeIdentifier(inheritRole)}`
    );
    membershipGranted = true;
  } finally {
    client.release();
  }
});

after(async () => {
  const client = await adminPool().connect();
  try {
    if (membershipGranted) {
      await client.query(
        `REVOKE ${client.escapeIdentifier(ownerRole)} FROM ${client.escapeIdentifier(inheritRole)}`
      );
    }
    await client.query(`DROP ROLE IF EXISTS ${client.escapeIdentifier(bypassRole)}`);
    await client.query(`DROP ROLE IF EXISTS ${client.escapeIdentifier(inheritRole)}`);
  } finally {
    client.release();
  }
  await closePools();
});

// ---- assertSafeConfig (unit) ----

test('assertSafeConfig accepts valid development, test and production configs', () => {
  assert.doesNotThrow(() => assertSafeConfig({ ...validConfig, NODE_ENV: 'development' }));
  assert.doesNotThrow(() => assertSafeConfig({ ...validConfig, NODE_ENV: 'test' }));
  assert.doesNotThrow(() =>
    assertSafeConfig({
      ...validConfig,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.example.com',
    })
  );
});

test('assertSafeConfig refuses a missing or empty NODE_ENV', () => {
  assert.throws(() => assertSafeConfig({ ...validConfig, NODE_ENV: '' }), /Refusing to start:.*NODE_ENV/);
  assert.throws(() => assertSafeConfig({ ...validConfig, NODE_ENV: undefined }), /Refusing to start:.*NODE_ENV/);
});

test('assertSafeConfig refuses a NODE_ENV outside development, test and production', () => {
  assert.throws(() => assertSafeConfig({ ...validConfig, NODE_ENV: 'staging' }), /Refusing to start:.*NODE_ENV/);
  assert.throws(() => assertSafeConfig({ ...validConfig, NODE_ENV: 'prod' }), /Refusing to start:.*NODE_ENV/);
});

test('assertSafeConfig refuses a missing or empty APP_DATABASE_URL', () => {
  assert.throws(
    () => assertSafeConfig({ ...validConfig, APP_DATABASE_URL: '' }),
    /Refusing to start:.*APP_DATABASE_URL/
  );
  assert.throws(
    () => assertSafeConfig({ ...validConfig, APP_DATABASE_URL: undefined }),
    /Refusing to start:.*APP_DATABASE_URL/
  );
});

test('assertSafeConfig refuses AUTH_TEST_JWKS under production', () => {
  assert.throws(
    () =>
      assertSafeConfig({
        ...validConfig,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com',
        AUTH_TEST_JWKS: '{"keys":[]}',
      }),
    /Refusing to start:.*AUTH_TEST_JWKS/
  );
});

test('assertSafeConfig refuses CORS_ORIGIN "*", empty or missing under production, trimmed', () => {
  for (const origin of ['*', '', '  *  ', '   ', undefined]) {
    assert.throws(
      () => assertSafeConfig({ ...validConfig, NODE_ENV: 'production', CORS_ORIGIN: origin }),
      /Refusing to start:.*CORS_ORIGIN/,
      `CORS_ORIGIN ${JSON.stringify(origin)}`
    );
  }
});

test('assertSafeConfig allows the wide CORS default outside production', () => {
  assert.doesNotThrow(() => assertSafeConfig({ ...validConfig, NODE_ENV: 'development', CORS_ORIGIN: '*' }));
});

// ---- resolveCorsOrigin (unit) ----

test('resolveCorsOrigin returns the trimmed explicit origin in every environment', () => {
  for (const NODE_ENV of ['development', 'test', 'production']) {
    assert.equal(
      bootChecks.resolveCorsOrigin({ NODE_ENV, CORS_ORIGIN: '  https://app.example.com  ' }),
      'https://app.example.com',
      NODE_ENV
    );
  }
});

test('resolveCorsOrigin falls back to the localhost origin only in development and test', () => {
  assert.equal(bootChecks.DEV_CORS_ORIGIN, 'http://localhost:3000');
  for (const NODE_ENV of ['development', 'test']) {
    for (const CORS_ORIGIN of [undefined, '', '   ']) {
      assert.equal(
        bootChecks.resolveCorsOrigin({ NODE_ENV, CORS_ORIGIN }),
        bootChecks.DEV_CORS_ORIGIN,
        `${NODE_ENV} ${JSON.stringify(CORS_ORIGIN)}`
      );
    }
  }
});

test('resolveCorsOrigin refuses a missing, empty or wildcard origin under production', () => {
  for (const CORS_ORIGIN of [undefined, '', '   ', '*']) {
    assert.throws(
      () => bootChecks.resolveCorsOrigin({ NODE_ENV: 'production', CORS_ORIGIN }),
      /Refusing to start:.*CORS_ORIGIN/,
      JSON.stringify(CORS_ORIGIN)
    );
  }
});

// ---- assertSafeDbRole (unit, stubbed pool) ----

function stubPool(row) {
  return { query: async () => ({ rows: [row] }) };
}

const safeRow = {
  role: 'roadmapsnap_app',
  rolsuper: false,
  rolbypassrls: false,
  is_superuser_guc: 'off',
  owns_or_inherits_owner: false,
};

test('assertSafeDbRole returns the role name for a safe role', async () => {
  assert.deepEqual(await assertSafeDbRole(stubPool(safeRow)), { role: 'roadmapsnap_app' });
});

test('assertSafeDbRole refuses each unsafe attribute with its own message', async () => {
  await assert.rejects(assertSafeDbRole(stubPool({ ...safeRow, rolsuper: true })), /Refusing to start:.*superuser/);
  await assert.rejects(
    assertSafeDbRole(stubPool({ ...safeRow, is_superuser_guc: 'on' })),
    /Refusing to start:.*superuser/
  );
  await assert.rejects(assertSafeDbRole(stubPool({ ...safeRow, rolbypassrls: true })), /Refusing to start:.*BYPASSRLS/);
  await assert.rejects(
    assertSafeDbRole(stubPool({ ...safeRow, owns_or_inherits_owner: true })),
    /Refusing to start:.*owns or inherits/
  );
});

// ---- build() integration ----

test('build() rejects for the superuser role', async () => {
  await assert.rejects(tryBuild({ APP_DATABASE_URL: process.env.DATABASE_URL }), /superuser/);
});

test('build() rejects for a NOSUPERUSER BYPASSRLS role', async () => {
  await assert.rejects(
    tryBuild({ APP_DATABASE_URL: urlFor(bypassRole, rolePassword) }),
    /BYPASSRLS/
  );
});

test('build() rejects for a role that inherits the table owner', async () => {
  await assert.rejects(
    tryBuild({ APP_DATABASE_URL: urlFor(inheritRole, rolePassword) }),
    /owns or inherits/
  );
});

test('build() rejects when the database is unreachable instead of starting unchecked', async () => {
  await assert.rejects(
    tryBuild({ APP_DATABASE_URL: 'postgresql://roadmapsnap_app:x@127.0.0.1:1/none' })
  );
});

test('build() rejects when NODE_ENV is the empty string', async () => {
  await assert.rejects(tryBuild({ NODE_ENV: '' }), /NODE_ENV/);
});

test('build() rejects when APP_DATABASE_URL is empty', async () => {
  await assert.rejects(tryBuild({ APP_DATABASE_URL: '' }), /APP_DATABASE_URL/);
});

test('build() refuses AUTH_TEST_JWKS under production before touching the database', async () => {
  await assert.rejects(
    tryBuild({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.example.com',
      AUTH_TEST_JWKS: '{"keys":[]}',
      APP_DATABASE_URL: 'postgresql://roadmapsnap_app:x@127.0.0.1:1/none',
    }),
    /AUTH_TEST_JWKS/
  );
});

test('build() refuses an open CORS policy under production', async () => {
  await assert.rejects(tryBuild({ NODE_ENV: 'production', CORS_ORIGIN: '*' }), /CORS_ORIGIN/);
});

test('build() refuses a missing CORS_ORIGIN under production before touching the database', async () => {
  // The unreachable URL proves the refusal comes first: reaching the pool would give a connection error.
  await assert.rejects(
    tryBuild({
      NODE_ENV: 'production',
      CORS_ORIGIN: undefined,
      APP_DATABASE_URL: 'postgresql://roadmapsnap_app:x@127.0.0.1:1/none',
    }),
    /Refusing to start:.*CORS_ORIGIN/
  );
});

test('build() under development with CORS_ORIGIN unset allows http://localhost:3000', async () => {
  const res = await injectWithEnv(
    { NODE_ENV: 'development', CORS_ORIGIN: undefined },
    { method: 'GET', url: '/health', headers: { origin: 'http://localhost:3000' } }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
});

test('build() under test with an empty CORS_ORIGIN allows http://localhost:3000', async () => {
  const res = await injectWithEnv(
    { NODE_ENV: 'test', CORS_ORIGIN: '' },
    { method: 'GET', url: '/health', headers: { origin: 'http://localhost:3000' } }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
});

test('build() uses an explicit CORS_ORIGIN trimmed, ahead of the development default', async () => {
  const res = await injectWithEnv(
    { NODE_ENV: 'development', CORS_ORIGIN: '  https://dev.example.com  ' },
    { method: 'GET', url: '/health', headers: { origin: 'https://dev.example.com' } }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'https://dev.example.com');
});

test('build() resolves for roadmapsnap_app and app.close() ends the pool', async () => {
  await assert.doesNotReject(tryBuild({}));
});

test('build() resolves under production with a pinned CORS origin and no test JWKS', async () => {
  await assert.doesNotReject(
    tryBuild({ NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com' })
  );
});
