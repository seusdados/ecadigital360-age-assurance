import { describe, it, expect } from 'vitest';
import {
  AgeKeyTokenPublicClaimsSchema,
  AgeKeyForbiddenPublicClaimKeys,
} from './agekey-token.ts';
import { ResultTokenClaimsSchema } from './tokens.ts';
import {
  assertAgeKeyTokenClaimsArePublicSafe,
  isApprovedAgeKeyToken,
} from '../agekey-claims.ts';

const NOW = 1780000000;
const TENANT = '018f7b8c-dddd-eeee-ffff-2b31319d6eaf';
const APPLICATION = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const POLICY = '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf';
const JTI = '018f7b8c-1111-7777-9999-2b31319d6eaf';

function approvedClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://agekey.com.br',
    aud: 'dev-app',
    jti: JTI,
    iat: NOW,
    nbf: NOW,
    exp: NOW + 3600,
    agekey: {
      decision: 'approved',
      threshold_satisfied: true,
      age_threshold: 18,
      method: 'gateway',
      assurance_level: 'substantial',
      reason_code: 'THRESHOLD_SATISFIED',
      policy: { id: POLICY, slug: 'br-18-plus', version: 1 },
      tenant_id: TENANT,
      application_id: APPLICATION,
    },
    ...overrides,
  };
}

describe('AgeKey Token public contract', () => {
  it('accepts a valid approved token', () => {
    const parsed = AgeKeyTokenPublicClaimsSchema.parse(approvedClaims());
    expect(parsed.agekey.decision).toBe('approved');
    expect(parsed.agekey.threshold_satisfied).toBe(true);
  });

  it('is the same canonical schema as ResultTokenClaimsSchema', () => {
    expect(AgeKeyTokenPublicClaimsSchema).toBe(ResultTokenClaimsSchema);
  });

  it('rejects non-uuid jti', () => {
    expect(() =>
      AgeKeyTokenPublicClaimsSchema.parse(approvedClaims({ jti: 'not-a-uuid' })),
    ).toThrow();
  });

  it('rejects non-positive age_threshold', () => {
    const invalid = approvedClaims();
    (invalid.agekey as { age_threshold: number }).age_threshold = 0;
    expect(() => AgeKeyTokenPublicClaimsSchema.parse(invalid)).toThrow();
  });

  it('rejects unknown decision values', () => {
    const invalid = approvedClaims();
    (invalid.agekey as { decision: string }).decision = 'maybe';
    expect(() => AgeKeyTokenPublicClaimsSchema.parse(invalid)).toThrow();
  });

  it('forbidden public claim keys are non-empty and include core PII names', () => {
    expect(AgeKeyForbiddenPublicClaimKeys.length).toBeGreaterThan(10);
    expect(AgeKeyForbiddenPublicClaimKeys).toContain('birthdate');
    expect(AgeKeyForbiddenPublicClaimKeys).toContain('cpf');
    expect(AgeKeyForbiddenPublicClaimKeys).toContain('selfie');
    expect(AgeKeyForbiddenPublicClaimKeys).toContain('age');
  });

  it('age_threshold is permitted because it describes the policy, not the user', () => {
    expect(AgeKeyForbiddenPublicClaimKeys).not.toContain('age_threshold');
  });
});

describe('assertAgeKeyTokenClaimsArePublicSafe', () => {
  it('returns claims when no PII is present', () => {
    const claims = AgeKeyTokenPublicClaimsSchema.parse(approvedClaims());
    expect(assertAgeKeyTokenClaimsArePublicSafe(claims)).toEqual(claims);
  });

  it('throws if a forbidden key is present anywhere in the claims', () => {
    const claims = AgeKeyTokenPublicClaimsSchema.parse(approvedClaims());
    const tampered = {
      ...claims,
      agekey: { ...claims.agekey, birthdate: '2000-01-01' },
    };
    expect(() =>
      assertAgeKeyTokenClaimsArePublicSafe(
        tampered as unknown as typeof claims,
      ),
    ).toThrow(/forbidden/i);
  });
});

describe('isApprovedAgeKeyToken', () => {
  it('returns true for approved + threshold_satisfied + future exp', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const claims = AgeKeyTokenPublicClaimsSchema.parse(
      approvedClaims({ iat: future - 10, nbf: future - 10, exp: future }),
    );
    expect(isApprovedAgeKeyToken(claims)).toBe(true);
  });

  it('returns false when expired', () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const claims = AgeKeyTokenPublicClaimsSchema.parse(
      approvedClaims({ iat: past - 100, nbf: past - 100, exp: past }),
    );
    expect(isApprovedAgeKeyToken(claims)).toBe(false);
  });

  it('returns false when decision is denied', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const denied = approvedClaims({ exp: future });
    (denied.agekey as { decision: string }).decision = 'denied';
    (denied.agekey as { threshold_satisfied: boolean }).threshold_satisfied =
      false;
    const claims = AgeKeyTokenPublicClaimsSchema.parse(denied);
    expect(isApprovedAgeKeyToken(claims)).toBe(false);
  });

  it('returns false when threshold_satisfied is false even if approved', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const inconsistent = approvedClaims({ exp: future });
    (inconsistent.agekey as { threshold_satisfied: boolean }).threshold_satisfied =
      false;
    const claims = AgeKeyTokenPublicClaimsSchema.parse(inconsistent);
    expect(isApprovedAgeKeyToken(claims)).toBe(false);
  });
});
