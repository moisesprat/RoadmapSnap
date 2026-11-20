/**
 * Test auth helper: a local RS256 keypair, the matching public JWKS exposed through
 * AUTH_TEST_JWKS (consumed by src/plugins/auth.js), and token signers.
 * Call initTestAuth() inside before(), after the imports, because src/loadEnv.js writes
 * packages/api/.env values into process.env at import time.
 */

import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { randomBytes } from 'node:crypto';

const KID = 'test-key-1';

let keys = null;

export async function initTestAuth() {
  if (!keys) {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = KID;
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    keys = { privateKey, jwk };
  }
  process.env.AUTH_TEST_JWKS = JSON.stringify({ keys: [keys.jwk] });
  if (!process.env.AUTH0_DOMAIN) process.env.AUTH0_DOMAIN = 'test.auth0.com';
  if (!process.env.AUTH0_AUDIENCE) process.env.AUTH0_AUDIENCE = 'https://test.api';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
}

function buildJwt({ sub, email, name, expiresIn = '5m', audience, issuer }) {
  const claims = {};
  if (email !== undefined) claims.email = email;
  if (name !== undefined) claims.name = name;
  return new SignJWT(claims)
    .setSubject(sub)
    .setIssuer(issuer ?? `https://${process.env.AUTH0_DOMAIN}/`)
    .setAudience(audience ?? process.env.AUTH0_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn);
}

/** Token signed by the local test key that AUTH_TEST_JWKS publishes. */
export async function signToken(claims) {
  if (!keys) throw new Error('initTestAuth() must run before signToken()');
  return buildJwt(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .sign(keys.privateKey);
}

/** Same shape, signed by a fresh keypair that is not in the JWKS. */
export async function signForeignToken(claims) {
  const { privateKey } = await generateKeyPair('RS256');
  return buildJwt(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .sign(privateKey);
}

/** HS256 token with a random secret (must be rejected by the RS256 pin). */
export async function signHs256Token(claims) {
  const secret = randomBytes(32);
  return buildJwt(claims)
    .setProtectedHeader({ alg: 'HS256', kid: KID })
    .sign(secret);
}

export function bearer(token) {
  return { authorization: `Bearer ${token}` };
}
