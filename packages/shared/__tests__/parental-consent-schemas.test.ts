import { describe, expect, it } from 'vitest';
import {
  ParentalConsentConfirmRequestSchema,
  ParentalConsentSessionCreateRequestSchema,
  ParentalConsentSessionCreateResponseSchema,
  ParentalConsentTokenClaimsSchema,
  ParentalGuardianStartRequestSchema,
} from '../src/schemas/parental-consent.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

const VALID_REQUEST_BODY = {
  policy_slug: 'br-13-plus',
  resource: 'social-feed/post-creation',
  purpose_codes: ['account_creation', 'feed_personalization'],
  data_categories: ['nickname', 'preferences'],
  child_ref_hmac: 'a'.repeat(64),
};

const VALID_TOKEN_CLAIMS = {
  iss: 'https://staging.agekey.com.br',
  aud: 'demo-app',
  jti: '018f7b8c-1111-7777-9999-2b31319d6eaf',
  iat: 1780000000,
  nbf: 1780000000,
  exp: 1780003600,
  agekey: {
    decision: 'approved' as const,
    decision_domain: 'parental_consent' as const,
    decision_id: '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf',
    reason_code: 'CONSENT_APPROVED',
    policy: {
      id: '018f7b8c-5555-6666-7777-2b31319d6eaf',
      slug: 'br-13-plus',
      version: 1,
    },
    tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
    application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
    purpose_codes: ['account_creation'],
    data_categories: ['nickname'],
    consent_text_version_id: '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf',
    consent_assurance_level: 'AAL-C1' as const,
  },
};

describe('Parental Consent — schemas (request side)', () => {
  it('aceita body válido para /session', () => {
    const parsed = ParentalConsentSessionCreateRequestSchema.parse(VALID_REQUEST_BODY);
    expect(parsed.locale).toBe('pt-BR');
  });

  it('rejeita body sem child_ref_hmac', () => {
    const { child_ref_hmac: _omit, ...rest } = VALID_REQUEST_BODY;
    expect(() => ParentalConsentSessionCreateRequestSchema.parse(rest)).toThrow();
  });

  it('rejeita campo extra (strict)', () => {
    expect(() =>
      ParentalConsentSessionCreateRequestSchema.parse({
        ...VALID_REQUEST_BODY,
        guardian_email: 'leak@example.com',
      }),
    ).toThrow();
  });

  it('schema do guardian/start exige contact_channel + contact_value', () => {
    const ok = ParentalGuardianStartRequestSchema.parse({
      guardian_panel_token: 'pcpt_test_token_long_enough',
      contact_channel: 'email',
      contact_value: 'r@example.com',
    });
    expect(ok.contact_channel).toBe('email');
  });

  it('schema do confirm aceita decision approve/deny', () => {
    const ok = ParentalConsentConfirmRequestSchema.parse({
      guardian_panel_token: 'pcpt_test_token_long_enough',
      otp: '123456',
      decision: 'approve',
      consent_text_version_id: '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf',
    });
    expect(ok.decision).toBe('approve');
  });
});

describe('Parental Consent — token claims schema', () => {
  it('aceita claims válidos', () => {
    const parsed = ParentalConsentTokenClaimsSchema.parse(VALID_TOKEN_CLAIMS);
    expect(parsed.agekey.decision_domain).toBe('parental_consent');
  });

  it('rejeita decision diferente de approved', () => {
    const c = {
      ...VALID_TOKEN_CLAIMS,
      agekey: { ...VALID_TOKEN_CLAIMS.agekey, decision: 'denied' },
    };
    expect(() => ParentalConsentTokenClaimsSchema.parse(c)).toThrow();
  });

  it('rejeita decision_domain diferente de parental_consent', () => {
    const c = {
      ...VALID_TOKEN_CLAIMS,
      agekey: { ...VALID_TOKEN_CLAIMS.agekey, decision_domain: 'age_verify' },
    };
    expect(() => ParentalConsentTokenClaimsSchema.parse(c)).toThrow();
  });

  it('claims passam pelo privacy guard public_token', () => {
    expect(isPayloadSafe(VALID_TOKEN_CLAIMS, 'public_token')).toBe(true);
  });

  it('claims com guardian_email vazariam — privacy guard bloqueia', () => {
    const malicious = {
      ...VALID_TOKEN_CLAIMS,
      agekey: {
        ...VALID_TOKEN_CLAIMS.agekey,
        guardian_email: 'leak@example.com',
      },
    };
    expect(isPayloadSafe(malicious, 'public_token')).toBe(false);
  });
});

describe('Parental Consent — response schemas (privacy)', () => {
  it('SessionCreateResponse válida sem PII', () => {
    const resp = {
      consent_request_id: '018f7b8c-1111-7777-9999-2b31319d6eaf',
      status: 'awaiting_guardian',
      expires_at: '2026-05-05T19:00:00Z',
      guardian_panel_url: 'https://panel.agekey.com.br/parental-consent/abc?token=xyz',
      guardian_panel_token: 'pcpt_long_token_abcdefghijk',
      policy: {
        id: '018f7b8c-5555-6666-7777-2b31319d6eaf',
        slug: 'br-13-plus',
        version: 1,
        age_threshold: 13,
      },
      consent_text: {
        id: '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf',
        locale: 'pt-BR',
        text_hash: 'a'.repeat(64),
      },
    };
    expect(() => ParentalConsentSessionCreateResponseSchema.parse(resp)).not.toThrow();
    expect(isPayloadSafe(resp, 'public_api_response')).toBe(true);
  });
});
