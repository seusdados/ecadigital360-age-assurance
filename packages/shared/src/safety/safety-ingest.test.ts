import { describe, expect, it } from 'vitest';
import {
  SafetyEventIngestRequestSchema,
  SafetyEventIngestResponseSchema,
  rejectForbiddenIngestKeys,
} from './safety-ingest.ts';
import { REASON_CODES } from '../reason-codes.ts';

const baseValid = {
  application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
  event_type: 'message_send_attempt',
  occurred_at: '2026-05-07T11:00:00.000Z',
  actor_external_ref: 'opaque-actor-123456',
  counterparty_external_ref: 'opaque-cp-7890ab',
  actor_age_state: 'adult',
  counterparty_age_state: 'minor_13_to_17',
  channel_type: 'direct_message',
  content_processed: false as const,
  content_stored: false as const,
};

describe('Safety ingest schema', () => {
  it('accepts a minimal metadata-only payload', () => {
    const r = SafetyEventIngestRequestSchema.safeParse(baseValid);
    expect(r.success).toBe(true);
  });

  it('rejects raw text/message/body keys at top level', () => {
    for (const key of [
      'message',
      'raw_text',
      'text',
      'body',
      'content',
      'image',
      'video',
      'audio',
      'attachment',
    ]) {
      const result = rejectForbiddenIngestKeys({
        ...baseValid,
        [key]: 'something',
      });
      expect(result?.reasonCode).toBe(REASON_CODES.SAFETY_RAW_CONTENT_REJECTED);
    }
  });

  it('rejects PII keys at any depth', () => {
    const cases = [
      { ...baseValid, email: 'a@b' },
      { ...baseValid, cpf: '00000000000' },
      { ...baseValid, birthdate: '2014-01-01' },
      { ...baseValid, exact_age: 12 },
      { ...baseValid, latitude: -23.5 },
      { ...baseValid, longitude: -46.6 },
      { ...baseValid, metadata: { phone: '+5511...' } },
    ];
    for (const c of cases) {
      const result = rejectForbiddenIngestKeys(c);
      expect(result?.reasonCode).toBe(REASON_CODES.SAFETY_PII_DETECTED);
    }
  });

  it('rejects content_processed=true via the literal schema', () => {
    const r = SafetyEventIngestRequestSchema.safeParse({
      ...baseValid,
      content_processed: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects content_stored=true via the literal schema', () => {
    const r = SafetyEventIngestRequestSchema.safeParse({
      ...baseValid,
      content_stored: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown event_type values', () => {
    const r = SafetyEventIngestRequestSchema.safeParse({
      ...baseValid,
      event_type: 'message_received', // not in catalogue
    });
    expect(r.success).toBe(false);
  });

  it('caps metadata key count and key length', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 20; i++) big[`k${i}`] = 'v';
    const r = SafetyEventIngestRequestSchema.safeParse({
      ...baseValid,
      metadata: big,
    });
    expect(r.success).toBe(false);
  });

  it('response schema rejects pii_included=true', () => {
    const body = {
      decision: 'approved' as const,
      severity: 'low' as const,
      risk_category: 'unknown',
      reason_codes: ['SAFETY_OK'],
      safety_event_id: null,
      safety_alert_id: null,
      step_up_required: false,
      parental_consent_required: false,
      actions: [],
      ttl_seconds: null,
      pii_included: true,
      content_included: false,
    };
    const r = SafetyEventIngestResponseSchema.safeParse(body);
    expect(r.success).toBe(false);
  });
});
