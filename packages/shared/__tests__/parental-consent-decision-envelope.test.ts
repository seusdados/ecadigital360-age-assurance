// Decision Envelope — forma canônica nas respostas do AgeKey Consent.
// Todas as respostas adicionam `decision_envelope` opcionalmente. O
// envelope é validado pelo `DecisionEnvelopeSchema` canônico e por
// `assertPayloadSafe('public_api_response')`.
import { describe, expect, it } from 'vitest';
import {
  DecisionEnvelopeSchema,
  createDecisionEnvelope,
} from '../src/decision/decision-envelope.ts';
import {
  ParentalConsentSessionCreateResponseSchema,
  ParentalConsentSessionGetResponseSchema,
  ParentalConsentConfirmResponseSchema,
  ParentalConsentRevokeResponseSchema,
  ParentalConsentTokenVerifyResponseSchema,
} from '../src/schemas/parental-consent.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';
import { CANONICAL_REASON_CODES } from '../src/taxonomy/reason-codes.ts';

const POLICY_ID = '018f7b8c-5555-6666-7777-2b31319d6eaf';
const TENANT_ID = '018f7b8c-dddd-eeee-ffff-2b31319d6eaf';
const APP_ID = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const REQUEST_ID = '018f7b8c-1111-7777-9999-2b31319d6eaf';
const PARENTAL_CONSENT_ID = '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf';
const TEXT_VERSION_ID = '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf';
const TOKEN_JTI = '018f7b8c-9999-aaaa-bbbb-2b31319d6eaf';

function envelopePending() {
  return createDecisionEnvelope({
    decision_domain: 'parental_consent',
    decision: 'pending_guardian',
    reason_code: CANONICAL_REASON_CODES.CONSENT_REQUIRED,
    decision_id: REQUEST_ID,
    tenant_id: TENANT_ID,
    application_id: APP_ID,
    policy_id: POLICY_ID,
    policy_version: '1',
    resource: 'social-feed/post-creation',
    expires_at: '2026-05-08T00:00:00Z',
  });
}

function envelopeApproved() {
  return createDecisionEnvelope({
    decision_domain: 'parental_consent',
    decision: 'approved',
    reason_code: CANONICAL_REASON_CODES.CONSENT_APPROVED,
    decision_id: PARENTAL_CONSENT_ID,
    tenant_id: TENANT_ID,
    application_id: APP_ID,
    policy_id: POLICY_ID,
    policy_version: '1',
    consent_token_id: TOKEN_JTI,
    expires_at: '2027-05-07T00:00:00Z',
    assurance_level: 'AAL-C1',
  });
}

function envelopeRevoked() {
  return createDecisionEnvelope({
    decision_domain: 'parental_consent',
    decision: 'revoked',
    reason_code: CANONICAL_REASON_CODES.CONSENT_REVOKED,
    decision_id: PARENTAL_CONSENT_ID,
    tenant_id: TENANT_ID,
    application_id: APP_ID,
    consent_token_id: TOKEN_JTI,
    expires_at: '2026-05-07T18:00:00Z',
  });
}

describe('Decision Envelope — forma canônica do módulo Consent', () => {
  it('envelope pendente do /session valida no schema canônico', () => {
    const env = envelopePending();
    expect(() => DecisionEnvelopeSchema.parse(env)).not.toThrow();
    expect(env.decision_domain).toBe('parental_consent');
    expect(env.decision).toBe('pending_guardian');
    expect(env.reason_code).toBe('CONSENT_REQUIRED');
    expect(env.content_included).toBe(false);
    expect(env.pii_included).toBe(false);
  });

  it('envelope approved do /confirm valida no schema canônico', () => {
    const env = envelopeApproved();
    expect(() => DecisionEnvelopeSchema.parse(env)).not.toThrow();
    expect(env.decision).toBe('approved');
    expect(env.consent_token_id).toBe(TOKEN_JTI);
    expect(env.assurance_level).toBe('AAL-C1');
  });

  it('envelope revoked do /revoke valida no schema canônico', () => {
    const env = envelopeRevoked();
    expect(() => DecisionEnvelopeSchema.parse(env)).not.toThrow();
    expect(env.decision).toBe('revoked');
    expect(env.reason_code).toBe('CONSENT_REVOKED');
  });

  it('envelope rejeita campos extras (strict)', () => {
    expect(() =>
      DecisionEnvelopeSchema.parse({
        ...envelopePending(),
        guardian_email: 'leak@example.com',
      } as Record<string, unknown>),
    ).toThrow();
  });

  it('envelope rejeita pii_included=true e content_included=true', () => {
    const bad = { ...envelopePending(), pii_included: true } as Record<
      string,
      unknown
    >;
    expect(() => DecisionEnvelopeSchema.parse(bad)).toThrow();
    const bad2 = { ...envelopePending(), content_included: true } as Record<
      string,
      unknown
    >;
    expect(() => DecisionEnvelopeSchema.parse(bad2)).toThrow();
  });

  it('envelope passa no privacy guard public_api_response', () => {
    expect(isPayloadSafe(envelopeApproved(), 'public_api_response')).toBe(true);
    expect(isPayloadSafe(envelopeRevoked(), 'public_api_response')).toBe(true);
    expect(isPayloadSafe(envelopePending(), 'public_api_response')).toBe(true);
  });
});

