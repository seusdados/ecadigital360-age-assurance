import { describe, expect, it } from 'vitest';
import {
  CORE_FORBIDDEN_KEYS,
  CONTENT_FORBIDDEN_KEYS,
  ALLOWED_AGE_POLICY_KEYS,
  PRIVACY_GUARD_FORBIDDEN_CLAIM_ERROR,
  PrivacyGuardForbiddenClaimError,
  assertPayloadSafe,
  findPrivacyViolations,
  isPayloadSafe,
  type PrivacyGuardProfile,
} from '../src/privacy/index.ts';

const PUBLIC_PROFILES: PrivacyGuardProfile[] = [
  'public_token',
  'webhook',
  'sdk_response',
  'widget_response',
  'public_api_response',
  'admin_minimized_view',
  'audit_internal',
  'safety_event_v1',
];

describe('Privacy Guard — núcleo proibido em profundidade', () => {
  for (const key of CORE_FORBIDDEN_KEYS) {
    it(`bloqueia "${key}" em qualquer perfil público`, () => {
      const payload = { foo: { bar: { [key]: 'value' } } };
      for (const profile of PUBLIC_PROFILES) {
        const violations = findPrivacyViolations(payload, profile);
        // guardian_email/_phone/_name aparecem em CORE mas existem perfis
        // que toleram (guardian_contact_internal). Para PUBLIC_PROFILES,
        // o esperado é bloquear sempre.
        expect(
          violations.length,
          `profile=${profile} key=${key}`,
        ).toBeGreaterThan(0);
      }
    });
  }
});

describe('Privacy Guard — conteúdo bruto em Safety v1', () => {
  for (const key of CONTENT_FORBIDDEN_KEYS) {
    it(`bloqueia "${key}" no perfil safety_event_v1`, () => {
      const payload = { event_type: 'message_sent', body: { [key]: 'x' } };
      const violations = findPrivacyViolations(payload, 'safety_event_v1');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.reason === 'content')).toBe(true);
    });
  }
});

describe('Privacy Guard — exceções controladas', () => {
  for (const key of ALLOWED_AGE_POLICY_KEYS) {
    it(`permite "${key}" em payload público (regra da política)`, () => {
      const payload = {
        agekey: { [key]: 18 },
      };
      expect(isPayloadSafe(payload, 'public_token')).toBe(true);
      expect(isPayloadSafe(payload, 'webhook')).toBe(true);
      expect(isPayloadSafe(payload, 'public_api_response')).toBe(true);
    });
  }

  it('bloqueia "age" mesmo sendo similar a regra de política', () => {
    const payload = { agekey: { age: 19 } };
    expect(isPayloadSafe(payload, 'public_token')).toBe(false);
  });

  it('bloqueia "exact_age" sempre', () => {
    const payload = { exact_age: 17 };
    expect(isPayloadSafe(payload, 'webhook')).toBe(false);
  });
});

describe('Privacy Guard — perfil guardian_contact_internal', () => {
  it('tolera guardian_email/phone/name nesse perfil único', () => {
    const payload = {
      guardian_email: 'r@example.com',
      guardian_phone: '+5511999999999',
      guardian_name: 'Maria',
    };
    expect(isPayloadSafe(payload, 'guardian_contact_internal')).toBe(true);
  });

  it('bloqueia esses mesmos campos em perfis públicos', () => {
    const payload = { guardian_email: 'r@example.com' };
    expect(isPayloadSafe(payload, 'webhook')).toBe(false);
    expect(isPayloadSafe(payload, 'public_token')).toBe(false);
  });

  it('continua bloqueando conteúdo bruto mesmo em guardian_contact_internal', () => {
    const payload = { guardian_email: 'r@x', message: 'oi' };
    expect(isPayloadSafe(payload, 'guardian_contact_internal')).toBe(false);
  });
});

describe('Privacy Guard — assert lança com reasonCode canônico', () => {
  it('assertPayloadSafe lança PrivacyGuardForbiddenClaimError com reasonCode', () => {
    const payload = { user: { cpf: '00000000000' } };
    expect(() => assertPayloadSafe(payload, 'public_token')).toThrow(
      PrivacyGuardForbiddenClaimError,
    );
    try {
      assertPayloadSafe(payload, 'public_token');
    } catch (err) {
      expect(err).toBeInstanceOf(PrivacyGuardForbiddenClaimError);
      const e = err as PrivacyGuardForbiddenClaimError;
      expect(e.reasonCode).toBe(PRIVACY_GUARD_FORBIDDEN_CLAIM_ERROR);
      expect(e.reasonCode).toBe('AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM');
      expect(e.violations.length).toBeGreaterThan(0);
      expect(e.violations[0]?.path).toContain('cpf');
    }
  });
});

describe('Privacy Guard — case-insensitive e separadores', () => {
  it('normaliza variações de caixa e hífen/underscore', () => {
    expect(isPayloadSafe({ CPF: '0' }, 'webhook')).toBe(false);
    expect(isPayloadSafe({ 'date-of-birth': '2010-01-01' }, 'webhook')).toBe(false);
    expect(isPayloadSafe({ Date_Of_Birth: '2010-01-01' }, 'webhook')).toBe(false);
  });
});
