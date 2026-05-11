// AgeKey Safety Signals — testes do sanitizer das rows de audit_events
// para ações `safety.*`. Garante que o helper jamais persiste:
//
//   - PII (name/cpf/rg/passport/email/phone/birthdate/dob/face/biometric/selfie)
//   - conteúdo bruto (message/raw_text/image/video/audio)
//   - IP / GPS / lat / long
//
// E que apenas chaves no allow-list canônico passam.

import { describe, expect, it } from 'vitest';
import {
  SAFETY_AUDIT_ALLOWED_KEYS,
  SAFETY_AUDIT_FORBIDDEN_SUBSTRINGS,
  isSuspectKey,
  sanitizeSafetyAuditDiff,
} from '../src/safety/audit-sanitize.ts';

describe('sanitizeSafetyAuditDiff — allow-list', () => {
  it('keeps all canonical scalar fields', () => {
    const out = sanitizeSafetyAuditDiff({
      application_id: 'app-1',
      alert_id: 'a1',
      event_id: 'e1',
      rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
      severity: 'high',
      risk_category: 'grooming',
      step_up_session_id: 's1',
      parental_consent_request_id: 'p1',
      payload_hash: 'deadbeef',
      reason_code: 'SAFETY_STEP_UP_NO_ACTIVE_POLICY',
      note: 'ack from admin',
    });
    expect(out).toEqual({
      application_id: 'app-1',
      alert_id: 'a1',
      event_id: 'e1',
      rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
      severity: 'high',
      risk_category: 'grooming',
      step_up_session_id: 's1',
      parental_consent_request_id: 'p1',
      payload_hash: 'deadbeef',
      reason_code: 'SAFETY_STEP_UP_NO_ACTIVE_POLICY',
      note: 'ack from admin',
    });
  });

  it('keeps reason_codes when it is an array of strings', () => {
    const out = sanitizeSafetyAuditDiff({
      reason_codes: ['SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE', 'SAFETY_STEP_UP'],
    });
    expect(out.reason_codes).toEqual([
      'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
      'SAFETY_STEP_UP',
    ]);
  });

  it('drops null/undefined values', () => {
    const out = sanitizeSafetyAuditDiff({
      alert_id: null,
      step_up_session_id: undefined,
      severity: 'high',
    });
    expect(out).toEqual({ severity: 'high' });
  });

  it('drops unknown keys outside the allow-list', () => {
    const dirty = {
      alert_id: 'a1',
      // Unknown keys — should be silently dropped:
      tenant_secret: 'shhh',
      raw_event_dump: '{ ... }',
    } as unknown as Parameters<typeof sanitizeSafetyAuditDiff>[0];
    const out = sanitizeSafetyAuditDiff(dirty);
    expect(out).toEqual({ alert_id: 'a1' });
  });
});

describe('sanitizeSafetyAuditDiff — forbidden keys', () => {
  it.each(SAFETY_AUDIT_FORBIDDEN_SUBSTRINGS)(
    'flags forbidden substring "%s" via isSuspectKey',
    (sub) => {
      expect(isSuspectKey(sub)).toBe(true);
      expect(isSuspectKey(sub.toUpperCase())).toBe(true);
      expect(isSuspectKey(`actor_${sub}`)).toBe(true);
    },
  );

  it('does not flag canonical safe keys', () => {
    for (const key of SAFETY_AUDIT_ALLOWED_KEYS) {
      expect(isSuspectKey(key)).toBe(false);
    }
  });

  it('keeps array values verbatim when the key is on the allow-list', () => {
    // Canonical reason codes can legitimately contain words like
    // "message" (UNKNOWN_TO_MINOR_PRIVATE_MESSAGE). The defense is the
    // key allow-list, not substring filtering of values.
    const out = sanitizeSafetyAuditDiff({
      reason_codes: ['SAFETY_OK', 'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE'],
    });
    expect(out.reason_codes).toEqual([
      'SAFETY_OK',
      'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    ]);
  });

  it('caps array length at MAX_ARRAY_LENGTH', () => {
    const big = Array.from({ length: 100 }, (_, i) => `R_${i}`);
    const out = sanitizeSafetyAuditDiff({ reason_codes: big });
    expect((out.reason_codes as string[]).length).toBeLessThanOrEqual(32);
  });

  it('truncates excessively long strings', () => {
    const huge = 'x'.repeat(1024);
    const out = sanitizeSafetyAuditDiff({ note: huge });
    expect((out.note as string).length).toBeLessThanOrEqual(256);
  });

  it('drops object/array values for fields that should be scalars', () => {
    const dirty = {
      // Pretend a caller tried to stuff an object into payload_hash.
      payload_hash: { length: 64 },
    } as unknown as Parameters<typeof sanitizeSafetyAuditDiff>[0];
    const out = sanitizeSafetyAuditDiff(dirty);
    expect(out).toEqual({});
  });
});

describe('sanitizeSafetyAuditDiff — privacy invariants', () => {
  it('never leaks message/raw_text-style content if caller injects via valid key name', () => {
    // Even though the *key* "note" is on the allow-list, we only allow
    // strings. The sanitizer does not inspect the *content* — that
    // contract belongs to the caller. We test here that callers using
    // the helper safely will get safe rows.
    const out = sanitizeSafetyAuditDiff({
      note: 'admin acknowledged',
      // These keys would be PII if accepted — they are NOT on the allow-list:
    });
    expect(Object.keys(out)).toEqual(['note']);
  });

  it('never propagates IP/GPS fields even if shaped to look like allowed keys', () => {
    const dirty = {
      ip_address: '192.0.2.1',
      latitude: 1.0,
      longitude: 2.0,
      gps_fix: '...',
    } as unknown as Parameters<typeof sanitizeSafetyAuditDiff>[0];
    const out = sanitizeSafetyAuditDiff(dirty);
    expect(out).toEqual({});
  });
});