describe('Schemas Consent — aceitam decision_envelope opcional', () => {
  it('SessionCreateResponse aceita decision_envelope', () => {
    const resp = {
      consent_request_id: REQUEST_ID,
      status: 'awaiting_guardian',
      expires_at: '2026-05-08T00:00:00Z',
      guardian_panel_url:
        'https://panel.agekey.com.br/parental-consent/x?token=y',
      guardian_panel_token: 'pcpt_abcdefghijkmnpqrs',
      policy: {
        id: POLICY_ID,
        slug: 'br-13-plus',
        version: 1,
        age_threshold: 13,
      },
      consent_text: {
        id: TEXT_VERSION_ID,
        locale: 'pt-BR',
        text_hash: 'a'.repeat(64),
      },
      decision_envelope: envelopePending(),
    };
    expect(() =>
      ParentalConsentSessionCreateResponseSchema.parse(resp),
    ).not.toThrow();
  });

  it('SessionGetResponse aceita decision_envelope', () => {
    const resp = {
      consent_request_id: REQUEST_ID,
      status: 'approved',
      resource: 'social-feed/post-creation',
      purpose_codes: ['account_creation'],
      data_categories: ['nickname'],
      policy: {
        id: POLICY_ID,
        slug: 'br-13-plus',
        version: 1,
        age_threshold: 13,
      },
      consent_text: {
        id: TEXT_VERSION_ID,
        locale: 'pt-BR',
        text_hash: 'a'.repeat(64),
      },
      expires_at: '2026-05-08T00:00:00Z',
      decided_at: '2026-05-07T18:00:00Z',
      reason_code: 'CONSENT_APPROVED',
      decision_envelope: envelopeApproved(),
    };
    expect(() => ParentalConsentSessionGetResponseSchema.parse(resp)).not.toThrow();
  });

  it('ConfirmResponse aceita decision_envelope + consent_text_hash', () => {
    const resp = {
      consent_request_id: REQUEST_ID,
      parental_consent_id: PARENTAL_CONSENT_ID,
      status: 'approved',
      decision: 'approved',
      reason_code: 'CONSENT_APPROVED',
      consent_text_hash: 'a'.repeat(64),
      token: {
        jwt: 'eyJ...',
        jti: TOKEN_JTI,
        expires_at: '2027-05-07T00:00:00Z',
        kid: 'k1',
      },
      decision_envelope: envelopeApproved(),
    };
    expect(() => ParentalConsentConfirmResponseSchema.parse(resp)).not.toThrow();
  });

  it('RevokeResponse aceita decision_envelope', () => {
    const resp = {
      parental_consent_id: PARENTAL_CONSENT_ID,
      revoked_at: '2026-05-07T18:00:00Z',
      reason_code: 'CONSENT_REVOKED' as const,
      decision_envelope: envelopeRevoked(),
    };
    expect(() => ParentalConsentRevokeResponseSchema.parse(resp)).not.toThrow();
  });

  it('TokenVerifyResponse aceita decision_envelope', () => {
    const resp = {
      valid: true,
      revoked: false,
      reason_code: 'CONSENT_APPROVED',
      claims: {
        iss: 'https://staging.agekey.com.br',
        aud: 'demo-app',
        jti: TOKEN_JTI,
        iat: 1780000000,
        nbf: 1780000000,
        exp: 1780003600,
        agekey: {
          decision: 'approved' as const,
          decision_domain: 'parental_consent' as const,
          decision_id: PARENTAL_CONSENT_ID,
          reason_code: 'CONSENT_APPROVED',
          policy: { id: POLICY_ID, slug: 'br-13-plus', version: 1 },
          tenant_id: TENANT_ID,
          application_id: APP_ID,
          purpose_codes: ['account_creation'],
          data_categories: ['nickname'],
          consent_text_version_id: TEXT_VERSION_ID,
        },
      },
      decision_envelope: envelopeApproved(),
    };
    expect(() => ParentalConsentTokenVerifyResponseSchema.parse(resp)).not.toThrow();
  });

  it('Schemas continuam aceitando respostas SEM decision_envelope (compat HML)', () => {
    const resp = {
      parental_consent_id: PARENTAL_CONSENT_ID,
      revoked_at: '2026-05-07T18:00:00Z',
      reason_code: 'CONSENT_REVOKED' as const,
    };
    expect(() => ParentalConsentRevokeResponseSchema.parse(resp)).not.toThrow();
  });
});
