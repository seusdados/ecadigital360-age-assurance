import { describe, expect, it } from 'vitest';
import {
  WebhookDeliverySchema,
  WebhookDeliveriesListRequestSchema,
  WebhookEndpointWriteRequestSchema,
  WebhookRotateSecretResponseSchema,
  isInternalHost,
  validateWebhookUrl,
} from './webhooks.ts';

const VALID_UUID = '00000000-0000-7000-8000-000000000001';
const VALID_UUID_2 = '00000000-0000-7000-8000-000000000002';

describe('isInternalHost (anti-SSRF)', () => {
  it('flags loopback IPv4 ranges', () => {
    expect(isInternalHost('127.0.0.1')).toBe(true);
    expect(isInternalHost('127.255.255.254')).toBe(true);
  });

  it('flags private RFC1918 ranges', () => {
    expect(isInternalHost('10.0.0.1')).toBe(true);
    expect(isInternalHost('10.255.255.255')).toBe(true);
    expect(isInternalHost('192.168.1.1')).toBe(true);
    expect(isInternalHost('172.16.0.1')).toBe(true);
    expect(isInternalHost('172.31.255.255')).toBe(true);
  });

  it('flags link-local AWS metadata range', () => {
    expect(isInternalHost('169.254.169.254')).toBe(true);
  });

  it('flags loopback hostnames and reserved suffixes', () => {
    expect(isInternalHost('localhost')).toBe(true);
    expect(isInternalHost('foo.local')).toBe(true);
    expect(isInternalHost('svc.internal')).toBe(true);
    expect(isInternalHost('foo.localhost')).toBe(true);
  });

  it('flags IPv6 loopback / link-local / ULA', () => {
    expect(isInternalHost('::1')).toBe(true);
    expect(isInternalHost('[::1]')).toBe(true);
    expect(isInternalHost('fe80::1')).toBe(true);
    expect(isInternalHost('fc00::1')).toBe(true);
    expect(isInternalHost('fd12:3456:789a::1')).toBe(true);
  });

  it('flags IPv4-mapped IPv6 to private targets', () => {
    expect(isInternalHost('::ffff:127.0.0.1')).toBe(true);
    expect(isInternalHost('::ffff:10.0.0.1')).toBe(true);
  });

  it('passes legitimate public hostnames', () => {
    expect(isInternalHost('api.example.com')).toBe(false);
    expect(isInternalHost('webhook.cliente.com.br')).toBe(false);
    expect(isInternalHost('hooks.slack.com')).toBe(false);
    expect(isInternalHost('1.1.1.1')).toBe(false);
    expect(isInternalHost('8.8.8.8')).toBe(false);
  });

  it('rejects 172.32 (outside the /12 private block) but accepts public', () => {
    expect(isInternalHost('172.15.0.1')).toBe(false);
    expect(isInternalHost('172.32.0.1')).toBe(false);
  });
});

describe('validateWebhookUrl', () => {
  it('accepts https URLs to public hosts', () => {
    expect(validateWebhookUrl('https://api.cliente.com/webhooks/agekey')).toBeNull();
    expect(validateWebhookUrl('https://hooks.slack.com/services/xyz')).toBeNull();
  });

  it('rejects http scheme', () => {
    expect(validateWebhookUrl('http://api.cliente.com/hook')).toBe('invalid_scheme');
    expect(validateWebhookUrl('ftp://files.cliente.com/hook')).toBe('invalid_scheme');
  });

  it('rejects internal/private hosts even when https', () => {
    expect(validateWebhookUrl('https://10.0.0.1/hook')).toBe('internal_host');
    expect(validateWebhookUrl('https://169.254.169.254/latest/meta-data')).toBe(
      'internal_host',
    );
    expect(validateWebhookUrl('https://localhost/hook')).toBe('internal_host');
    expect(validateWebhookUrl('https://[::1]/hook')).toBe('internal_host');
  });

  it('rejects malformed URLs', () => {
    expect(validateWebhookUrl('not-a-url')).toBe('invalid_url');
    expect(validateWebhookUrl('')).toBe('invalid_url');
  });
});

