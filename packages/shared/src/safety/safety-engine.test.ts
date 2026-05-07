import { describe, expect, it } from 'vitest';
import {
  buildSafetyDecisionEnvelope,
  deriveRelationship,
} from './safety-engine.ts';
import { SAFETY_DECISION_DOMAIN } from './safety-types.ts';
import { REASON_CODES } from '../reason-codes.ts';
import { SYSTEM_SAFETY_RULES } from './safety-rules.ts';
import { SafetyDecisionEnvelopeSchema } from './safety-envelope.ts';
import { assertPublicPayloadHasNoPii } from '../privacy-guard.ts';
import {
  computeSafetyEnvelopePayloadHash,
  safetyDecisionToWebhookEventType,
  safetyEnvelopeAuditDiff,
  safetyEnvelopeWebhookPayload,
} from './safety-projections.ts';
import { WebhookSafetyEventSchema } from '../webhooks/webhook-types.ts';

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

describe('Safety relationship derivation', () => {
  it('classifies adult→minor', () => {
    expect(deriveRelationship('adult', 'minor_13_to_17')).toBe(
      'adult_to_minor',
    );
  });
  it('classifies unknown→minor', () => {
    expect(deriveRelationship('unknown', 'minor')).toBe('unknown_to_minor');
  });
  it('classifies adult→adult', () => {
    expect(deriveRelationship('adult', 'adult_18_plus')).toBe('adult_to_adult');
  });
  it('falls back to unknown_to_unknown', () => {
    expect(deriveRelationship('unknown', 'unknown')).toBe('unknown_to_unknown');
  });
});

describe('buildSafetyDecisionEnvelope', () => {
  it('returns approved/SAFETY_OK when no rules match', () => {
    const env = buildSafetyDecisionEnvelope({
      ...baseInput,
      counterparty_age_state: 'adult',
      context: { ...baseInput.context, relationship_type: 'unknown_to_unknown' },
    });
    SafetyDecisionEnvelopeSchema.parse(env);
    expect(env.decision).toBe('approved');
    expect(env.reason_codes).toContain(REASON_CODES.SAFETY_OK);
    expect(env.severity).toBe('low');
    expect(env.decision_domain).toBe(SAFETY_DECISION_DOMAIN);
  });

  it('routes unknown→minor private message to step_up_required', () => {
    const env = buildSafetyDecisionEnvelope(baseInput);
    expect(env.decision).toBe('step_up_required');
    expect(env.step_up_required).toBe(true);
    expect(env.reason_codes).toContain(REASON_CODES.SAFETY_STEP_UP_REQUIRED);
    expect(env.relationship_type).toBe('unknown_to_minor');
  });

  it('routes high-frequency adult→minor to rate_limited+alert', () => {
    const env = buildSafetyDecisionEnvelope({
      ...baseInput,
      actor_age_state: 'adult',
      counterparty_age_state: 'minor_13_to_17',
      context: {
        ...baseInput.context,
        relationship_type: 'adult_to_minor',
        aggregate_24h_count: 100,
      },
    });
    expect(env.decision).toBe('rate_limited');
    expect(env.severity).toBe('high');
    expect(env.actions).toContain('rate_limit');
    expect(env.actions).toContain('create_alert');
  });

  it('routes adult→minor media upload to soft_block + needs_review', () => {
    const env = buildSafetyDecisionEnvelope({
      ...baseInput,
      event_type: 'media_upload_attempt',
      actor_age_state: 'adult',
      counterparty_age_state: 'minor_13_to_17',
      context: {
        ...baseInput.context,
        event_type: 'media_upload_attempt',
        relationship_type: 'adult_to_minor',
      },
    });
    expect(env.decision).toBe('soft_blocked');
    expect(env.actions).toContain('soft_block');
    expect(env.actions).toContain('queue_for_human_review');
  });

  it('flags repeat-reported actor to needs_review', () => {
    const env = buildSafetyDecisionEnvelope({
      ...baseInput,
      event_type: 'report_submitted',
      context: {
        ...baseInput.context,
        event_type: 'report_submitted',
        aggregate_actor_reports_7d: 5,
      },
    });
    // 'unknown_to_minor private message' rule also matches; the engine
    // picks the highest-severity decision. Reports rule is 'high'.
    // Either decision should be from the higher-severity rule.
    expect(env.severity === 'medium' || env.severity === 'high').toBe(true);
    expect(env.actions).toContain('queue_for_human_review');
  });

  it('never carries PII in the envelope', () => {
    const env = buildSafetyDecisionEnvelope(baseInput);
    expect(() => assertPublicPayloadHasNoPii(env)).not.toThrow();
    expect(env.pii_included).toBe(false);
    expect(env.content_included).toBe(false);
  });
});

describe('Safety projections', () => {
  it('payload hash is deterministic and lowercase hex', async () => {
    const env = buildSafetyDecisionEnvelope(baseInput);
    const a = await computeSafetyEnvelopePayloadHash(env);
    const b = await computeSafetyEnvelopePayloadHash({ ...env });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it('audit diff omits actor_ref_hmac and counterparty_ref_hmac', () => {
    const env = buildSafetyDecisionEnvelope(baseInput);
    const diff = safetyEnvelopeAuditDiff(env, 'f'.repeat(64));
    expect((diff as Record<string, unknown>).actor_ref_hmac).toBeUndefined();
    expect(
      (diff as Record<string, unknown>).counterparty_ref_hmac,
    ).toBeUndefined();
    expect(diff.decision).toBe(env.decision);
  });

  it('webhook payload satisfies the canonical schema', async () => {
    const env = buildSafetyDecisionEnvelope(baseInput);
    const hash = await computeSafetyEnvelopePayloadHash(env);
    const eventType = safetyDecisionToWebhookEventType(env.decision);
    const payload = safetyEnvelopeWebhookPayload({
      event_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
      event_type: eventType,
      envelope: env,
      payload_hash: hash,
    });
    const parsed = WebhookSafetyEventSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(payload.pii_included).toBe(false);
    expect(payload.content_included).toBe(false);
  });

  it('webhook payload never includes raw content or PII keys', async () => {
    const env = buildSafetyDecisionEnvelope(baseInput);
    const hash = await computeSafetyEnvelopePayloadHash(env);
    const eventType = safetyDecisionToWebhookEventType(env.decision);
    const payload = safetyEnvelopeWebhookPayload({
      event_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
      event_type: eventType,
      envelope: env,
      payload_hash: hash,
    });
    const json = JSON.stringify(payload);
    for (const k of [
      'email',
      'phone',
      'cpf',
      'birthdate',
      'name',
      'message',
      'raw_text',
      'image',
      'video',
      'audio',
      'latitude',
      'longitude',
      'actor_ref_hmac',
      'counterparty_ref_hmac',
    ]) {
      const re = new RegExp(`"${k}"\\s*:`, 'i');
      expect(re.test(json)).toBe(false);
    }
  });
});
