// Deno tests — _shared/tokens.ts (sign + verify round-trip).
//
// Run with: deno test supabase/functions/_tests/tokens.test.ts

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  generateEs256KeyPair,
  signResultToken,
  verifyResultToken,
} from '../_shared/tokens.ts';

function baseClaims(now: number) {
  return {
    iss: 'https://staging.agekey.com.br',
    aud: 'demo-app',
    jti: '01926cb0-0000-7000-8000-000000000001',
    iat: now,
    nbf: now,
    exp: now + 3600,
    agekey: {
      decision: 'approved' as const,
      threshold_satisfied: true,
      age_threshold: 18,
      method: 'fallback' as const,
      assurance_level: 'low' as const,
      reason_code: 'FALLBACK_DECLARATION_ACCEPTED',
      policy: { id: '01926cb0-0000-7000-8000-000000000002', slug: 'br-18+', version: 1 },
      tenant_id: '01926cb0-0000-7000-8000-000000000003',
      application_id: '01926cb0-0000-7000-8000-000000000004',
    },
  };
}

Deno.test('signResultToken + verifyResultToken round-trip', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const claims = baseClaims(now);

  const jwt = await signResultToken(claims, { kid: 'kid-test-1', privateJwk });
  assert(jwt.split('.').length === 3, 'jwt has 3 parts');

  const r = await verifyResultToken(jwt, {
    jwksKeys: [{ kid: 'kid-test-1', publicJwk }],
    expectedIssuer: claims.iss,
    expectedAudience: claims.aud,
    now,
  });
  assert(r.valid, `expected valid, got reason=${r.reason}`);
  assertEquals(r.claims?.jti, claims.jti);
});

Deno.test('verifyResultToken rejects expired tokens', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const claims = baseClaims(now);
  claims.exp = now - 1;

  const jwt = await signResultToken(claims, { kid: 'kid-test-2', privateJwk });
  // Use clockSkewSeconds: 0 to defeat the default 30s tolerance for this test.
  const r = await verifyResultToken(jwt, {
    jwksKeys: [{ kid: 'kid-test-2', publicJwk }],
    now,
    clockSkewSeconds: 0,
  });
  assertEquals(r.valid, false);
  assertEquals(r.reason, 'expired');
});

Deno.test('verifyResultToken rejects unknown kid', async () => {
  const { privateJwk } = await generateEs256KeyPair();
  const { publicJwk: otherPub } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const claims = baseClaims(now);

  const jwt = await signResultToken(claims, { kid: 'kid-A', privateJwk });
  const r = await verifyResultToken(jwt, {
    jwksKeys: [{ kid: 'kid-B', publicJwk: otherPub }],
    now,
  });
  assertEquals(r.valid, false);
  assertEquals(r.reason, 'unknown_kid');
});

Deno.test('verifyResultToken rejects tampered signature', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const claims = baseClaims(now);

  const jwt = await signResultToken(claims, { kid: 'kid-tamper', privateJwk });
  const parts = jwt.split('.');
  // Flip one char in the signature
  const sig = parts[2]!;
  const tampered = parts[0] + '.' + parts[1] + '.' + (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);

  const r = await verifyResultToken(tampered, {
    jwksKeys: [{ kid: 'kid-tamper', publicJwk }],
    now,
  });
  assertEquals(r.valid, false);
  assert(r.reason === 'bad_signature' || r.reason === 'malformed');
});

Deno.test('verifyResultToken rejects wrong issuer', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const claims = baseClaims(now);

  const jwt = await signResultToken(claims, { kid: 'kid-iss', privateJwk });
  const r = await verifyResultToken(jwt, {
    jwksKeys: [{ kid: 'kid-iss', publicJwk }],
    expectedIssuer: 'https://other.example.com',
    now,
  });
  assertEquals(r.valid, false);
  assertEquals(r.reason, 'wrong_issuer');
});
