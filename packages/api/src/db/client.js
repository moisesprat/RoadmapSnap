import './types.js';
import pg from 'pg';

const { Pool } = pg;

// The API pool always connects as the non-superuser app role (APP_DATABASE_URL) so RLS applies.
// The owner URL (DATABASE_URL) is for migrations and test fixtures only. build() creates one
// pool per app instance and ends it on close; nothing else opens a connection.

function logIdleClientError(err) {
  console.error('pg pool: idle client error:', err.message);
}

export function createPool(url, { max = 10, connectionTimeoutMillis = 5000 } = {}) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('APP_DATABASE_URL must be a non-empty string');
  }
  const pool = new Pool({ connectionString: url, max, connectionTimeoutMillis });
  // Idle-in-transaction timeouts (V13) and Postgres restarts terminate sessions, which surface as
  // pool 'error' events (fatal without a listener); a saturated pool must fail fast, not hang.
  pool.on('error', logIdleClientError);
  return pool;
}
