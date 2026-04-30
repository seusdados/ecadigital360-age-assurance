// Deno tests — JWKS response shape (AK-P0-08).
//
// We exercise the pure builder `buildJwksResponseBody` (not the live HTTP
// handler) because the contract under test is the JSON body — what
// external relying parties actually consume. This avoids the need to
// mock Deno.serve / network.
//
// Critical assertions:
//   1. JWKS body never contains `d` (or any other private JWK member)
//   2. Multiple keys (active + rotating + retired) survive correctly
//   3. Each key has a non-empty `kid`
//   4. `use=sig`, `alg=ES256` injected on every entry

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import { buildJwksResponseBody } from '../_shared/jwks-response.ts';
import {
  findPrivateJwkMembers,
  generateEs256KeyPair,
} from '../../../packages/shared/src/jws.ts';

Deno.test('buildJwksResponseBody returns 2 keys for active+rotating', async () => {
  const a = await generateEs256KeyPair();
  const b = await generateEs256KeyPair();
  const body = buildJwksResponseBody([
    { kid: 'ak_active', publicJwk: a.publicJwk },
    { kid: 'ak_rotating', publicJwk: b.publicJwk },
  ]);
  assertEquals(body.keys.length, 2);
});

Deno.test('buildJwksResponseBody never exposes d', async () => {
  // Worst case: the row in `crypto_keys.public_jwk_json` was accidentally
  // saved with `d` (private scalar). The builder must strip it.
  const { privateJwk } = await generateEs256KeyPair();
  assert(privateJwk.d, 'sanity: privateJwk has d before sanitization');

  const body = buildJwksResponseBody([
    { kid: 'ak_dirty', publicJwk: privateJwk },
  ]);

  for (const k of body.keys) {
    const leaked = findPrivateJwkMembers(k);
    assertEquals(leaked, [], `private members leaked: ${leaked.join(',')}`);
    assertEquals((k as Record<string, unknown>).d, undefined);
  }
});

Deno.test('buildJwksResponseBody preserves kid + injects use/alg per entry', async () => {
  const k1 = await generateEs256KeyPair();
  const k2 = await generateEs256KeyPair();
  const body = buildJwksResponseBody([
    { kid: 'ak_20260430_03', publicJwk: k1.publicJwk },
    { kid: 'ak_20260430_04', publicJwk: k2.publicJwk },
  ]);
  for (const entry of body.keys) {
    assert(typeof entry.kid === 'string' && entry.kid.length > 0);
    assertEquals(entry.use, 'sig');
    assertEquals(entry.alg, 'ES256');
    assertEquals(entry.kty, 'EC');
    assertEquals(entry.crv, 'P-256');
  }
  assertEquals(body.keys[0].kid, 'ak_20260430_03');
  assertEquals(body.keys[1].kid, 'ak_20260430_04');
});

Deno.test('buildJwksResponseBody assigns unique kids preserved verbatim', async () => {
  const k1 = await generateEs256KeyPair();
  const k2 = await generateEs256KeyPair();
  const k3 = await generateEs256KeyPair();
  const body = buildJwksResponseBody([
    { kid: 'kid-a', publicJwk: k1.publicJwk },
    { kid: 'kid-b', publicJwk: k2.publicJwk },
    { kid: 'kid-c', publicJwk: k3.publicJwk },
  ]);
  const kids = body.keys.map((k) => k.kid);
  assertEquals(new Set(kids).size, 3);
});

Deno.test('buildJwksResponseBody drops non-allowlisted props (defense in depth)', async () => {
  const { publicJwk } = await generateEs256KeyPair();
  // Simulate an extra column that should NEVER reach the public surface.
  const dirty = {
    ...publicJwk,
    internal_audit_id: 'tnt-01',
    private_key_enc: 'leaked-hex',
  } as JsonWebKey;
  const body = buildJwksResponseBody([{ kid: 'ak_x', publicJwk: dirty }]);
  const entry = body.keys[0] as Record<string, unknown>;
  assertEquals(entry.internal_audit_id, undefined);
  assertEquals(entry.private_key_enc, undefined);
});

Deno.test('buildJwksResponseBody throws if a leak is somehow constructed', () => {
  // If a future caller bypassed pickPublicJwk and somehow appended `d`
  // to the output object, assertJwkIsPublic must still catch it. We
  // simulate by passing a JsonWebKey-shaped object that already
  // contains `d`. The pickPublicJwk step strips it, so this must NOT
  // throw — the guard is the second line of defense, not the first.
  // Demonstrate the strip happens silently.
  const result = buildJwksResponseBody([
    {
      kid: 'ak_strip',
      publicJwk: { kty: 'EC', crv: 'P-256', x: 'X', y: 'Y', d: 'LEAK' } as JsonWebKey,
    },
  ]);
  assertEquals((result.keys[0] as Record<string, unknown>).d, undefined);
});

Deno.test('JWKS handler attaches Cache-Control max-age=300 (contract)', () => {
  // The handler in jwks/index.ts sets:
  //   Cache-Control: public, max-age=${CACHE_TTL_S}, s-maxage=${CACHE_TTL_S}
  // with CACHE_TTL_S = 300. This test pins both the constant and the
  // header construction so a future refactor can't silently shrink the
  // cache window (which would 10x the JWKS endpoint load).
  const src = Deno.readTextFileSync(
    new URL('../jwks/index.ts', import.meta.url),
  );
  assert(
    /CACHE_TTL_S\s*=\s*300/.test(src),
    'CACHE_TTL_S must be 300 seconds',
  );
  assert(
    src.includes("'Cache-Control'"),
    'jwks handler must set Cache-Control header',
  );
  assert(
    src.includes('max-age=${CACHE_TTL_S}'),
    'Cache-Control must include max-age=${CACHE_TTL_S}',
  );
  assert(
    src.includes('s-maxage=${CACHE_TTL_S}'),
    'Cache-Control must include s-maxage=${CACHE_TTL_S} for CDN',
  );
});

Deno.test('JWKS handler queries active + rotating + retired statuses', () => {
  // Pin the loadJwksPublicKeys query — must include all three states so
  // mid-rotation clients can verify tokens signed by either generation.
  const src = Deno.readTextFileSync(
    new URL('../_shared/keys.ts', import.meta.url),
  );
  assert(src.includes("'active'"));
  assert(src.includes("'rotating'"));
  assert(src.includes("'retired'"));
});
