// Deno tests — _shared/decision-envelope.ts.
//
// Validates that the runtime adapter for `verifications-session-complete`
// produces a canonical Decision Envelope from the runtime types
// (`PolicySnapshot`, `AdapterResult`) and that the projections used by the
// edge function (token claims, public response, audit diff, log fields) are
// consistent with that envelope. No DB, no network.
//
// Run with: deno test supabase/functions/_tests/decision-envelope.test.ts

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  buildVerificationDecisionEnvelope,
  computeEnvelopePayloadHash,
  envelopeAuditDiff,
  envelopeLogFields,
  envelopeToCompleteResponse,
  envelopeToSignableClaims,
  DECISION_DOMAIN_AGE_VERIFY,
} from '../_shared/decision-envelope.ts';
import { ResultTokenClaimsSchema } from '../../../packages/shared/src/schemas/tokens.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';
import {
  WebhookVerificationEventSchema,
  WEBHOOK_EVENT_TYPES,
} from '../../../packages/shared/src/index.ts';
import type { PolicySnapshot } from '../../../packages/shared/src/types.ts';
import type { AdapterResult } from '../../../packages/adapter-contracts/src/index.ts';

const TENANT = '01926cb0-0000-7000-8000-000000000010';
const APPLICATION = '01926cb0-0000-7000-8000-000000000011';
const SESSION = '01926cb0-0000-7000-8000-000000000012';
const POLICY_ID = '01926cb0-0000-7000-8000-000000000020';

const policy: PolicySnapshot = {
  id: POLICY_ID,
  tenant_id: TENANT,
  name: 'BR-18+',
  slug: 'br-18-plus',
  age_threshold: 18,
  age_band_min: null,
  age_band_max: null,
  jurisdiction_code: 'BR',
  method_priority: ['zkp', 'vc', 'gateway', 'fallback'],
  required_assurance_level: 'substantial',
  token_ttl_seconds: 3600,
  current_version: 7,
};

const NOW = 1_780_000_000;

const adapterApproved: AdapterResult = {
  decision: 'approved',
  threshold_satisfied: true,
  assurance_level: 'substantial',
  method: 'gateway',
  reason_code: REASON_CODES.THRESHOLD_SATISFIED,
  evidence: { proof_kind: 'jws', extra: { provider: 'demo' } },
};

const adapterDenied: AdapterResult = {
  decision: 'denied',
  threshold_satisfied: false,
  assurance_level: 'low',
  method: 'fallback',
  reason_code: REASON_CODES.FALLBACK_RISK_HIGH,
  evidence: { proof_kind: 'fallback' },
};

const adapterAssuranceMismatch: AdapterResult = {
  decision: 'approved',
  threshold_satisfied: true,
  assurance_level: 'low',
  method: 'fallback',
  reason_code: REASON_CODES.FALLBACK_DECLARATION_ACCEPTED,
  evidence: { proof_kind: 'fallback' },
};

Deno.test('builds an approved envelope with the canonical fields', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  assertEquals(env.envelope_version, 1);
  assertEquals(env.tenant_id, TENANT);
  assertEquals(env.application_id, APPLICATION);
  assertEquals(env.session_id, SESSION);
  assertEquals(env.policy.version, 7);
  assertEquals(env.decision, 'approved');
  assertEquals(env.threshold_satisfied, true);
  assertEquals(env.method, 'gateway');
  assertEquals(env.reason_code, REASON_CODES.THRESHOLD_SATISFIED);
  assertEquals(env.issued_at, NOW);
  assertEquals(env.expires_at, NOW + policy.token_ttl_seconds);
});

Deno.test('builds a denied envelope when adapter denied', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterDenied,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  assertEquals(env.decision, 'denied');
  assertEquals(env.threshold_satisfied, false);
  assertEquals(env.reason_code, REASON_CODES.FALLBACK_RISK_HIGH);
});

Deno.test('downgrades to denied + POLICY_ASSURANCE_UNMET when assurance below required', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterAssuranceMismatch,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  assertEquals(env.decision, 'denied');
  assertEquals(env.threshold_satisfied, false);
  assertEquals(env.reason_code, REASON_CODES.POLICY_ASSURANCE_UNMET);
});

Deno.test('rejects evidence carrying PII-shaped keys', () => {
  let threw: unknown = null;
  try {
    buildVerificationDecisionEnvelope({
      tenantId: TENANT,
      applicationId: APPLICATION,
      sessionId: SESSION,
      policy,
      adapterResult: {
        ...adapterApproved,
        evidence: { extra: { cpf: '12345678909' } },
      },
      externalUserRef: null,
      nowSeconds: NOW,
    });
  } catch (err) {
    threw = err;
  }
  assert(threw instanceof Error, 'expected an Error');
  assert(
    /forbidden PII-like keys/.test((threw as Error).message),
    `unexpected error message: ${(threw as Error).message}`,
  );
});

