import { describe, expect, it } from 'vitest';
import {
  DECISION_ENVELOPE_VERSION,
  DecisionEnvelopeSchema,
  assertDecisionEnvelopeIsPublicSafe,
  envelopeToTokenClaims,
  type DecisionEnvelope,
} from './decision-envelope.ts';
import { ResultTokenClaimsSchema } from '../schemas/tokens.ts';
import { REASON_CODES } from '../reason-codes.ts';

const TENANT = '018f7b8c-dddd-eeee-ffff-2b31319d6eaf';
const APPLICATION = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const SESSION = '018f7b8c-aaaa-1111-2222-2b31319d6eaf';
const POLICY = '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf';

const baseEnvelope: DecisionEnvelope = {
  envelope_version: DECISION_ENVELOPE_VERSION,
  tenant_id: TENANT,
  application_id: APPLICATION,
  session_id: SESSION,
  policy: { id: POLICY, slug: 'br-18-plus', version: 1 },
  decision: 'approved',
  threshold_satisfied: true,
  age_threshold: 18,
  age_band: null,
  method: 'gateway',
  assurance_level: 'substantial',
  reason_code: REASON_CODES.THRESHOLD_SATISFIED,
  evidence: { format: 'gateway-attestation', proof_kind: 'jws' },
  issued_at: 1_780_000_000,
  expires_at: 1_780_003_600,
  external_user_ref: null,
};

describe('DecisionEnvelopeSchema', () => {
  it('accepts a valid approved envelope', () => {
    const parsed = DecisionEnvelopeSchema.parse(baseEnvelope);
    expect(parsed.decision).toBe('approved');
  });

  it('rejects expires_at <= issued_at', () => {
    const result = DecisionEnvelopeSchema.safeParse({
      ...baseEnvelope,
      expires_at: baseEnvelope.issued_at,
    });
    expect(result.success).toBe(false);
  });

  it('rejects approved envelopes whose threshold_satisfied is false', () => {
    const result = DecisionEnvelopeSchema.safeParse({
      ...baseEnvelope,
      threshold_satisfied: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects denied envelopes whose threshold_satisfied is true', () => {
    const result = DecisionEnvelopeSchema.safeParse({
      ...baseEnvelope,
      decision: 'denied',
      reason_code: REASON_CODES.POLICY_ASSURANCE_UNMET,
    });
    expect(result.success).toBe(false);
  });

  it('blocks PII keys in evidence.extra via privacy guard', () => {
    expect(() =>
      assertDecisionEnvelopeIsPublicSafe({
        ...baseEnvelope,
        evidence: { extra: { cpf: '12345678909' } },
      }),
    ).toThrow(/forbidden PII-like keys/);
  });
});

describe('envelopeToTokenClaims', () => {
  it('produces claims that satisfy ResultTokenClaimsSchema', () => {
    const claims = envelopeToTokenClaims(baseEnvelope, {
      iss: 'https://agekey.com.br',
      aud: 'demo-app',
      jti: '018f7b8c-1111-7777-9999-2b31319d6eaf',
    });
    expect(() => ResultTokenClaimsSchema.parse(claims)).not.toThrow();
    expect(claims.agekey.policy.slug).toBe('br-18-plus');
    expect(claims.exp).toBe(baseEnvelope.expires_at);
    expect(claims.iat).toBe(baseEnvelope.issued_at);
    expect(claims.nbf).toBe(baseEnvelope.issued_at);
  });

  it('omits sub when external_user_ref is null', () => {
    const claims = envelopeToTokenClaims(baseEnvelope, {
      iss: 'https://agekey.com.br',
      aud: 'demo-app',
      jti: '018f7b8c-1111-7777-9999-2b31319d6eaf',
    });
    expect(claims.sub).toBeUndefined();
  });

  it('forwards external_user_ref to sub when present', () => {
    const ref = 'opaque-hmac-deadbeefdeadbeef';
    const claims = envelopeToTokenClaims(
      { ...baseEnvelope, external_user_ref: ref },
      {
        iss: 'https://agekey.com.br',
        aud: 'demo-app',
        jti: '018f7b8c-1111-7777-9999-2b31319d6eaf',
      },
    );
    expect(claims.sub).toBe(ref);
  });
});
