import { describe, expect, it } from 'vitest';
import { ResultTokenClaimsSchema } from '../src/schemas/tokens.ts';
import {
  ResultTokenClaimsCanonicalSchema,
  hasCanonicalAgekeyExtensions,
} from '../src/schemas/tokens-canonical.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

const BASE_CLAIMS = {
  iss: 'https://agekey.com.br',
  aud: 'dev-app',
  jti: '018f7b8c-1111-7777-9999-2b31319d6eaf',
  iat: 1780000000,
  nbf: 1780000000,
  exp: 1780003600,
  agekey: {
    decision: 'approved' as const,
    threshold_satisfied: true,
    age_threshold: 18,
    method: 'vc' as const,
    assurance_level: 'substantial' as const,
    reason_code: 'THRESHOLD_SATISFIED',
    policy: {
      id: '018f7b8c-5555-6666-7777-2b31319d6eaf',
      slug: 'br-18-plus',
      version: 1,
    },
    tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
    application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
  },
};

describe('Result Token Claims — schema canônico estendido', () => {
  it('aceita claims sem extensões (compat com legado)', () => {
    const parsed = ResultTokenClaimsCanonicalSchema.parse(BASE_CLAIMS);
    expect(parsed.agekey.decision).toBe('approved');
  });

  it('aceita decision_id e decision_domain opcionais', () => {
    const claims = {
      ...BASE_CLAIMS,
      agekey: {
        ...BASE_CLAIMS.agekey,
        decision_id: '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf',
        decision_domain: 'age_verify' as const,
      },
    };
    const parsed = ResultTokenClaimsCanonicalSchema.parse(claims);
    expect(parsed.agekey.decision_id).toBe(
      '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf',
    );
    expect(parsed.agekey.decision_domain).toBe('age_verify');
  });

  it('aceita reason_codes cumulativo opcional', () => {
    const claims = {
      ...BASE_CLAIMS,
      agekey: {
        ...BASE_CLAIMS.agekey,
        reason_codes: ['THRESHOLD_SATISFIED', 'AGE_POLICY_SATISFIED'],
      },
    };
    const parsed = ResultTokenClaimsCanonicalSchema.parse(claims);
    expect(parsed.agekey.reason_codes).toHaveLength(2);
  });

  it('hasCanonicalAgekeyExtensions detecta presença', () => {
    expect(hasCanonicalAgekeyExtensions(BASE_CLAIMS)).toBe(false);
    expect(
      hasCanonicalAgekeyExtensions({
        ...BASE_CLAIMS,
        agekey: { ...BASE_CLAIMS.agekey, decision_id: 'x' },
      }),
    ).toBe(true);
  });

  it('claims canônicas continuam sendo válidas no schema legado (presença das extras é tolerada por z.object não-strict do legado)', () => {
    // O schema legado não usa .strict(), então campos extras são
    // descartados/permitidos. Esse comportamento é desejado para compat.
    const claims = {
      ...BASE_CLAIMS,
      agekey: {
        ...BASE_CLAIMS.agekey,
        decision_id: '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf',
      },
    };
    expect(() => ResultTokenClaimsSchema.parse(claims)).not.toThrow();
  });

  it('claims canônicas passam pelo privacy guard public_token', () => {
    const claims = {
      ...BASE_CLAIMS,
      agekey: {
        ...BASE_CLAIMS.agekey,
        decision_id: '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf',
        decision_domain: 'age_verify',
        reason_codes: ['AGE_POLICY_SATISFIED'],
      },
    };
    expect(isPayloadSafe(claims, 'public_token')).toBe(true);
  });
});
