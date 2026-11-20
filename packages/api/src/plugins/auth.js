/**
 * Auth0 JWT verification plugin for Fastify 5.
 * Uses jose to verify RS256 JWTs against the Auth0 JWKS (or, for tests and local scripts, a
 * local JWKS in AUTH_TEST_JWKS) and adds the fastify.authenticate preHandler.
 */

import { createRemoteJWKSet, createLocalJWKSet, jwtVerify } from 'jose';

/**
 * Local key set for tests: AUTH_TEST_JWKS holds a public JWKS as JSON. It is a second trust
 * anchor, so it is refused outright under NODE_ENV=production.
 */
function loadTestJwks() {
  const raw = process.env.AUTH_TEST_JWKS;
  if (raw == null || raw === '') return null;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_TEST_JWKS must not be set when NODE_ENV=production');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error('AUTH_TEST_JWKS is not a valid JWKS');
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.keys) || parsed.keys.length === 0) {
    throw new Error('AUTH_TEST_JWKS is not a valid JWKS');
  }
  return createLocalJWKSet(parsed);
}

async function authPlugin(fastify) {
  const domain = fastify.config.AUTH0_DOMAIN;
  const audience = fastify.config.AUTH0_AUDIENCE;

  if (!domain || !audience) {
    throw new Error('AUTH0_DOMAIN and AUTH0_AUDIENCE must be set');
  }

  const issuer = `https://${domain}/`;
  const jwksUrl = `https://${domain}/.well-known/jwks.json`;
  const JWKS = loadTestJwks() ?? createRemoteJWKSet(new URL(jwksUrl));

  fastify.decorate('authenticate', async function authenticate(request, reply) {
    // Test / dev: allow X-Test-User-Sub to bypass JWT (never active when NODE_ENV=production)
    const allowTestHeader = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
    if (allowTestHeader) {
      const testSub = request.headers['x-test-user-sub'];
      if (testSub != null && testSub !== '') {
        // Unique email per sub — users.email is UNIQUE; tests use many different subs in one process.
        request.user = {
          sub: testSub,
          email: `${testSub}@test.example.com`,
          name: 'Test User',
        };
        return;
      }
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing Authorization header',
      });
    }

    const token = authHeader.slice(7);
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid token',
      });
    }

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer,
        audience,
        algorithms: ['RS256'],
      });
      if (typeof payload.sub !== 'string' || payload.sub === '') {
        throw new Error('Token has no subject');
      }
      request.user = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch (err) {
      fastify.log.warn({ err }, 'JWT verification failed');
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }
  });

  const { registerAuthRoutes } = await import('../routes/auth.js');
  await registerAuthRoutes(fastify);
  const workspacesRoutes = (await import('../routes/workspaces.js')).default;
  await fastify.register(workspacesRoutes, { prefix: '/api/v1' });
  const projectsRoutes = (await import('../routes/projects.js')).default;
  await fastify.register(projectsRoutes, { prefix: '/api/v1' });
}

export default authPlugin;
