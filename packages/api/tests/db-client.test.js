/**
 * createPool hardening (WR-01): an idle-client error is logged instead of crashing the process,
 * and a saturated pool rejects after the connect timeout instead of waiting forever.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/db/client.js';
import { requireDbEnv, closePools } from './helpers/db.js';

test('createPool defaults to a 5000 ms connect timeout and a max of 10', async () => {
  // Nothing listens on port 1, and the pool never connects, so ending it is immediate.
  const pool = createPool('postgresql://u:p@127.0.0.1:1/none');
  try {
    assert.equal(pool.options.connectionTimeoutMillis, 5000);
    assert.equal(pool.options.max, 10);
  } finally {
    await pool.end();
  }
});

test('an idle-client error is logged with a "pg pool:" prefix and does not throw', async (t) => {
  const mock = t.mock.method(console, 'error', () => {});
  const pool = createPool('postgresql://u:p@127.0.0.1:1/none');
  try {
    assert.equal(pool.listenerCount('error'), 1);
    assert.doesNotThrow(() => pool.emit('error', new Error('simulated idle client error')));
    assert.equal(mock.mock.calls.length, 1);
    assert.match(String(mock.mock.calls[0].arguments[0]), /^pg pool:/);
  } finally {
    await pool.end();
  }
});

test('connect() on a saturated pool rejects with the connect timeout instead of waiting forever', async () => {
  requireDbEnv();
  const pool = createPool(process.env.APP_DATABASE_URL, { max: 1, connectionTimeoutMillis: 300 });
  const held = await pool.connect();
  const started = Date.now();
  // Bounded wait: without a connect timeout the second connect() never settles, and the test
  // must fail on an assertion rather than hang the run.
  const second = pool.connect();
  // Without a connect timeout, `second` is served when `held` is released; hand that client back too.
  second.then((client) => client.release(), () => {});
  let timer;
  const neverSettled = new Promise((resolve) => {
    timer = setTimeout(() => resolve('never settled within 3500 ms'), 3500);
  });
  try {
    await assert.rejects(Promise.race([second, neverSettled]), /timeout exceeded when trying to connect/);
    assert.ok(Date.now() - started < 3000, 'the timeout took longer than 3 seconds');
  } finally {
    clearTimeout(timer);
    held.release();
    await pool.end();
    await closePools();
  }
});

test('createPool still rejects an empty URL', () => {
  assert.throws(() => createPool(''), /APP_DATABASE_URL must be a non-empty string/);
});
