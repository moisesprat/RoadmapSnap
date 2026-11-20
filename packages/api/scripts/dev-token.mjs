/**
 * RoadmapSnap API: local token CLI for scripted use (D-09). Replaces the removed header bypass.
 *
 *   node scripts/dev-token.mjs --print-jwks            public-only RS256 JWKS, single line, for AUTH_TEST_JWKS
 *   node scripts/dev-token.mjs --sub <sub> [options]    signed token on stdout, accepted through the real jwtVerify path
 *
 * Options: --sub (default DEV_ADMIN_SUB), --email (default DEV_ADMIN_EMAIL), --name (default 'Dev Admin'),
 * --expires-in (default '1h'). Issuer is https://AUTH0_DOMAIN/ and audience AUTH0_AUDIENCE, so both must
 * match the values the API runs with.
 *
 * The keypair lives in packages/api/.dev-keys/ (gitignored): private.jwk.json (mode 0600) and jwks.json
 * (public). Messages go to stderr; only the requested artifact goes to stdout. Refused under production.
 */

import '../src/loadEnv.js';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { exportJWK, generateKeyPair, importJWK, SignJWT } from 'jose';

const KID = 'dev-key-1';
const ALG = 'RS256';
const KEY_DIR = new URL('../.dev-keys/', import.meta.url);
const PRIVATE_PATH = new URL('private.jwk.json', KEY_DIR);
const JWKS_PATH = new URL('jwks.json', KEY_DIR);
const PUBLIC_MEMBERS = ['kty', 'n', 'e'];

function fail(message) {
  console.error(`dev-token: ${message}`);
  process.exit(1);
}

/** Public JWK built by allow-list, so private members (d, p, q, dp, dq, qi) can never leak. */
function toPublicJwk(jwk) {
  const publicJwk = {};
  for (const member of PUBLIC_MEMBERS) publicJwk[member] = jwk[member];
  publicJwk.kid = KID;
  publicJwk.alg = ALG;
  publicJwk.use = 'sig';
  return publicJwk;
}

/** Load the local keypair, generating it on first use. */
async function loadKeys() {
  mkdirSync(fileURLToPath(KEY_DIR), { recursive: true });
  let privateJwk;
  if (existsSync(PRIVATE_PATH)) {
    privateJwk = JSON.parse(readFileSync(PRIVATE_PATH, 'utf8'));
  } else {
    const { privateKey } = await generateKeyPair(ALG, { extractable: true });
    privateJwk = await exportJWK(privateKey);
    privateJwk.kid = KID;
    privateJwk.alg = ALG;
    privateJwk.use = 'sig';
    writeFileSync(PRIVATE_PATH, JSON.stringify(privateJwk), { mode: 0o600 });
    console.error(`dev-token: generated a new keypair in ${fileURLToPath(KEY_DIR)}`);
  }
  chmodSync(PRIVATE_PATH, 0o600);
  const publicJwk = toPublicJwk(privateJwk);
  const jwks = { keys: [publicJwk] };
  writeFileSync(JWKS_PATH, JSON.stringify(jwks));
  return { privateJwk, jwks };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    fail('refusing to run with NODE_ENV=production');
  }

  const { values } = parseArgs({
    options: {
      'print-jwks': { type: 'boolean', default: false },
      sub: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      'expires-in': { type: 'string' },
    },
    strict: true,
  });

  const { privateJwk, jwks } = await loadKeys();

  if (values['print-jwks']) {
    process.stdout.write(`${JSON.stringify(jwks)}\n`);
    return;
  }

  const sub = values.sub || process.env.DEV_ADMIN_SUB;
  if (!sub) fail('--sub or DEV_ADMIN_SUB is required');
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  if (!domain) fail('AUTH0_DOMAIN is not set');
  if (!audience) fail('AUTH0_AUDIENCE is not set');

  const email = values.email || process.env.DEV_ADMIN_EMAIL || 'dev-admin@local.dev';
  const name = values.name || 'Dev Admin';
  const key = await importJWK(privateJwk, ALG);
  const token = await new SignJWT({ email, name })
    .setProtectedHeader({ alg: ALG, kid: KID })
    .setSubject(sub)
    .setIssuer(`https://${domain}/`)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(values['expires-in'] || '1h')
    .sign(key);
  process.stdout.write(`${token}\n`);
}

main().catch((err) => fail(err.message));
