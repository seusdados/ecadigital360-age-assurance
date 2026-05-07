import { describe, expect, it } from 'vitest';
import {
  computeConsentEnvelopePayloadHash,
  consentDecisionToWebhookEventType,
  consentEnvelopeAuditDiff,
  consentEnvelopeWebhookPayload,
} from './consent-projections.ts';
import { buildConsentDecisionEnvelope } from './consent-engine.ts';
import {
  WEBHOOK_EVENT_TYPES,
  WebhookParentalConsentEventSchema,
} from '../webhooks/webhook-types.ts';

const HMAC = 'a'.repeat(64);
const HMAC_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

function approvedEnvelope() {
  return buildConsentDecisionEnvelope({
    tenant_id: '018f7b8c-1111-7777-9999-2b31319d6ea1',
    application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
    consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
    policy: {
      id: '018f7b8c-4444-7777-9999-2b31319d6ea4',
      slug: 'parental-consent-default',
      version: 2,
    },
    resource: 'platform_use',
    scope: null,
    purpose_codes: ['platform_use'],
    data_categories: ['profile_minimum'],
    risk_tier: 'low',
    subject_ref_hmac: HMAC,
    verification_session_id: null,
    parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
    consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
    consent_text_hash: HASH_C,
    proof_hash: HASH_D,
    guardian: {
      guardian_ref_hmac: HMAC_B,
      method: 'otp_email',
      reported_assurance: 'low',
      verified: true,
    },
    acceptance: {
      consent_text_hash: HASH_C,
      proof_hash: HASH_D,
      guardian_responsibility_confirmed: true,
      understands_scope: true,
      understands_revocation: true,
    },
    token_ttl_seconds: 3600,
    now_seconds: 1_700_000_000,
  });
}

describe('consent projections', () => {
  it('produces a deterministic hex payload hash', async () => {
    const env = approvedEnvelope();
    const a = await computeConsentEnvelopePayloadHash(env);
    const b = await computeConsentEnvelopePayloadHash({ ...env });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toEqual(b);
  });

  it('audit diff omits subject_ref_hmac and guardian_ref_hmac', () => {
    const env = approvedEnvelope();
    const diff = consentEnvelopeAuditDiff(env, 'f'.repeat(64));
    // The diff is constructive: only the whitelisted fields appear.
    expect(diff).not.toHaveProperty('subject_ref_hmac');
    expect(diff).not.toHaveProperty('guardian_ref_hmac');
    expect(diff.decision).toBe('approved');
    expect(diff.payload_hash).toBe('f'.repeat(64));
    expect(diff.policy_version).toBe(2);
  });

  it('webhook payload satisfies the canonical schema', async () => {
    const env = approvedEnvelope();
    const hash = await computeConsentEnvelopePayloadHash(env);
    const eventType = consentDecisionToWebhookEventType(env.decision);
    expect(eventType).toBe(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_APPROVED);
    const payload = consentEnvelopeWebhookPayload({
      event_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
      event_type: eventType,
      envelope: env,
      payload_hash: hash,
    });
    const parsed = WebhookParentalConsentEventSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(payload.pii_included).toBe(false);
    expect(payload.content_included).toBe(false);
  });

  it('webhook payload never includes guardian contact fields', async () => {
    const env = approvedEnvelope();
    const hash = await computeConsentEnvelopePayloadHash(env);
    const payload = consentEnvelopeWebhookPayload({
      event_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
      event_type: WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_APPROVED,
      envelope: env,
      payload_hash: hash,
    });
    const json = JSON.stringify(payload);
    for (const k of [
      'email',
      'phone',
      'guardian_email',
      'guardian_phone',
      'cpf',
      'birthdate',
      'name',
      'subject_ref_hmac',
      'guardian_ref_hmac',
    ]) {
      const re = new RegExp(`"${k}"\\s*:`, 'i');
      expect(re.test(json)).toBe(false);
    }
  });
});
