import { describe, it, expect } from 'vitest';
import {
  TokenVerifyRequestSchema,
  TokenVerifyResponseSchema,
  ResultTokenClaimsSchema,
} from './tokens.ts';

const TENANT = '018f7b8c-dddd-eeee-ffff-2b31319d6eaf';
const APPLICATION = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const POLICY = '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf';
const JTI = '018f7b8c-1111-7777-9999-2b31319d6eaf';
const NOW = 1780000000;

function approvedClaims() {
  return {
    iss: 'https://agekey.com.br',
    aud: 'dev-app',
    jti: JTI,
    iat: NOW,
    nbf: NOW,
    exp: NOW + 3600,
    agekey: {
      decision: 'approved' as const,
      threshold_satisfied: true,
      age_threshold: 18,
      method: 'gateway' as const,
      assurance_level: 'substantial' as const,
      reason_code: 'THRESHOLD_SATISFIED',
      policy: { id: POLICY, slug: 'br-18-plus', version: 1 },
      tenant_id: TENANT,
      application_id: APPLICATION,
    },
  };
}

describe('TokenVerifyRequestSchema', () => {
  it('accepts a request with only `token`', () => {
    const parsed = TokenVerifyRequestSchema.parse({ token: 'eyJ.fake.jwt' });
    expect(parsed.token).toBe('eyJ.fake.jwt');
    expect(parsed.expected_audience).toBeUndefined();
  });

  it('accepts a request with token + expected_audience', () => {
    const parsed = TokenVerifyRequestSchema.parse({
      token: 'eyJ.fake.jwt',
      expected_audience: 'dev-app',
    });
    expect(parsed.expected_audience).toBe('dev-app');
  });

  it('rejects a request missing `token`', () => {
    expect(() =>
      TokenVerifyRequestSchema.parse({ expected_audience: 'dev-app' }),
    ).toThrow();
  });

  it('rejects a request with an empty `token`', () => {
    expect(() => TokenVerifyRequestSchema.parse({ token: '' })).toThrow();
  });

  it('rejects unknown extra keys (strict mode)', () => {
    expect(() =>
      TokenVerifyRequestSchema.parse({
        token: 'eyJ.fake.jwt',
        secret_extra: 'should-not-be-here',
      }),
    ).toThrow();
  });
});

describe('TokenVerifyResponseSchema', () => {
  it('accepts a happy-path valid response with claims', () => {
    const parsed = TokenVerifyResponseSchema.parse({
      valid: true,
      claims: approvedClaims(),
      revoked: false,
    });
    expect(parsed.valid).toBe(true);
    expect(parsed.revoked).toBe(false);
    expect(parsed.claims?.agekey.decision).toBe('approved');
  });

  it('accepts an invalid response with reason_code and no claims', () => {
    const parsed = TokenVerifyResponseSchema.parse({
      valid: false,
      reason_code: 'TOKEN_EXPIRED',
      revoked: false,
    });
    expect(parsed.valid).toBe(false);
    expect(parsed.reason_code).toBe('TOKEN_EXPIRED');
    expect(parsed.claims).toBeUndefined();
  });

  it('accepts a revoked response (valid:false + revoked:true)', () => {
    const parsed = TokenVerifyResponseSchema.parse({
      valid: false,
      reason_code: 'INVALID_REQUEST',
      revoked: true,
    });
    expect(parsed.revoked).toBe(true);
  });

  it('rejects a response missing `revoked`', () => {
    expect(() =>
      TokenVerifyResponseSchema.parse({ valid: true, claims: approvedClaims() }),
    ).toThrow();
  });

  it('rejects a response missing `valid`', () => {
    expect(() => TokenVerifyResponseSchema.parse({ revoked: false })).toThrow();
  });

  it('rejects a response whose claims fail ResultTokenClaimsSchema', () => {
    const bad = approvedClaims();
    (bad.agekey as { decision: string }).decision = 'maybe';
    expect(() =>
      TokenVerifyResponseSchema.parse({
        valid: true,
        claims: bad,
        revoked: false,
      }),
    ).toThrow();
    // Sanity: the underlying ResultTokenClaimsSchema rejects the same input.
    expect(() => ResultTokenClaimsSchema.parse(bad)).toThrow();
  });
});