describe('WebhookEndpointWriteRequestSchema', () => {
  const baseValid = {
    application_id: VALID_UUID,
    name: 'Backend principal',
    url: 'https://api.cliente.com/webhooks/agekey',
    event_types: ['verification.completed'] as const,
  };

  it('accepts a valid create payload', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse(baseValid);
    expect(parsed.success).toBe(true);
  });

  it('rejects http URLs', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse({
      ...baseValid,
      url: 'http://api.cliente.com/webhooks/agekey',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects URLs pointing to internal IPs', () => {
    for (const url of [
      'https://10.0.0.5/hook',
      'https://192.168.1.1/hook',
      'https://169.254.169.254/meta',
      'https://127.0.0.1/hook',
      'https://localhost/hook',
    ]) {
      const parsed = WebhookEndpointWriteRequestSchema.safeParse({
        ...baseValid,
        url,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects empty event_types', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse({
      ...baseValid,
      event_types: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects duplicated event_types', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse({
      ...baseValid,
      event_types: ['verification.completed', 'verification.completed'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown event_types', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse({
      ...baseValid,
      event_types: ['verification.completed', 'mystery.event'],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts update payload with id', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse({
      ...baseValid,
      id: VALID_UUID_2,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects extra unknown fields (strict)', () => {
    const parsed = WebhookEndpointWriteRequestSchema.safeParse({
      ...baseValid,
      // @ts-expect-error — testing runtime strictness
      foo: 'bar',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('WebhookRotateSecretResponseSchema', () => {
  it('returns a raw secret string (reveal-once)', () => {
    const parsed = WebhookRotateSecretResponseSchema.safeParse({
      id: VALID_UUID,
      raw_secret: 'whsec_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_',
      rotated_at: '2026-05-01T12:00:00.000Z',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.raw_secret).toMatch(/^whsec_/);
    }
  });

  it('rejects rotation response without raw secret', () => {
    const parsed = WebhookRotateSecretResponseSchema.safeParse({
      id: VALID_UUID,
      rotated_at: '2026-05-01T12:00:00.000Z',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('WebhookDeliverySchema', () => {
  const sample = {
    id: VALID_UUID,
    endpoint_id: VALID_UUID_2,
    tenant_id: VALID_UUID,
    event_type: 'verification.completed',
    payload_json: { hello: 'world' },
    idempotency_key: VALID_UUID_2,
    status: 'dead_letter',
    attempts: 6,
    next_attempt_at: '2026-05-01T12:00:00.000Z',
    last_response_code: 500,
    last_error: 'http_500',
    created_at: '2026-05-01T11:00:00.000Z',
    updated_at: '2026-05-01T11:30:00.000Z',
  };

  it('accepts dead_letter delivery', () => {
    const parsed = WebhookDeliverySchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it('accepts delivered with null last_error', () => {
    const parsed = WebhookDeliverySchema.safeParse({
      ...sample,
      status: 'delivered',
      last_response_code: 200,
      last_error: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown status', () => {
    const parsed = WebhookDeliverySchema.safeParse({
      ...sample,
      status: 'mystery',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('WebhookDeliveriesListRequestSchema', () => {
  it('applies default limit when omitted', () => {
    const parsed = WebhookDeliveriesListRequestSchema.safeParse({
      endpoint_id: VALID_UUID,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(50);
    }
  });

  it('rejects limit > 100', () => {
    const parsed = WebhookDeliveriesListRequestSchema.safeParse({
      endpoint_id: VALID_UUID,
      limit: 999,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts dead_letter status filter', () => {
    const parsed = WebhookDeliveriesListRequestSchema.safeParse({
      endpoint_id: VALID_UUID,
      status: 'dead_letter',
    });
    expect(parsed.success).toBe(true);
  });
});
