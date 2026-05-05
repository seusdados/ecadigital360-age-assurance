import { describe, expect, it } from 'vitest';
import {
  SafetyEventIngestRequestSchema,
  SafetyGetDecisionRequestSchema,
} from '../src/schemas/safety.ts';
import {
  isPayloadSafe,
  findPrivacyViolations,
} from '../src/privacy/index.ts';

const VALID_BODY = {
  event_type: 'message_sent',
  actor_subject_ref_hmac: 'a'.repeat(64),
  counterparty_subject_ref_hmac: 'b'.repeat(64),
  actor_age_state: 'unknown',
  counterparty_age_state: 'minor',
  metadata: { channel: 'private', length: 42, has_external_url: false },
};

describe('Safety event schemas', () => {
  it('aceita body válido', () => {
    const parsed = SafetyEventIngestRequestSchema.parse(VALID_BODY);
    expect(parsed.event_type).toBe('message_sent');
  });

  it('rejeita campo extra (strict)', () => {
    expect(() =>
      SafetyEventIngestRequestSchema.parse({
        ...VALID_BODY,
        leak_email: 'leak@example.com',
      }),
    ).toThrow();
  });

  it('aceita getDecision body válido', () => {
    const parsed = SafetyGetDecisionRequestSchema.parse({
      event_type: 'message_sent',
      actor_subject_ref_hmac: 'a'.repeat(64),
      counterparty_subject_ref_hmac: 'b'.repeat(64),
      actor_age_state: 'adult',
      counterparty_age_state: 'minor',
    });
    expect(parsed.event_type).toBe('message_sent');
  });
});

describe('Safety privacy guard — perfil safety_event_v1', () => {
  it('rejeita message no body', () => {
    const violations = findPrivacyViolations(
      { ...VALID_BODY, metadata: { message: 'oi' } },
      'safety_event_v1',
    );
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.reason === 'content')).toBe(true);
  });

  it('rejeita raw_text', () => {
    expect(
      isPayloadSafe(
        { ...VALID_BODY, metadata: { raw_text: 'hello' } },
        'safety_event_v1',
      ),
    ).toBe(false);
  });

  it('rejeita image/video/audio em metadata', () => {
    for (const k of ['image', 'video', 'audio'] as const) {
      const obj = { ...VALID_BODY, metadata: { [k]: 'binary' } };
      expect(isPayloadSafe(obj, 'safety_event_v1')).toBe(false);
    }
  });

  it('rejeita birthdate/date_of_birth', () => {
    expect(
      isPayloadSafe(
        { ...VALID_BODY, metadata: { birthdate: '2010-01-01' } },
        'safety_event_v1',
      ),
    ).toBe(false);
    expect(
      isPayloadSafe(
        { ...VALID_BODY, metadata: { date_of_birth: '2010-01-01' } },
        'safety_event_v1',
      ),
    ).toBe(false);
  });

  it('aceita metadata sem PII e sem conteúdo', () => {
    expect(isPayloadSafe(VALID_BODY, 'safety_event_v1')).toBe(true);
  });

  it('age_band/subject_age_state declarados pela política são aceitos', () => {
    const obj = {
      ...VALID_BODY,
      metadata: {
        actor_age_band: 'over_18',
        counterparty_age_band: 'over_13',
        subject_age_state: 'minor',
      },
    };
    expect(isPayloadSafe(obj, 'safety_event_v1')).toBe(true);
  });
});
