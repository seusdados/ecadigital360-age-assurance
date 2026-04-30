// Pure helper that builds the body of `/.well-known/jwks.json`.
//
// Extracted so it can be unit-tested without booting the Deno HTTP
// server. Any caller — production handler, CI test, or local script —
// that converts `loadJwksPublicKeys()` output into a JWKS payload MUST
// route through this function so the public-only guard is applied.
//
// Critical invariant (AK-P0-08):
//   The returned body's `keys` array is GUARANTEED not to contain any
//   private JWK member (`d`, `p`, `q`, `dp`, `dq`, `qi`, `oth`, `k`).
//   `assertJwkIsPublic` is called on every entry as a final line of
//   defense; it will throw if the invariant is ever broken.

import {
  assertJwkIsPublic,
  pickPublicJwk,
} from '../../../packages/shared/src/jws.ts';

export interface JwksKeyInput {
  kid: string;
  publicJwk: JsonWebKey;
}

export interface JwksBody {
  keys: Array<JsonWebKey & { kid: string; use: 'sig'; alg: 'ES256' }>;
}

export function buildJwksResponseBody(input: JwksKeyInput[]): JwksBody {
  const keys = input.map((k) => {
    // Strip anything outside the public allowlist, then assert no private
    // member survived. This is intentional belt-and-suspenders: the input
    // already comes from `loadJwksPublicKeys`, which sanitizes too.
    const sanitized = pickPublicJwk(k.publicJwk);
    const out = {
      ...sanitized,
      kid: k.kid,
      use: 'sig' as const,
      alg: 'ES256' as const,
    };
    assertJwkIsPublic(out);
    return out;
  });
  return { keys };
}
