import './loadEnv.js';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyEnv from '@fastify/env';
import { fileURLToPath } from 'node:url';
import rbacPlugin from './plugins/rbac.js';
import contextPlugin from './plugins/context.js';
import { createPool } from './db/client.js';
import { assertSafeConfig, assertSafeDbRole } from './db/bootChecks.js';

const envSchema = {
  type: 'object',
  required: ['NODE_ENV', 'APP_DATABASE_URL', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE'],
  properties: {
    // No defaults for NODE_ENV or the database URL: a missing value must stop the boot, not
    // fall back to something unsafe (D-10c, D-11).
    NODE_ENV: { type: 'string' },
    PORT: { type: 'integer', default: 4000 },
    APP_DATABASE_URL: { type: 'string' },
    APP_DB_POOL_MAX: { type: 'integer', default: 10 },
    AUTH0_DOMAIN: { type: 'string' },
    AUTH0_AUDIENCE: { type: 'string' },
    CORS_ORIGIN: { type: 'string', default: 'http://localhost:3000' },
    AUTH_TEST_JWKS: { type: 'string' },
  },
};

const version = '0.1.0';

export async function build() {
  const fastify = Fastify({ logger: true });

  // src/loadEnv.js, imported first, is the single .env loader.
  await fastify.register(fastifyEnv, { schema: envSchema });

  // Config checks run before any database access, so an unsafe config never reaches the DB.
  assertSafeConfig(fastify.config);

  const pool = createPool(fastify.config.APP_DATABASE_URL, { max: fastify.config.APP_DB_POOL_MAX });
  let role;
  try {
    ({ role } = await assertSafeDbRole(pool));
  } catch (err) {
    await pool.end();
    throw err;
  }
  fastify.log.info({ role }, 'boot: database role check passed');
  fastify.addHook('onClose', async () => {
    await pool.end();
  });

  await fastify.register(fastifyCors, {
    origin: fastify.config.CORS_ORIGIN,
  });

  await fastify.register(contextPlugin, { pool });
  await fastify.register(rbacPlugin);

  fastify.get('/', async (_request, reply) => {
    return reply.type('application/json').send({
      service: 'roadmapsnap-api',
      version,
      docs: {
        health: '/health',
        api: '/api/v1',
      },
    });
  });

  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'roadmapsnap-api',
    version,
    timestamp: new Date().toISOString(),
  }));

  return fastify;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const app = await build();
    await app.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' });
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
