// Deno tests — packages/shared/src/jws-generic.ts
// Cover ES256 verification + audience array handling + parseSdJwt digest check.

import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseSdJwt,
  verifyJws,
} from '../../../packages/shared/src/jws-generic.ts';
import {
  generateEs256KeyPair,
  signResultToken,
} from '../../../packages/shared/src/jws.ts';

// Helper — sign a generic ES256 JWS with arbitrary payload by reusing the
// signResultToken plumbing; we cast through `unknown` because the helper is
// typed against ResultTokenClaims but the byte layer is identical.
async function signGeneric(
  payload: Record<string, unknown>,
  privateJwk: JsonWebKey,
  kid = 'kid-test',
): Promise<string> {
  // deno-lint-ignore no-explicit-any
  return await signResultToken(payload as any, { kid, privateJwk });
}

Deno.test('verifyJws accepts well-formed ES256 JWS', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const jws = await signGeneric(
    { iss: 'did:web:demo', exp: now + 60, nbf: now - 1, jti: 'cid-1' },
    privateJwk,
  );
  const r = await verifyJws(jws, {
    jwksKeys: [{ ...publicJwk, kid: 'kid-test' }],
    expectedIssuer: 'did:web:demo',
    now,
  });
  assert(r.valid, `expected valid, got reason=${r.reason}`);
});

Deno.test('verifyJws handles aud as array', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const jws = await signGeneric(
    {
      iss: 'did:web:demo',
      aud: ['app-A', 'app-B'],
      exp: now + 60,
      nbf: now - 1,
    },
    privateJwk,
  );
  const r = await verifyJws(jws, {
    jwksKeys: [{ ...publicJwk, kid: 'kid-test' }],
    expectedAudience: 'app-B',
    now,
  });
  assert(r.valid);
});

Deno.test('verifyJws rejects wrong audience', async () => {
  const { publicJwk, privateJwk } = await generateEs256KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const jws = await signGeneric(
    { iss: 'did:web:demo', aud: 'app-A', exp: now + 60, nbf: now - 1 },
    privateJwk,
  );
  const r = await verifyJws(jws, {
    jwksKeys: [{ ...publicJwk, kid: 'kid-test' }],
    expectedAudience: 'app-B',
    now,
  });
  assertEquals(r.valid, false);
  assertEquals(r.reason, 'wrong_audience');
});

Deno.test('verifyJws rejects unsupported alg', async () => {
  // Hand-craft a JWS with alg=none
  const enc = new TextEncoder();
  const b64 = (b: Uint8Array) => {
    let s = '';
    for (const c of b) s += String.fromCharCode(c);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const header = b64(enc.encode(JSON.stringify({ alg: 'none', typ: 'JWT' })));
  const payload = b64(enc.encode(JSON.stringify({ iss: 'x' })));
  const jws = `${header}.${payload}.`;

  const r = await verifyJws(jws, { jwksKeys: [] });
  assertEquals(r.valid, false);
  assertEquals(r.reason, 'unsupported_alg');
});

Deno.test('parseSdJwt verifies disclosure digests against _sd', async () => {
  // Build a synthetic SD-JWT manually: payload has _sd = [hash(disclosure)]
  // Disclosure: ["salt", "age_at_least", 18]
  const enc = new TextEncoder();
  const b64 = (b: Uint8Array) => {
    let s = '';
    for (const c of b) s += String.fromCharCode(c);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const disclosureRaw = b64(
    enc.encode(JSON.stringify(['salt-xyz', 'age_at_least', 18])),
  );
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(disclosureRaw));
  const digestB64 = b64(new Uint8Array(digest));

  // Use a real ES256 sig so parseSdJwt's parseJws(jws) succeeds.
  const { privateJwk } = await generateEs256KeyPair();
  const inner = await signGeneric(
    { iss: 'did:web:issuer', _sd: [digestB64] },
    privateJwk,
  );

  const sdJwt = `${inner}~${disclosureRaw}~`;
  const parsed = await parseSdJwt(sdJwt);
  assert(parsed !== null);
  assertEquals(parsed!.claims.age_at_least, 18);
  assertEquals(parsed!.disclosures.length, 1);
});

Deno.test('parseSdJwt drops disclosures that do not match a _sd digest', async () => {
  const enc = new TextEncoder();
  const b64 = (b: Uint8Array) => {
    let s = '';
    for (const c of b) s += String.fromCharCode(c);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const malicious = b64(
    enc.encode(JSON.stringify(['salt-evil', 'age_at_least', 99])),
  );

  const { privateJwk } = await generateEs256KeyPair();
  const inner = await signGeneric(
    { iss: 'did:web:issuer', _sd: ['SOMETHING_ELSE'] },
    privateJwk,
  );

  const sdJwt = `${inner}~${malicious}~`;
  const parsed = await parseSdJwt(sdJwt);
  assert(parsed !== null);
  assertEquals(parsed!.disclosures.length, 0);
  assertEquals(parsed!.claims.age_at_least, undefined);
});
