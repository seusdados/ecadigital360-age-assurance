// Token revocation — assegura que a resposta canônica de
// /parental-consent/token/verify reflete corretamente o estado de
// revogação. O verify nunca aceita um token revogado mesmo que a
// assinatura/exp/aud sejam válidas.
//
// Testes unitários de PROFILE da resposta — a checagem online da
// `parental_consent_tokens.revoked_at` é integração e está em
// `packages/integration-tests/__tests__/consent-cross-tenant.test.ts`.
import { describe, expect, it } from 'vitest';
import {
  ParentalConsentTokenVerifyResponseSchema,
  ParentalConsentRevokeResponseSchema,
  type ParentalConsentTokenVerifyResponse,
} from '../src/schemas/parental-consent.ts';
import { CANONICAL_REASON_CODES } from '../src/taxonomy/reason-codes.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

const POLICY_ID = '018f7b8c-5555-6666-7777-2b31319d6eaf';
const TENANT_ID = '018f7b8c-dddd-eeee-ffff-2b31319d6eaf';
const APP_ID = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const PARENTAL_CONSENT_ID = '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf';
const TEXT_VERSION_ID = '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf';
const TOKEN_JTI = '018f7b8c-9999-aaaa-bbbb-2b31319d6eaf';

const VALID_CLAIMS = {
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
};

describe('Token revocation — estado da resposta verify', () => {
  it('antes da revogação: valid=true, revoked=false, reason_code=CONSENT_APPROVED', () => {
    const resp: ParentalConsentTokenVerifyResponse = {
      valid: true,
      revoked: false,
      reason_code: CANONICAL_REASON_CODES.CONSENT_APPROVED,
      claims: VALID_CLAIMS,
    };
    expect(() => ParentalConsentTokenVerifyResponseSchema.parse(resp)).not.toThrow();
    expect(resp.valid).toBe(true);
    expect(resp.revoked).toBe(false);
    expect(resp.reason_code).toBe('CONSENT_APPROVED');
  });

  it('após revogação: valid=false, revoked=true, reason_code=TOKEN_REVOKED', () => {
    const resp: ParentalConsentTokenVerifyResponse = {
      valid: false,
      revoked: true,
      reason_code: CANONICAL_REASON_CODES.TOKEN_REVOKED,
      claims: VALID_CLAIMS,
    };
    expect(() => ParentalConsentTokenVerifyResponseSchema.parse(resp)).not.toThrow();
    expect(resp.valid).toBe(false);
    expect(resp.revoked).toBe(true);
    expect(resp.reason_code).toBe('TOKEN_REVOKED');
  });

  it('expirado: valid=false, revoked=false, reason_code=TOKEN_EXPIRED', () => {
    const resp: ParentalConsentTokenVerifyResponse = {
      valid: false,
      revoked: false,
      reason_code: CANONICAL_REASON_CODES.TOKEN_EXPIRED,
    };
    expect(() => ParentalConsentTokenVerifyResponseSchema.parse(resp)).not.toThrow();
    expect(resp.valid).toBe(false);
    expect(resp.revoked).toBe(false);
    expect(resp.reason_code).toBe('TOKEN_EXPIRED');
  });

  it('audience errado: reason_code=TOKEN_AUDIENCE_MISMATCH', () => {
    const resp: ParentalConsentTokenVerifyResponse = {
      valid: false,
      revoked: false,
      reason_code: CANONICAL_REASON_CODES.TOKEN_AUDIENCE_MISMATCH,
    };
    expect(() => ParentalConsentTokenVerifyResponseSchema.parse(resp)).not.toThrow();
    expect(resp.reason_code).toBe('TOKEN_AUDIENCE_MISMATCH');
  });

  it('assinatura inválida: reason_code=TOKEN_INVALID', () => {
    const resp: ParentalConsentTokenVerifyResponse = {
      valid: false,
      revoked: false,
      reason_code: CANONICAL_REASON_CODES.TOKEN_INVALID,
    };
    expect(() => ParentalConsentTokenVerifyResponseSchema.parse(resp)).not.toThrow();
    expect(resp.reason_code).toBe('TOKEN_INVALID');
  });

  it('verify reject deve passar privacy guard public_api_response', () => {
    const resp: ParentalConsentTokenVerifyResponse = {
      valid: false,
      revoked: true,
      reason_code: 'TOKEN_REVOKED',
      claims: VALID_CLAIMS,
    };
    expect(isPayloadSafe(resp, 'public_api_response')).toBe(true);
  });

  it('RevokeResponse usa reason_code=CONSENT_REVOKED literal', () => {
    const resp = {
      parental_consent_id: PARENTAL_CONSENT_ID,
      revoked_at: '2026-05-07T18:00:00Z',
      reason_code: 'CONSENT_REVOKED' as const,
    };
    expect(() => ParentalConsentRevokeResponseSchema.parse(resp)).not.toThrow();
    // Literal: outros valores são rejeitados.
    expect(() =>
      ParentalConsentRevokeResponseSchema.parse({
        ...resp,
        reason_code: 'CONSENT_APPROVED' as unknown as 'CONSENT_REVOKED',
      }),
    ).toThrow();
  });

  it('claims revogados ainda passam o privacy guard (sem PII)', () => {
    expect(isPayloadSafe(VALID_CLAIMS, 'public_api_response')).toBe(true);
    expect(isPayloadSafe(VALID_CLAIMS, 'public_token')).toBe(true);
  });
});
