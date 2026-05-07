// Deno tests for the edge-function adapter `_shared/consent-envelope.ts`.
// Mirrors the existing decision-envelope.test.ts: pure builder coverage with
// no Supabase or HTTP dependencies.

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildConsentEnvelopeFromRows,
  computeConsentEnvelopePayloadHash,
  consentEnvelopeAuditDiff,
  consentEnvelopeWebhookPayload,
} from '../_shared/consent-envelope.ts';
import { WebhookParentalConsentEventSchema } from '../../../packages/shared/src/webhooks/webhook-types.ts';
import {
  ConsentDecisionEnvelopeSchema,
  envelopeToConsentTokenClaims,
  ParentalConsentTokenClaimsSchema,
} from '../../../packages/shared/src/consent/index.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';

const HMAC = 'a'.repeat(64);
const HMAC_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

const baseInput = {
  tenant_id: '018f7b8c-1111-7777-9999-2b31319d6ea1',
  application_id: '018f7b8c-2222-7777-9999-2b31319d6ea2',
  consent_request_id: '018f7b8c-3333-7777-9999-2b31319d6ea3',
  parental_consent_id: null,
  consent_token_id: null,
  verification_session_id: null,
  policy: {
    id: '018f7b8c-4444-7777-9999-2b31319d6ea4',
    slug: 'parental-consent-default',
    version: 1,
  },
  resource: 'platform_use',
  scope: null,
  purpose_codes: ['platform_use', 'data_processing_minimum'] as const,
  data_categories: ['profile_minimum'] as const,
  risk_tier: 'low' as const,
  subject_ref_hmac: HMAC,
  guardian_ref_hmac: null,
  guardian_method: null,
  guardian_assurance: null,
  guardian_verified: false,
  consent_text_hash: null,
  proof_hash: null,
  acceptance_complete: false,
  token_ttl_seconds: 3600,
  now_seconds: 1_700_000_000,
};

Deno.test('buildConsentEnvelopeFromRows: pending', () => {
  const env = buildConsentEnvelopeFromRows({
    ...baseInput,
    purpose_codes: [...baseInput.purpose_codes],
    data_categories: [...baseInput.data_categories],
  });
  ConsentDecisionEnvelopeSchema.parse(env);
  assertEquals(env.decision, 'pending');
  assertEquals(env.reason_code, REASON_CODES.CONSENT_NOT_GIVEN);
  assertEquals(env.pii_included, false);
  assertEquals(env.content_included, false);
});

Deno.test('buildConsentEnvelopeFromRows: approved emits canonical token claims', () => {
  const env = buildConsentEnvelopeFromRows({
    ...baseInput,
    purpose_codes: [...baseInput.purpose_codes],
    data_categories: [...baseInput.data_categories],
    parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
    consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
    guardian_ref_hmac: HMAC_B,
    guardian_method: 'otp_email',
    guardian_assurance: 'low',
    guardian_verified: true,
    consent_text_hash: HASH_C,
    proof_hash: HASH_D,
    acceptance_complete: true,
  });
  assertEquals(env.decision, 'approved');
  const claims = envelopeToConsentTokenClaims(env, {
    iss: 'https://agekey.com.br',
    aud: 'rp-app',
    jti: env.consent_token_id!,
  });
  ParentalConsentTokenClaimsSchema.parse(claims);
});

Deno.test('webhook payload built from approved envelope satisfies the canonical schema', async () => {
  const env = buildConsentEnvelopeFromRows({
    ...baseInput,
    purpose_codes: [...baseInput.purpose_codes],
    data_categories: [...baseInput.data_categories],
    parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
    consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
    guardian_ref_hmac: HMAC_B,
    guardian_method: 'otp_email',
    guardian_assurance: 'low',
    guardian_verified: true,
    consent_text_hash: HASH_C,
    proof_hash: HASH_D,
    acceptance_complete: true,
  });
  const hash = await computeConsentEnvelopePayloadHash(env);
  const payload = consentEnvelopeWebhookPayload({
    event_id: '018f7b8c-7777-7777-9999-2b31319d6ea7',
    event_type: 'parental_consent.approved',
    envelope: env,
    payload_hash: hash,
  });
  WebhookParentalConsentEventSchema.parse(payload);
});

Deno.test('audit diff omits subject_ref_hmac and guardian_ref_hmac', () => {
  const env = buildConsentEnvelopeFromRows({
    ...baseInput,
    purpose_codes: [...baseInput.purpose_codes],
    data_categories: [...baseInput.data_categories],
    parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
    consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
    guardian_ref_hmac: HMAC_B,
    guardian_method: 'otp_email',
    guardian_assurance: 'low',
    guardian_verified: true,
    consent_text_hash: HASH_C,
    proof_hash: HASH_D,
    acceptance_complete: true,
  });
  const diff = consentEnvelopeAuditDiff(env, 'f'.repeat(64));
  assertEquals((diff as Record<string, unknown>).subject_ref_hmac, undefined);
  assertEquals((diff as Record<string, unknown>).guardian_ref_hmac, undefined);
  assertEquals(diff.decision, 'approved');
});

Deno.test('refuses an approved envelope without proof material', () => {
  assertThrows(() =>
    buildConsentEnvelopeFromRows({
      ...baseInput,
      purpose_codes: [...baseInput.purpose_codes],
      data_categories: [...baseInput.data_categories],
      parental_consent_id: '018f7b8c-5555-7777-9999-2b31319d6ea5',
      consent_token_id: '018f7b8c-6666-7777-9999-2b31319d6ea6',
      guardian_ref_hmac: HMAC_B,
      guardian_method: 'otp_email',
      guardian_assurance: 'low',
      guardian_verified: true,
      consent_text_hash: null,
      proof_hash: null,
      acceptance_complete: true,
    }),
  );
});

Deno.test('payload hash is deterministic and lowercase hex', async () => {
  const env = buildConsentEnvelopeFromRows({
    ...baseInput,
    purpose_codes: [...baseInput.purpose_codes],
    data_categories: [...baseInput.data_categories],
  });
  const a = await computeConsentEnvelopePayloadHash(env);
  const b = await computeConsentEnvelopePayloadHash({ ...env });
  assert(/^[0-9a-f]{64}$/.test(a));
  assertEquals(a, b);
});
