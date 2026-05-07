// Privacy Guard — payload simulado das respostas públicas do módulo
// AgeKey Consent. Garante que o guard rejeita PII em qualquer formato
// (e-mail, phone, name, document, birthdate, age) e que payloads "limpos"
// (apenas IDs, hashes, masks) passam.
import { describe, expect, it } from 'vitest';
import {
  assertPayloadSafe,
  isPayloadSafe,
  PrivacyGuardForbiddenClaimError,
} from '../src/privacy/index.ts';

const CONSENT_REQUEST_ID = '018f7b8c-1111-7777-9999-2b31319d6eaf';
const POLICY_ID = '018f7b8c-5555-6666-7777-2b31319d6eaf';
const TEXT_VERSION_ID = '018f7b8c-eeee-ffff-aaaa-2b31319d6eaf';
const TENANT_ID = '018f7b8c-dddd-eeee-ffff-2b31319d6eaf';
const APP_ID = '018f7b8c-2222-3333-4444-2b31319d6eaf';
const PARENTAL_CONSENT_ID = '018f7b8c-aaaa-bbbb-cccc-2b31319d6eaf';

const SESSION_RESPONSE_OK = {
  consent_request_id: CONSENT_REQUEST_ID,
  status: 'awaiting_guardian',
  expires_at: '2026-05-08T00:00:00Z',
  guardian_panel_url: `https://panel.agekey.com.br/parental-consent/${CONSENT_REQUEST_ID}?token=pcpt_xxxx`,
  guardian_panel_token: 'pcpt_aaaaaaaaaaaaaaaa',
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
  decision_envelope: {
    decision_domain: 'parental_consent',
    decision: 'pending_guardian',
    reason_code: 'CONSENT_REQUIRED',
    decision_id: CONSENT_REQUEST_ID,
    tenant_id: TENANT_ID,
    application_id: APP_ID,
    policy_id: POLICY_ID,
    policy_version: '1',
    resource: 'social-feed/post-creation',
    expires_at: '2026-05-08T00:00:00Z',
    content_included: false,
    pii_included: false,
  },
};

const GUARDIAN_START_RESPONSE_OK = {
  consent_request_id: CONSENT_REQUEST_ID,
  guardian_verification_id: '018f7b8c-3333-4444-5555-2b31319d6eaf',
  contact_channel: 'email',
  contact_masked: 'r***@example.com',
  otp_expires_at: '2026-05-07T18:30:00Z',
  dev_otp: null,
  status: 'awaiting_verification',
};

const CONFIRM_RESPONSE_OK = {
  consent_request_id: CONSENT_REQUEST_ID,
  parental_consent_id: PARENTAL_CONSENT_ID,
  status: 'approved',
  decision: 'approved',
  reason_code: 'CONSENT_APPROVED',
  consent_text_hash: 'a'.repeat(64),
  token: {
    jwt: 'eyJ...redacted',
    jti: '018f7b8c-9999-aaaa-bbbb-2b31319d6eaf',
    expires_at: '2027-05-07T00:00:00Z',
    kid: 'kid-1',
  },
  decision_envelope: {
    decision_domain: 'parental_consent',
    decision: 'approved',
    reason_code: 'CONSENT_APPROVED',
    decision_id: PARENTAL_CONSENT_ID,
    tenant_id: TENANT_ID,
    application_id: APP_ID,
    policy_id: POLICY_ID,
    policy_version: '1',
    consent_token_id: '018f7b8c-9999-aaaa-bbbb-2b31319d6eaf',
    expires_at: '2027-05-07T00:00:00Z',
    assurance_level: 'AAL-C1',
    content_included: false,
    pii_included: false,
  },
};

const REVOKE_RESPONSE_OK = {
  parental_consent_id: PARENTAL_CONSENT_ID,
  revoked_at: '2026-05-07T18:00:00Z',
  reason_code: 'CONSENT_REVOKED',
  decision_envelope: {
    decision_domain: 'parental_consent',
    decision: 'revoked',
    reason_code: 'CONSENT_REVOKED',
    decision_id: PARENTAL_CONSENT_ID,
    tenant_id: TENANT_ID,
    application_id: APP_ID,
    expires_at: '2026-05-07T18:00:00Z',
    content_included: false,
    pii_included: false,
  },
};

