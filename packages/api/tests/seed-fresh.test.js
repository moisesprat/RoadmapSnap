/**
 * Fresh-install guarantee (SEC-05, D-01..D-04): migrating an empty database yields the schema,
 * policies and indexes but no tenant rows, and running migrate again changes nothing.
 * Runs on a scratch database so it cannot disturb the shared test database.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import {
  requireDbEnv,
  createScratchDatabase,
  dropScratchDatabase,
  closePools,
} from './helpers/db.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations');
const FILE_COUNT = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).length;

const TENANT_TABLES = [
  'organizations',
  'users',
  'org_members',
  'workspaces',
  'programs',
  'projects',
  'milestones',
  'budget_periods',
  'kpis',
  'risks',
  'dependencies',
  'audit_events',
];

/** One superuser connection, so RLS hides nothing from the counts. */
async function withOwner(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function tenantCounts(client) {
  const counts = {};
  for (const table of TENANT_TABLES) {
    const res = await client.query(`SELECT count(*)::int AS n FROM ${pg.escapeIdentifier(table)}`);
    counts[table] = res.rows[0].n;
  }
  return counts;
}

describe('fresh install is schema-only', () => {
  let scratch;
  let firstRun;

  before(async () => {
    requireDbEnv();
    scratch = await createScratchDatabase('rs_fresh');
  });

  after(async () => {
    if (scratch) await dropScratchDatabase(scratch.name);
    await closePools();
  });

  it('fresh install has schema but no rows', async () => {
    firstRun = await migrate(scratch.ownerUrl, { log: () => {} });
    assert.equal(firstRun.applied.length, FILE_COUNT);
    assert.deepEqual(firstRun.skipped, []);

    await withOwner(scratch.ownerUrl, async (client) => {
      const counts = await tenantCounts(client);
      const expected = Object.fromEntries(TENANT_TABLES.map((t) => [t, 0]));
      assert.deepEqual(counts, expected);

      const idx = await client.query(
        `SELECT indexname FROM pg_indexes
          WHERE indexname IN ('idx_dependencies_to_project', 'idx_dependencies_from_project')`
      );
      assert.deepEqual(
        idx.rows.map((r) => r.indexname).sort(),
        ['idx_dependencies_from_project', 'idx_dependencies_to_project']
      );

      const versions = await client.query('SELECT count(*)::int AS n FROM schema_migrations');
      assert.equal(versions.rows[0].n, FILE_COUNT);
    });
  });

  it('migrate is idempotent on an existing database', async () => {
    // Own first run when this case is selected alone; a no-op when the first test already ran.
    if (!firstRun) await migrate(scratch.ownerUrl, { log: () => {} });

    const before = await withOwner(scratch.ownerUrl, tenantCounts);
    const second = await migrate(scratch.ownerUrl, { log: () => {} });
    assert.deepEqual(second.applied, []);
    assert.equal(second.skipped.length, FILE_COUNT);

    const after = await withOwner(scratch.ownerUrl, tenantCounts);
    assert.deepEqual(after, before);
  });
});
