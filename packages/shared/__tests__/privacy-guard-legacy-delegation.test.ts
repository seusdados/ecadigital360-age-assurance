import { describe, expect, it } from 'vitest';
import {
  assertPublicPayloadHasNoPii,
  findForbiddenPublicPayloadKeys,
  redactTokenForDisplay,
  FORBIDDEN_PUBLIC_KEYS,
} from '../src/privacy-guard.ts';

describe('Privacy Guard legado — delegação canônica', () => {
  it('detecta chaves originalmente proibidas (regressão zero)', () => {
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      const violations = findForbiddenPublicPayloadKeys({ [key]: 'x' });
      expect(violations.length, `key=${key}`).toBeGreaterThan(0);
    }
  });

  it('detecta chaves adicionais introduzidas pela camada canônica', () => {
    // Estas eram TOLERADAS pelo legado original e agora passam a ser
    // bloqueadas — o que é estritamente mais seguro.
    const newlyBlocked = [
      'first_name',
      'last_name',
      'civil_name',
      'biometric_template',
      'guardian_email',
      'guardian_phone',
      'ip',
      'gps',
      'latitude',
      'longitude',
      'message',
      'image',
      'video',
      'audio',
      'raw_text',
    ];
    for (const key of newlyBlocked) {
      const violations = findForbiddenPublicPayloadKeys({ [key]: 'x' });
      expect(violations.length, `key=${key}`).toBeGreaterThan(0);
    }
  });

  it('assertPublicPayloadHasNoPii lança Error com reason code canônico na mensagem', () => {
    expect(() => assertPublicPayloadHasNoPii({ cpf: '0' })).toThrow(
      /AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM/,
    );
  });

  it('assertPublicPayloadHasNoPii aceita payload legítimo', () => {
    expect(() =>
      assertPublicPayloadHasNoPii({
        agekey: {
          decision: 'approved',
          age_threshold: 18,
          policy: { slug: 'br-18-plus' },
        },
      }),
    ).not.toThrow();
  });

  it('redactTokenForDisplay preserva contrato legado', () => {
    expect(redactTokenForDisplay('short')).toBe('***');
    const long = 'header.payload.signature.with.lots.of.bytes.to.redact.now';
    const redacted = redactTokenForDisplay(long);
    expect(redacted.startsWith(long.slice(0, 12))).toBe(true);
    expect(redacted.endsWith(long.slice(-12))).toBe(true);
    expect(redacted.includes('...')).toBe(true);
  });
});