const TOKEN_VERIFY_RESPONSE_OK = {
  valid: true,
  revoked: false,
  reason_code: 'CONSENT_APPROVED',
  claims: {
    iss: 'https://staging.agekey.com.br',
    aud: 'demo-app',
    jti: '018f7b8c-9999-aaaa-bbbb-2b31319d6eaf',
    iat: 1780000000,
    nbf: 1780000000,
    exp: 1780003600,
    agekey: {
      decision: 'approved',
      decision_domain: 'parental_consent',
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
};

describe('Parental Consent — Privacy Guard sobre respostas públicas', () => {
  it('SessionCreateResponse limpa passa no perfil public_api_response', () => {
    expect(isPayloadSafe(SESSION_RESPONSE_OK, 'public_api_response')).toBe(true);
    expect(() =>
      assertPayloadSafe(SESSION_RESPONSE_OK, 'public_api_response'),
    ).not.toThrow();
  });

  it('GuardianStartResponse limpa passa no perfil public_api_response', () => {
    expect(isPayloadSafe(GUARDIAN_START_RESPONSE_OK, 'public_api_response')).toBe(
      true,
    );
  });

  it('ConfirmResponse limpa passa no perfil public_api_response', () => {
    expect(isPayloadSafe(CONFIRM_RESPONSE_OK, 'public_api_response')).toBe(true);
  });

  it('RevokeResponse limpa passa no perfil public_api_response', () => {
    expect(isPayloadSafe(REVOKE_RESPONSE_OK, 'public_api_response')).toBe(true);
  });

  it('TokenVerifyResponse limpa passa no perfil public_api_response', () => {
    expect(isPayloadSafe(TOKEN_VERIFY_RESPONSE_OK, 'public_api_response')).toBe(
      true,
    );
  });

  it('rejeita guardian_email injetado em qualquer profundidade da Session', () => {
    const malicious = {
      ...SESSION_RESPONSE_OK,
      guardian_email: 'leak@example.com',
    };
    expect(() =>
      assertPayloadSafe(malicious, 'public_api_response'),
    ).toThrowError(PrivacyGuardForbiddenClaimError);
  });

  it('rejeita raw email injetado dentro de consent_text', () => {
    const malicious = {
      ...SESSION_RESPONSE_OK,
      consent_text: {
        ...SESSION_RESPONSE_OK.consent_text,
        email: 'r@example.com',
      },
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
  });

  it('rejeita phone injetado dentro do envelope', () => {
    const malicious = {
      ...REVOKE_RESPONSE_OK,
      decision_envelope: {
        ...REVOKE_RESPONSE_OK.decision_envelope,
        phone: '+5511999991234',
      },
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
  });

  it('rejeita document/cpf injetado em ConfirmResponse', () => {
    const malicious = { ...CONFIRM_RESPONSE_OK, document: '123.456.789-00' };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
    const malicious2 = { ...CONFIRM_RESPONSE_OK, cpf: '12345678900' };
    expect(isPayloadSafe(malicious2, 'public_api_response')).toBe(false);
  });

  it('rejeita birthdate / dob / exact_age', () => {
    for (const key of ['birthdate', 'date_of_birth', 'dob', 'exact_age']) {
      const malicious = { ...SESSION_RESPONSE_OK, [key]: '2010-01-01' };
      expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
    }
  });

  it('rejeita name / full_name / first_name / last_name', () => {
    for (const key of ['name', 'full_name', 'first_name', 'last_name']) {
      const malicious = { ...SESSION_RESPONSE_OK, [key]: 'Joana' };
      expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
    }
  });

  it('rejeita conteúdo bruto (raw_text, message_body) em qualquer resposta', () => {
    for (const key of ['raw_text', 'message', 'message_body', 'image']) {
      const malicious = {
        ...TOKEN_VERIFY_RESPONSE_OK,
        claims: { ...TOKEN_VERIFY_RESPONSE_OK.claims, [key]: 'leak' },
      };
      expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
    }
  });

  it('contact_masked é texto sem chave PII reservada — passa', () => {
    expect(
      isPayloadSafe(
        { ...GUARDIAN_START_RESPONSE_OK, contact_masked: 'r***@example.com' },
        'public_api_response',
      ),
    ).toBe(true);
  });

  it('payload com contact_ciphertext é rejeitado em public_api_response (chave reservada do guardião)', () => {
    // contact_ciphertext NÃO está na lista canônica como proibido por nome,
    // porém o nome do campo guardian_email é. Garantir que mesmo um sub-objeto
    // contendo "guardian_email" como chave seja bloqueado.
    const malicious = {
      ...GUARDIAN_START_RESPONSE_OK,
      _internal: { guardian_email: 'leak@example.com' },
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
  });

  it('age_threshold é exceção controlada — passa em public_api_response', () => {
    const ok = {
      ...SESSION_RESPONSE_OK,
      policy: { ...SESSION_RESPONSE_OK.policy, age_threshold: 13 },
    };
    expect(isPayloadSafe(ok, 'public_api_response')).toBe(true);
  });
});
