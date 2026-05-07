// Deno tests for the Safety adapter `_shared/safety-envelope.ts`.
// Mirrors the consent-envelope test suite: pure builder coverage with no
// Supabase or HTTP dependencies.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildSafetyDecisionEnvelope,
  computeSafetyEnvelopePayloadHash,
  deriveRelationship,
  safetyDecisionToWebhookEventType,
  safetyEnvelopeAuditDiff,
  safetyEnvelopeWebhookPayload,
  SYSTEM_SAFETY_RULES,
} from '../_shared/safety-envelope.ts';
import { WebhookSafetyEventSchema } from '../../../packages/shared/src/webhooks/webhook-types.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';

const HMAC_A = 'a'.repeat(64);
const HMAC_B = 'b'.repeat(64);

const baseInput = {
  tenant_id: '018f7b8c-1111-7777-9999-2b31319d6ea1',
  application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
  safety_event_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
  safety_alert_id: null,
  interaction_id: null,
  verification_session_id: null,
  consent_request_id: null,
  event_type: 'message_send_attempt' as const,
  channel_type: 'direct_message' as const,
  actor_age_state: 'unknown' as const,
  counterparty_age_state: 'minor_13_to_17' as const,
  actor_ref_hmac: HMAC_A,
  counterparty_ref_hmac: HMAC_B,
  rules: SYSTEM_SAFETY_RULES,
  context: {
    event_type: 'message_send_attempt',
    channel_type: 'direct_message',
    relationship_type: 'unknown_to_minor',
    actor_age_state: 'unknown',
    counterparty_age_state: 'minor_13_to_17',
    aggregate_24h_count: 1,
    aggregate_7d_count: 1,
    aggregate_30d_count: 1,
    aggregate_actor_reports_7d: 0,
    aggregate_link_attempts_24h: 0,
    aggregate_media_to_minor_24h: 0,
    consent_status: 'absent' as const,
    verification_assurance_level: null,
  },
  now_seconds: 1_700_000_000,
};

Deno.test('Safety: unknown→minor private message routes to step_up_required', () => {
  const env = buildSafetyDecisionEnvelope(baseInput);
  assertEquals(env.decision, 'step_up_required');
  assertEquals(env.step_up_required, true);
  assert(env.reason_codes.includes(REASON_CODES.SAFETY_STEP_UP_REQUIRED));
});

Deno.test('Safety: deriveRelationship adult→minor', () => {
  assertEquals(deriveRelationship('adult', 'minor_13_to_17'), 'adult_to_minor');
});

Deno.test('Safety: webhook payload satisfies the canonical schema', async () => {
  const env = buildSafetyDecisionEnvelope(baseInput);
  const hash = await computeSafetyEnvelopePayloadHash(env);
  const payload = safetyEnvelopeWebhookPayload({
    event_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
    event_type: safetyDecisionToWebhookEventType(env.decision),
    envelope: env,
    payload_hash: hash,
  });
  WebhookSafetyEventSchema.parse(payload);
});

Deno.test('Safety: audit diff omits actor_ref_hmac', () => {
  const env = buildSafetyDecisionEnvelope(baseInput);
  const diff = safetyEnvelopeAuditDiff(env, 'f'.repeat(64));
  assertEquals((diff as Record<string, unknown>).actor_ref_hmac, undefined);
  assertEquals(diff.decision, env.decision);
});

Deno.test('Safety: payload hash deterministic hex', async () => {
  const env = buildSafetyDecisionEnvelope(baseInput);
  const a = await computeSafetyEnvelopePayloadHash(env);
  const b = await computeSafetyEnvelopePayloadHash({ ...env });
  assert(/^[0-9a-f]{64}$/.test(a));
  assertEquals(a, b);
});
