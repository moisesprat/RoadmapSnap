import './types.js';
import pg from 'pg';

const { Pool } = pg;

// The API pool always connects as the non-superuser app role (APP_DATABASE_URL) so RLS applies.
// The owner URL (DATABASE_URL) is for migrations and test fixtures only. build() creates one
// pool per app instance and ends it on close; nothing else opens a connection.

export function createPool(url, { max = 10 } = {}) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('APP_DATABASE_URL must be a non-empty string');
  }
  return new Pool({ connectionString: url, max });
}
