// Deno tests — anti-SSRF helper for webhook URL validation.
//
// This test exercises the pure validation surface used by webhooks-write
// and webhooks-rotate-secret. It deliberately avoids hitting the database
// — we just verify the SSRF blocklist logic.

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  isInternalHost,
  validateWebhookUrl,
  WebhookEndpointWriteRequestSchema,
} from '../../../packages/shared/src/schemas/webhooks.ts';

Deno.test('isInternalHost flags loopback / RFC1918 / link-local', () => {
  for (const host of [
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '192.168.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '169.254.169.254',
    'localhost',
    'foo.local',
    'svc.internal',
    '::1',
    '[::1]',
    'fe80::1',
    'fc00::1',
    'fd12:3456:789a::1',
    '::ffff:10.0.0.5',
  ]) {
    assert(isInternalHost(host), `expected ${host} to be flagged`);
  }
});

Deno.test('isInternalHost passes public hosts', () => {
  for (const host of [
    'api.example.com',
    'webhook.cliente.com.br',
    'hooks.slack.com',
    '1.1.1.1',
    '8.8.8.8',
    '172.32.0.1',
    '172.15.0.1',
  ]) {
    assertEquals(isInternalHost(host), false);
  }
});

Deno.test('validateWebhookUrl returns invalid_scheme for http', () => {
  assertEquals(
    validateWebhookUrl('http://api.cliente.com/hook'),
    'invalid_scheme',
  );
});

Deno.test('validateWebhookUrl returns internal_host for AWS metadata', () => {
  assertEquals(
    validateWebhookUrl('https://169.254.169.254/latest/meta-data'),
    'internal_host',
  );
});

Deno.test('validateWebhookUrl accepts public https endpoints', () => {
  assertEquals(
    validateWebhookUrl('https://api.cliente.com/webhooks/agekey'),
    null,
  );
});

Deno.test('validateWebhookUrl rejects garbage strings', () => {
  assertEquals(validateWebhookUrl('not-a-url'), 'invalid_url');
  assertEquals(validateWebhookUrl(''), 'invalid_url');
});

Deno.test('WebhookEndpointWriteRequestSchema rejects internal IPs end-to-end', () => {
  const result = WebhookEndpointWriteRequestSchema.safeParse({
    application_id: '00000000-0000-7000-8000-000000000001',
    name: 'Bad webhook',
    url: 'https://10.0.0.5/hook',
    event_types: ['verification.completed'],
  });
  assertEquals(result.success, false);
});

Deno.test('WebhookEndpointWriteRequestSchema accepts a valid create payload', () => {
  const result = WebhookEndpointWriteRequestSchema.safeParse({
    application_id: '00000000-0000-7000-8000-000000000001',
    name: 'Backend principal',
    url: 'https://api.cliente.com/webhooks/agekey',
    event_types: ['verification.completed', 'verification.expired'],
  });
  assert(result.success, 'expected schema to accept valid payload');
});
