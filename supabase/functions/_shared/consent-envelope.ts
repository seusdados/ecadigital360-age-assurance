// Edge-function adapter for the canonical Consent Decision Envelope.
//
// The shared package (`packages/shared/src/consent`) provides pure builders.
// The edge functions need a thin layer that:
//
//   1. Hashes opaque references with the per-tenant HMAC key.
//   2. Reads / writes the parental_consent_* tables.
//   3. Applies the canonical privacy guard before responding, signing or
//      enqueueing webhooks.
//
// Reference: docs/modules/parental-consent/architecture.md

import {
  CONSENT_DECISION_DOMAIN,
  CONSENT_ENVELOPE_VERSION,
  ConsentDecisionEnvelope,
  ConsentDataCategory,
  ConsentPurposeCode,
  ConsentRiskTier,
  GuardianVerificationMethod,
  assertConsentEnvelopeIsPublicSafe,
  buildConsentDecisionEnvelope,
  computeConsentEnvelopePayloadHash,
  consentEnvelopeAuditDiff,
  consentEnvelopeWebhookPayload,
  envelopeToConsentTokenClaims,
} from '../../../packages/shared/src/consent/index.ts';
import type {
  AssuranceLevel,
} from '../../../packages/shared/src/types.ts';
import type {
  WebhookParentalConsentEvent,
} from '../../../packages/shared/src/webhooks/webhook-types.ts';

export {
  CONSENT_DECISION_DOMAIN,
  CONSENT_ENVELOPE_VERSION,
  assertConsentEnvelopeIsPublicSafe,
  computeConsentEnvelopePayloadHash,
  consentEnvelopeAuditDiff,
  consentEnvelopeWebhookPayload,
  envelopeToConsentTokenClaims,
};

export interface BuildConsentEnvelopeFromRowsInput {
  tenant_id: string;
  application_id: string;
  consent_request_id: string;
  parental_consent_id: string | null;
  consent_token_id: string | null;
  verification_session_id: string | null;
  policy: { id: string; slug: string; version: number } | null;
  resource: string;
  scope: string | null;
  purpose_codes: ConsentPurposeCode[];
  data_categories: ConsentDataCategory[];
  risk_tier: ConsentRiskTier;
  subject_ref_hmac: string;
  guardian_ref_hmac: string | null;
  guardian_method: GuardianVerificationMethod | null;
  guardian_assurance: AssuranceLevel | null;
  guardian_verified: boolean;
  consent_text_hash: string | null;
  proof_hash: string | null;
  acceptance_complete: boolean;
  policy_blocks_resource?: boolean;
  token_ttl_seconds: number;
  now_seconds?: number;
}

/**
 * Build an envelope directly from already-loaded SQL rows. The handler
 * computes hashes itself; the engine inside `buildConsentDecisionEnvelope`
 * still re-runs the decision logic to keep the envelope/decision invariant.
 */
export function buildConsentEnvelopeFromRows(
  input: BuildConsentEnvelopeFromRowsInput,
): ConsentDecisionEnvelope {
  const guardian =
    input.guardian_ref_hmac != null && input.guardian_method != null
      ? {
          guardian_ref_hmac: input.guardian_ref_hmac,
          method: input.guardian_method,
          reported_assurance: input.guardian_assurance ?? 'low',
          verified: input.guardian_verified,
        }
      : null;
  const acceptance =
    input.acceptance_complete &&
    input.consent_text_hash != null &&
    input.proof_hash != null
      ? {
          consent_text_hash: input.consent_text_hash,
          proof_hash: input.proof_hash,
          guardian_responsibility_confirmed: true,
          understands_scope: true,
          understands_revocation: true,
        }
      : null;
  const built = buildConsentDecisionEnvelope({
    tenant_id: input.tenant_id,
    application_id: input.application_id,
    consent_request_id: input.consent_request_id,
    parental_consent_id: input.parental_consent_id,
    consent_token_id: input.consent_token_id,
    verification_session_id: input.verification_session_id,
    policy: input.policy,
    resource: input.resource,
    scope: input.scope,
    purpose_codes: input.purpose_codes,
    data_categories: input.data_categories,
    risk_tier: input.risk_tier,
    subject_ref_hmac: input.subject_ref_hmac,
    guardian,
    acceptance,
    consent_text_hash: input.consent_text_hash,
    proof_hash: input.proof_hash,
    token_ttl_seconds: input.token_ttl_seconds,
    ...(typeof input.now_seconds === 'number'
      ? { now_seconds: input.now_seconds }
      : {}),
    ...(input.policy_blocks_resource ? { policy_blocks_resource: true } : {}),
  });
  return built;
}

/** Helper for the public response: status string from the decision. */
export function envelopeStatusForResponse(
  decision: ConsentDecisionEnvelope['decision'],
  acceptance_complete: boolean,
  guardian_verified: boolean,
):
  | 'created'
  | 'pending_guardian'
  | 'pending_verification'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'revoked'
  | 'failed'
  | 'under_review'
  | 'blocked_by_policy' {
  switch (decision) {
    case 'approved':
      return 'approved';
    case 'denied':
      return 'denied';
    case 'needs_review':
      return 'under_review';
    case 'blocked_by_policy':
      return 'blocked_by_policy';
    case 'pending':
      if (!guardian_verified) return 'pending_guardian';
      if (!acceptance_complete) return 'pending_verification';
      return 'created';
  }
}

export type { WebhookParentalConsentEvent };
