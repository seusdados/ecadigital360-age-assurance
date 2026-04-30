// AK-P0-08 — guarantees that JWKS publishing helpers never leak private
// JWK members. The /.well-known/jwks.json endpoint composes its body
// through `pickPublicJwk` + `assertJwkIsPublic`, so a regression here
// is a security incident.

import { describe, expect, it } from 'vitest';
import {
  PRIVATE_JWK_MEMBERS,
  assertJwkIsPublic,
  findPrivateJwkMembers,
  generateEs256KeyPair,
  pickPublicJwk,
} from './jws.ts';

const validEcPublic: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU',
  y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0',
};

describe('PRIVATE_JWK_MEMBERS', () => {
  it('covers EC, RSA and oct private members per RFC 7518', () => {
    for (const m of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k']) {
      expect(PRIVATE_JWK_MEMBERS as readonly string[]).toContain(m);
    }
  });
});

describe('findPrivateJwkMembers', () => {
  it('returns [] for a clean public EC JWK', () => {
    expect(findPrivateJwkMembers(validEcPublic)).toEqual([]);
  });

  it('detects EC private member d', () => {
    const jwk = { ...validEcPublic, d: 'PRIVATE-SCALAR' };
    expect(findPrivateJwkMembers(jwk)).toEqual(['d']);
  });

  it('detects RSA primes p and q', () => {
    expect(findPrivateJwkMembers({ kty: 'RSA', n: 'n', e: 'AQAB', p: 'p', q: 'q' })).toEqual(['p', 'q']);
  });

  it('detects oct secret member k', () => {
    expect(findPrivateJwkMembers({ kty: 'oct', k: 'SHHH' })).toEqual(['k']);
  });

  it('returns [] for non-objects', () => {
    expect(findPrivateJwkMembers(null)).toEqual([]);
    expect(findPrivateJwkMembers(undefined)).toEqual([]);
    expect(findPrivateJwkMembers('d')).toEqual([]);
    expect(findPrivateJwkMembers(42)).toEqual([]);
  });
});

describe('assertJwkIsPublic', () => {
  it('passes for valid public EC JWK', () => {
    expect(() => assertJwkIsPublic(validEcPublic)).not.toThrow();
  });

  it('rejects JWK containing d', () => {
    expect(() => assertJwkIsPublic({ ...validEcPublic, d: 'oops' })).toThrow(
      /private members/i,
    );
  });

  it('rejects JWK containing p', () => {
    expect(() =>
      assertJwkIsPublic({ kty: 'RSA', n: 'n', e: 'AQAB', p: 'leak' }),
    ).toThrow(/private members/i);
  });

  it('rejects JWK containing q', () => {
    expect(() =>
      assertJwkIsPublic({ kty: 'RSA', n: 'n', e: 'AQAB', q: 'leak' }),
    ).toThrow(/private members/i);
  });

  it('rejects JWK containing oct secret k', () => {
    expect(() => assertJwkIsPublic({ kty: 'oct', k: 'leak' })).toThrow();
  });

  it('does not include the JWK contents in the thrown message', () => {
    // The error message must not echo the private material — only
    // the names of the offending members. This protects logs/telemetry.
    try {
      assertJwkIsPublic({ ...validEcPublic, d: 'SUPER-SECRET-PRIVATE-SCALAR' });
      throw new Error('expected throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain('SUPER-SECRET-PRIVATE-SCALAR');
      expect(msg).toContain('d');
    }
  });

  it('rejects when a single private key is buried in a JWKS-style array', () => {
    const keys: unknown[] = [
      validEcPublic,
      { ...validEcPublic, d: 'leak' }, // Middle one is private
      validEcPublic,
    ];
    let caught = 0;
    for (const k of keys) {
      try {
        assertJwkIsPublic(k);
      } catch {
        caught++;
      }
    }
    expect(caught).toBe(1);
  });
});

describe('pickPublicJwk', () => {
  it('strips d from a private EC JWK', async () => {
    const { privateJwk } = await generateEs256KeyPair();
    expect(privateJwk.d).toBeTruthy(); // sanity: it has d
    const cleaned = pickPublicJwk(privateJwk);
    expect((cleaned as Record<string, unknown>).d).toBeUndefined();
    expect(cleaned.kty).toBe('EC');
    expect(cleaned.crv).toBe('P-256');
    expect(cleaned.x).toBeTruthy();
    expect(cleaned.y).toBeTruthy();
  });

  it('strips RSA private members', () => {
    const dirty = {
      kty: 'RSA',
      n: 'modulus',
      e: 'AQAB',
      d: 'PRIVATE',
      p: 'P',
      q: 'Q',
      dp: 'DP',
      dq: 'DQ',
      qi: 'QI',
      oth: [{ r: 'r', d: 'd', t: 't' }],
    };
    const cleaned = pickPublicJwk(dirty) as Record<string, unknown>;
    for (const m of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']) {
      expect(cleaned[m]).toBeUndefined();
    }
    expect(cleaned.n).toBe('modulus');
    expect(cleaned.e).toBe('AQAB');
  });

  it('drops unknown / non-allowlisted properties', () => {
    const dirty = { ...validEcPublic, internal_note: 'do-not-publish', d: 'leak' };
    const cleaned = pickPublicJwk(dirty) as Record<string, unknown>;
    expect(cleaned.internal_note).toBeUndefined();
    expect(cleaned.d).toBeUndefined();
  });

  it('round-trip: pickPublicJwk(privateJwk) is asserted public', async () => {
    const { privateJwk } = await generateEs256KeyPair();
    const cleaned = pickPublicJwk(privateJwk);
    expect(() => assertJwkIsPublic(cleaned)).not.toThrow();
  });
});
