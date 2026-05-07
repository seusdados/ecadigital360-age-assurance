import { describe, expect, it } from 'vitest';
import {
  ParentalConsentTokenClaimsSchema,
  ParentalConsentTokenTypeClaim,
  envelopeToConsentTokenClaims,
} from './consent-token.ts';
import { buildConsentDecisionEnvelope } from './consent-engine.ts';
import { CONSENT_DECISION_DOMAIN } from './consent-types.ts';
import { REASON_CODES } from '../reason-codes.ts';

const HMAC = 'a'.repeat(64);
const HMAC_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

function approvedEnvelope() {
  return buildConsentDecisionEnvelope({
    tenant_id: '018f7b8c-1111-7777-9999-2b31319d6ea1',
    application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
    consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
    policy: {
      id: '018f7b8c-4444-7777-9999-2b31319d6ea4',
      slug: 'parental-consent-default',
      version: 1,
    },
    resource: 'platform_use',
    scope: null,
    purpose_codes: ['platform_use'],
    data_categories: ['profile_minimum'],
    risk_tier: 'low',
    subject_ref_hmac: HMAC,
    verification_session_id: null,
    parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
    consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
    consent_text_hash: HASH_C,
    proof_hash: HASH_D,
    guardian: {
      guardian_ref_hmac: HMAC_B,
      method: 'otp_email',
      reported_assurance: 'low',
      verified: true,
    },
    acceptance: {
      consent_text_hash: HASH_C,
      proof_hash: HASH_D,
      guardian_responsibility_confirmed: true,
      understands_scope: true,
      understands_revocation: true,
    },
    token_ttl_seconds: 3600,
    now_seconds: 1_700_000_000,
  });
}

describe('envelopeToConsentTokenClaims', () => {
  it('mints token claims that satisfy the canonical schema', () => {
    const env = approvedEnvelope();
    const claims = envelopeToConsentTokenClaims(env, {
      iss: 'https://agekey.com.br',
      aud: 'rp-app',
      jti: env.consent_token_id!,
    });
    expect(() => ParentalConsentTokenClaimsSchema.parse(claims)).not.toThrow();
    expect(claims.typ).toBe(ParentalConsentTokenTypeClaim);
    expect(claims.agekey.decision).toBe('approved');
    expect(claims.agekey.decision_domain).toBe(CONSENT_DECISION_DOMAIN);
    expect(claims.agekey.guardian_verified).toBe(true);
    expect(claims.agekey.reason_code).toBe(REASON_CODES.CONSENT_GRANTED);
    expect(claims.agekey.purpose_codes).toContain('platform_use');
  });

  it('refuses to mint a token for a non-approved envelope', () => {
    const env = buildConsentDecisionEnvelope({
      tenant_id: '018f7b8c-1111-7777-9999-2b31319d6ea1',
      application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
      consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
      policy: null,
      resource: 'platform_use',
      scope: null,
      purpose_codes: ['platform_use'],
      data_categories: ['profile_minimum'],
      risk_tier: 'low',
      subject_ref_hmac: HMAC,
      verification_session_id: null,
      parental_consent_id: null,
      consent_token_id: null,
      consent_text_hash: null,
      proof_hash: null,
      guardian: null,
      acceptance: null,
      token_ttl_seconds: 3600,
    });
    expect(() =>
      envelopeToConsentTokenClaims(env, {
        iss: 'https://agekey.com.br',
        aud: 'rp-app',
        jti: '018f7b8c-7777-7777-9999-2b31319d6ea7',
      }),
    ).toThrow();
  });

  it('never carries forbidden PII keys', () => {
    const env = approvedEnvelope();
    const claims = envelopeToConsentTokenClaims(env, {
      iss: 'https://agekey.com.br',
      aud: 'rp-app',
      jti: env.consent_token_id!,
    });
    const json = JSON.stringify(claims);
    for (const k of [
      'email',
      'phone',
      'name',
      'cpf',
      'rg',
      'passport',
      'birthdate',
      'date_of_birth',
      'dob',
      'exact_age',
      'guardian_email',
      'guardian_phone',
      'selfie',
      'face',
      'biometric',
      'address',
      'civil_id',
      'document_number',
    ]) {
      // Match case-insensitive whole keys (`"key":`).
      const re = new RegExp(`"${k}"\\s*:`, 'i');
      expect(re.test(json)).toBe(false);
    }
  });
});
