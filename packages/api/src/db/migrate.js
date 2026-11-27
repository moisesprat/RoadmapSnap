/**
 * RoadmapSnap API — migration runner (ES module)
 * Reads .sql files from src/db/migrations/, runs unapplied ones in order, records in schema_migrations.
 * Versions are tracked by filename only, so an already-recorded file is skipped even if its content changed.
 * Importable as migrate(databaseUrl, { dir, log }); running the file directly is the CLI (npm run migrate).
 * The .env file is loaded by ../loadEnv.js (the real environment wins over the file).
 */

import '../loadEnv.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = join(__dirname, 'migrations');

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

/**
 * Apply every unapplied migration in numeric order.
 * @returns {Promise<{ applied: string[], skipped: string[] }>} version names (filename without .sql)
 */
export async function migrate(databaseUrl, { dir = MIGRATIONS_DIR, log = console.log } = {}) {
  if (!databaseUrl) throw new Error('migrate: databaseUrl is required');

  const applied = [];
  const skipped = [];
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();

    // Ensure schema_migrations exists
    await client.query(CREATE_MIGRATIONS_TABLE);

    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/^V(\d+).*$/i, '$1'), 10) || 0;
        const numB = parseInt(b.replace(/^V(\d+).*$/i, '$1'), 10) || 0;
        return numA - numB;
      });

    if (files.length === 0) {
      log('migrate: No .sql files found in src/db/migrations/');
      return { applied, skipped };
    }

    for (const file of files) {
      const version = file.replace(/\.sql$/i, '');
      const res = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version]
      );
      if (res.rowCount > 0) {
        log(`migrate: Skip (already applied) ${version}`);
        skipped.push(version);
        continue;
      }

      const sqlPath = join(dir, file);
      const sql = readFileSync(sqlPath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        log(`migrate: Applied ${version}`);
        applied.push(version);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`migrate: Failed ${version}`);
        console.error(err.message);
        throw err;
      }
    }

    log('migrate: All migrations completed.');
    return { applied, skipped };
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    if (!process.env.DATABASE_URL) {
      console.error('migrate: DATABASE_URL is not set. Create a .env file or set the variable.');
      process.exit(1);
    }
    await migrate(process.env.DATABASE_URL);
    process.exit(0);
  })().catch((err) => {
    console.error('migrate: Fatal error:', err.message);
    process.exit(1);
  });
}