Deno.test('envelopeToSignableClaims yields a token that satisfies the canonical schema', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  const claims = envelopeToSignableClaims(env, {
    iss: 'https://staging.agekey.com.br',
    aud: 'demo-app',
    jti: '01926cb0-0000-7000-8000-000000000099',
  });
  // Throws on shape violations.
  ResultTokenClaimsSchema.parse(claims);
  assertEquals(claims.exp, env.expires_at);
  assertEquals(claims.iat, env.issued_at);
  assertEquals(claims.agekey.policy.version, 7);
  assertEquals(claims.sub, undefined);
});

Deno.test('envelopeToSignableClaims forwards opaque external_user_ref to sub', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: 'opaque-hmac-deadbeefcafebabe',
    nowSeconds: NOW,
  });
  const claims = envelopeToSignableClaims(env, {
    iss: 'https://staging.agekey.com.br',
    aud: 'demo-app',
    jti: '01926cb0-0000-7000-8000-000000000098',
  });
  assertEquals(claims.sub, 'opaque-hmac-deadbeefcafebabe');
});

Deno.test('envelopeToCompleteResponse projects only the public fields', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  const body = envelopeToCompleteResponse(env, null);
  assertEquals(Object.keys(body).sort(), [
    'assurance_level',
    'decision',
    'method',
    'reason_code',
    'session_id',
    'status',
    'token',
  ]);
  assertEquals(body.session_id, SESSION);
  assertEquals(body.status, 'completed');
  assertEquals(body.token, null);
});

Deno.test('envelopeAuditDiff stays free of PII and free-form payload', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  const diff = envelopeAuditDiff(env, 'a'.repeat(64), 'jti-xyz');
  assertEquals(diff.decision_domain, DECISION_DOMAIN_AGE_VERIFY);
  assertEquals(diff.envelope_version, 1);
  assertEquals(diff.policy_id, POLICY_ID);
  assertEquals(diff.policy_version, 7);
  assertEquals(diff.result_token_id, 'jti-xyz');
  assertEquals(diff.payload_hash, 'a'.repeat(64));
  assertEquals(diff.content_included, false);
  assertEquals(diff.pii_included, false);
  // The whitelist must NOT carry any of the sensitive evidence shape.
  const keys = Object.keys(diff);
  assert(!keys.includes('evidence'), 'audit diff must not include evidence');
  assert(
    !keys.includes('external_user_ref'),
    'audit diff must not include external_user_ref',
  );
});

Deno.test('envelopeLogFields shares the audit projection (no PII)', () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  const fields = envelopeLogFields(env, 'b'.repeat(64));
  assertEquals(fields.payload_hash, 'b'.repeat(64));
  assertEquals(fields.policy_version, 7);
  assertEquals(fields.session_id, SESSION);
  assert(!('evidence' in fields));
});

Deno.test('computeEnvelopePayloadHash is deterministic and hex-formatted', async () => {
  const env = buildVerificationDecisionEnvelope({
    tenantId: TENANT,
    applicationId: APPLICATION,
    sessionId: SESSION,
    policy,
    adapterResult: adapterApproved,
    externalUserRef: null,
    nowSeconds: NOW,
  });
  const a = await computeEnvelopePayloadHash(env);
  const b = await computeEnvelopePayloadHash(env);
  assertEquals(a, b);
  assert(/^[0-9a-f]{64}$/.test(a), 'expected 64-char lowercase hex');
});

Deno.test(
  'webhook payload built from envelope satisfies the canonical schema (parity with SQL trigger)',
  () => {
    const env = buildVerificationDecisionEnvelope({
      tenantId: TENANT,
      applicationId: APPLICATION,
      sessionId: SESSION,
      policy,
      adapterResult: adapterApproved,
      externalUserRef: null,
      nowSeconds: NOW,
    });
    // This payload mirrors the JSONB built by SQL function
    // `build_verification_event_payload()` in
    // supabase/migrations/012_webhook_enqueue.sql.
    const payload = {
      event_id: '01926cb0-0000-7000-8000-000000000050',
      event_type: WEBHOOK_EVENT_TYPES.VERIFICATION_APPROVED,
      tenant_id: env.tenant_id,
      session_id: env.session_id,
      application_id: env.application_id,
      decision: env.decision,
      reason_code: env.reason_code,
      method: env.method,
      assurance_level: env.assurance_level,
      threshold_satisfied: env.threshold_satisfied,
      jti: '01926cb0-0000-7000-8000-000000000051',
      created_at: '2026-05-06T19:00:00.000Z',
    };
    WebhookVerificationEventSchema.parse(payload);
  },
);
