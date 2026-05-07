import { describe, expect, it } from 'vitest';
import {
  WebhookPayloadSchema,
  WEBHOOK_HEADERS,
  WEBHOOK_TIMESTAMP_WINDOW_SECONDS,
  payloadHash,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../src/webhooks/index.ts';
import {
  createDecisionEnvelope,
  type AgeKeyDecisionEnvelope,
} from '../src/decision/index.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

const SECRET = 'whsec_test_0123456789abcdef';

describe('Webhook Signer — HMAC SHA-256', () => {
  it('assina e verifica com sucesso', async () => {
    const rawBody = JSON.stringify({ hello: 'world' });
    const ts = '1780000000';
    const nonce = 'abc123';
    const sig = await signWebhookPayload({
      secret: SECRET,
      rawBody,
      timestamp: ts,
      nonce,
    });
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        rawBody,
        timestamp: ts,
        nonce,
        signatureHeader: sig,
      }),
    ).toBe(true);
  });

  it('rejeita assinatura adulterada (tempo constante)', async () => {
    const rawBody = JSON.stringify({ hello: 'world' });
    const sig = await signWebhookPayload({
      secret: SECRET,
      rawBody,
      timestamp: '1780000000',
      nonce: 'abc',
    });
    const tampered = sig.slice(0, -2) + '00';
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        rawBody,
        timestamp: '1780000000',
        nonce: 'abc',
        signatureHeader: tampered,
      }),
    ).toBe(false);
  });

  it('payloadHash retorna hex SHA-256', async () => {
    const h = await payloadHash('{"a":1}');
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true);
  });

  it('headers canônicos são literais esperados', () => {
    expect(WEBHOOK_HEADERS.SIGNATURE).toBe('X-AgeKey-Webhook-Signature');
    expect(WEBHOOK_HEADERS.TIMESTAMP).toBe('X-AgeKey-Webhook-Timestamp');
    expect(WEBHOOK_HEADERS.NONCE).toBe('X-AgeKey-Webhook-Nonce');
    expect(WEBHOOK_TIMESTAMP_WINDOW_SECONDS).toBe(300);
  });
});

describe('Webhook Payload — passa pelo privacy guard "webhook"', () => {
  it('payload válido é seguro', async () => {
    const decision: AgeKeyDecisionEnvelope = createDecisionEnvelope({
      decision_domain: 'safety_signal',
      decision: 'step_up_required',
      reason_code: 'SAFETY_STEP_UP_REQUIRED',
      severity: 'high',
    });
    const rawBody = JSON.stringify(decision);
    const payload = {
      event_id: '018f7b8c-1111-7777-9999-2b31319d6eaf',
      event_type: 'safety.step_up_required' as const,
      created_at: new Date().toISOString(),
      tenant_id: '018f7b8c-dddd-eeee-ffff-2b31319d6eaf',
      application_id: '018f7b8c-2222-3333-4444-2b31319d6eaf',
      decision,
      severity: 'high' as const,
      content_included: false as const,
      pii_included: false as const,
      payload_hash: await payloadHash(rawBody),
    };
    const parsed = WebhookPayloadSchema.parse(payload);
    expect(parsed.event_type).toBe('safety.step_up_required');
    expect(isPayloadSafe(payload, 'webhook')).toBe(true);
  });

  it('payload com campo PII é rejeitado pelo privacy guard', async () => {
    const payload = {
      event_id: 'x',
      event_type: 'verification.approved' as const,
      created_at: new Date().toISOString(),
      tenant_id: 't',
      application_id: 'a',
      content_included: false as const,
      pii_included: false as const,
      payload_hash: 'h',
      // Inserindo email no payload
      email: 'leak@example.com',
    };
    expect(isPayloadSafe(payload, 'webhook')).toBe(false);
  });
});
