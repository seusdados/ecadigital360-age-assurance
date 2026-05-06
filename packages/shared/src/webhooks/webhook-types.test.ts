import { describe, expect, it } from 'vitest';
import {
  RESERVED_WEBHOOK_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
  WebhookEventPayloadSchema,
  WebhookVerificationEventSchema,
  isLiveWebhookEventType,
  isReservedWebhookEventType,
} from './webhook-types.ts';

const SAMPLE_VERIFICATION = {
  event_id: '018f7b8c-1111-7777-9999-2b31319d6eaf',
  event_type: WEBHOOK_EVENT_TYPES.VERIFICATION_APPROVED,
  tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
  session_id: '018f7b8c-aaaa-1111-2222-2b31319d6eaf',
  application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
  decision: 'approved' as const,
  reason_code: 'THRESHOLD_SATISFIED',
  method: 'gateway' as const,
  assurance_level: 'substantial' as const,
  threshold_satisfied: true,
  jti: '018f7b8c-3333-4444-5555-2b31319d6eaf',
  created_at: '2026-01-01T12:34:56.000Z',
};

describe('webhook event taxonomy', () => {
  it('parses a verification.approved payload', () => {
    expect(() => WebhookVerificationEventSchema.parse(SAMPLE_VERIFICATION))
      .not.toThrow();
    expect(() => WebhookEventPayloadSchema.parse(SAMPLE_VERIFICATION))
      .not.toThrow();
  });

  it('rejects unknown event types via the discriminator', () => {
    const result = WebhookEventPayloadSchema.safeParse({
      ...SAMPLE_VERIFICATION,
      event_type: 'verification.unknown',
    });
    expect(result.success).toBe(false);
  });

  it('parses a token.revoked payload', () => {
    const payload = {
      event_id: '018f7b8c-9999-0000-aaaa-2b31319d6eaf',
      event_type: WEBHOOK_EVENT_TYPES.TOKEN_REVOKED,
      tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
      application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
      jti: '018f7b8c-3333-4444-5555-2b31319d6eaf',
      reason: 'compromise_detected',
      revoked_at: '2026-01-02T00:00:00.000Z',
    };
    expect(() => WebhookEventPayloadSchema.parse(payload)).not.toThrow();
  });

  it('separates live and reserved event types', () => {
    for (const value of Object.values(WEBHOOK_EVENT_TYPES)) {
      expect(isLiveWebhookEventType(value)).toBe(true);
      expect(isReservedWebhookEventType(value)).toBe(false);
    }
    for (const value of Object.values(RESERVED_WEBHOOK_EVENT_TYPES)) {
      expect(isReservedWebhookEventType(value)).toBe(true);
      expect(isLiveWebhookEventType(value)).toBe(false);
    }
  });
});
