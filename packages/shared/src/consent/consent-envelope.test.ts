import { describe, expect, it } from 'vitest';
import {
  CONSENT_ENVELOPE_VERSION,
  ConsentDecisionEnvelopeSchema,
  assertConsentEnvelopeIsPublicSafe,
} from './consent-envelope.ts';
import {
  CONSENT_DECISION_DOMAIN,
} from './consent-types.ts';
import type { ConsentDecisionEnvelope } from './consent-envelope.ts';
import {
  buildConsentDecisionEnvelope,
} from './consent-engine.ts';
import { REASON_CODES } from '../reason-codes.ts';

const HMAC = 'a'.repeat(64);
const HMAC_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

const baseInput = {
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
  purpose_codes: ['platform_use', 'data_processing_minimum'] as const,
  data_categories: ['profile_minimum', 'service_communications'] as const,
  risk_tier: 'low' as const,
  subject_ref_hmac: HMAC,
  verification_session_id: null,
  parental_consent_id: null,
  consent_token_id: null,
  consent_text_hash: null,
  proof_hash: null,
  guardian: null,
  acceptance: null,
  token_ttl_seconds: 3600,
  now_seconds: 1_700_000_000,
};

describe('ConsentDecisionEnvelopeSchema', () => {
  it('round-trips a pending envelope', () => {
    const envelope = buildConsentDecisionEnvelope({
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
    });
    expect(envelope.envelope_version).toBe(CONSENT_ENVELOPE_VERSION);
    expect(envelope.decision_domain).toBe(CONSENT_DECISION_DOMAIN);
    expect(envelope.decision).toBe('pending');
    expect(envelope.reason_code).toBe(REASON_CODES.CONSENT_NOT_GIVEN);
    expect(envelope.pii_included).toBe(false);
    expect(envelope.content_included).toBe(false);
    // round-trip through schema
    expect(() => ConsentDecisionEnvelopeSchema.parse(envelope)).not.toThrow();
  });

  it('approves when guardian is verified and acceptance is complete', () => {
    const envelope = buildConsentDecisionEnvelope({
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
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
    });
    expect(envelope.decision).toBe('approved');
    expect(envelope.reason_code).toBe(REASON_CODES.CONSENT_GRANTED);
    expect(envelope.assurance_level).toBe('low');
    expect(envelope.guardian_verification_method).toBe('otp_email');
    expect(envelope.consent_text_hash).toBe(HASH_C);
  });

  it('denies when guardian channel is not verified', () => {
    const envelope = buildConsentDecisionEnvelope({
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
      guardian: {
        guardian_ref_hmac: HMAC_B,
        method: 'otp_email',
        reported_assurance: 'low',
        verified: false,
      },
      acceptance: null,
    });
    expect(envelope.decision).toBe('denied');
    expect(envelope.reason_code).toBe(
      REASON_CODES.CONSENT_GUARDIAN_NOT_VERIFIED,
    );
  });

  it('routes high-risk insufficient assurance to needs_review', () => {
    const envelope = buildConsentDecisionEnvelope({
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
      risk_tier: 'high',
      guardian: {
        guardian_ref_hmac: HMAC_B,
        method: 'otp_email',
        reported_assurance: 'low',
        verified: true,
      },
      acceptance: null,
    });
    expect(envelope.decision).toBe('needs_review');
    expect(envelope.reason_code).toBe(REASON_CODES.CONSENT_NEEDS_REVIEW);
  });

  it('blocks the request when policy refuses the resource', () => {
    const envelope = buildConsentDecisionEnvelope({
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
      policy_blocks_resource: true,
    });
    expect(envelope.decision).toBe('blocked_by_policy');
    expect(envelope.reason_code).toBe(REASON_CODES.CONSENT_BLOCKED_BY_POLICY);
  });

  it('refuses to construct an approved envelope without proof material', () => {
    const inputApprovedNoHashes: Parameters<
      typeof buildConsentDecisionEnvelope
    >[0] = {
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
      // approved engine output requires hashes; we omit them on purpose.
      parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
      consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
      consent_text_hash: null,
      proof_hash: null,
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
    };
    expect(() =>
      buildConsentDecisionEnvelope(inputApprovedNoHashes),
    ).toThrow();
  });
});

describe('privacy guard on consent envelopes', () => {
  it('blocks any envelope that smuggled an email/phone in scope', () => {
    const envelope: ConsentDecisionEnvelope = {
      envelope_version: CONSENT_ENVELOPE_VERSION,
      decision_domain: CONSENT_DECISION_DOMAIN,
      tenant_id: baseInput.tenant_id,
      application_id: baseInput.application_id,
      consent_request_id: baseInput.consent_request_id,
      parental_consent_id: null,
      consent_token_id: null,
      verification_session_id: null,
      policy: baseInput.policy,
      decision: 'pending',
      reason_code: REASON_CODES.CONSENT_NOT_GIVEN,
      resource: 'platform_use',
      scope: null,
      purpose_codes: ['platform_use'],
      data_categories: ['profile_minimum'],
      risk_tier: 'low',
      guardian_verification_method: null,
      assurance_level: null,
      consent_text_hash: null,
      proof_hash: null,
      subject_ref_hmac: HMAC,
      guardian_ref_hmac: null,
      issued_at: 1_700_000_000,
      expires_at: 1_700_003_600,
      pii_included: false,
      content_included: false,
    };
    // smuggle email-style key in subject_ref_hmac via cast
    const polluted = {
      ...envelope,
      // privacy guard rejects this regardless of where it lives in the tree
      email: 'guardian@example.com',
    } as unknown as ConsentDecisionEnvelope;
    expect(() => assertConsentEnvelopeIsPublicSafe(polluted)).toThrow();
  });
});
