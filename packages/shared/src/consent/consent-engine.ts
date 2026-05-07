// Parental Consent — pure decision engine.
//
// Mirrors `policy/policy-engine.ts` for the consent domain. The engine is
// pure: given a request input, an optional verification result and the
// active text version, it returns a `ConsentDecisionEnvelope`. No I/O.
//
// The Core's edge functions wrap the engine with database access, OTP
// dispatch and webhook fan-out. Tests instantiate the engine directly to
// avoid setting up a Postgres environment.
//
// Reference: docs/modules/parental-consent/architecture.md §Decision flow

import { REASON_CODES } from '../reason-codes.ts';
import {
  CONSENT_DECISION_DOMAIN,
} from './consent-types.ts';
import {
  CONSENT_ENVELOPE_VERSION,
  assertConsentEnvelopeIsPublicSafe,
} from './consent-envelope.ts';
import type { ConsentDecisionEnvelope } from './consent-envelope.ts';
import type {
  ConsentDataCategory,
  ConsentDecision,
  ConsentPurposeCode,
  ConsentRiskTier,
  GuardianVerificationMethod,
} from './consent-types.ts';
import type { AssuranceLevel } from '../types.ts';

export const CONSENT_ASSURANCE_FOR_RISK: Record<
  ConsentRiskTier,
  AssuranceLevel
> = {
  low: 'low',
  medium: 'substantial',
  high: 'high',
};

export interface ConsentRequestInput {
  tenant_id: string;
  application_id: string;
  consent_request_id: string;
  policy: { id: string; slug: string; version: number } | null;
  resource: string;
  scope: string | null;
  purpose_codes: ConsentPurposeCode[];
  data_categories: ConsentDataCategory[];
  risk_tier: ConsentRiskTier;
  subject_ref_hmac: string;
  verification_session_id: string | null;
}

export interface ConsentGuardianAttestation {
  guardian_ref_hmac: string;
  method: GuardianVerificationMethod;
  reported_assurance: AssuranceLevel;
  /** True only when the guardian channel actually verified (e.g. OTP confirmed). */
  verified: boolean;
}

export interface ConsentAcceptance {
  /** SHA-256 of the consent text body. */
  consent_text_hash: string;
  /** SHA-256 of the canonical proof material. */
  proof_hash: string;
  guardian_responsibility_confirmed: boolean;
  understands_scope: boolean;
  understands_revocation: boolean;
}

export interface ConsentEvaluation {
  decision: ConsentDecision;
  reason_code: string;
}

/**
 * Pure decision logic. Order:
 *   1. If the policy denies up-front (e.g. guardian flow disabled or resource
 *      not allowed), return `blocked_by_policy`.
 *   2. If guardian attestation is missing → `pending`.
 *   3. If guardian attestation failed → `denied` with `CONSENT_GUARDIAN_NOT_VERIFIED`.
 *   4. If the guardian assurance is below what the risk tier requires →
 *      `needs_review` (high) or `denied` (low/medium).
 *   5. If acceptance flags are not all true → `denied` with `CONSENT_DENIED`.
 *   6. Otherwise → `approved` with `CONSENT_GRANTED`.
 */
export function evaluateConsent(
  input: ConsentRequestInput,
  guardian: ConsentGuardianAttestation | null,
  acceptance: ConsentAcceptance | null,
  options: { policy_blocks_resource?: boolean } = {},
): ConsentEvaluation {
  if (options.policy_blocks_resource) {
    return {
      decision: 'blocked_by_policy',
      reason_code: REASON_CODES.CONSENT_BLOCKED_BY_POLICY,
    };
  }

  if (guardian == null) {
    return { decision: 'pending', reason_code: REASON_CODES.CONSENT_NOT_GIVEN };
  }
  if (!guardian.verified) {
    return {
      decision: 'denied',
      reason_code: REASON_CODES.CONSENT_GUARDIAN_NOT_VERIFIED,
    };
  }

  const required = CONSENT_ASSURANCE_FOR_RISK[input.risk_tier];
  if (!meetsAssurance(guardian.reported_assurance, required)) {
    if (input.risk_tier === 'high') {
      return {
        decision: 'needs_review',
        reason_code: REASON_CODES.CONSENT_NEEDS_REVIEW,
      };
    }
    return {
      decision: 'denied',
      reason_code: REASON_CODES.CONSENT_GUARDIAN_NOT_VERIFIED,
    };
  }

  if (acceptance == null) {
    return { decision: 'pending', reason_code: REASON_CODES.CONSENT_NOT_GIVEN };
  }
  if (
    !acceptance.guardian_responsibility_confirmed ||
    !acceptance.understands_scope ||
    !acceptance.understands_revocation
  ) {
    return { decision: 'denied', reason_code: REASON_CODES.CONSENT_DENIED };
  }

  return { decision: 'approved', reason_code: REASON_CODES.CONSENT_GRANTED };
}

const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  low: 1,
  substantial: 2,
  high: 3,
};

function meetsAssurance(reported: AssuranceLevel, required: AssuranceLevel) {
  return ASSURANCE_RANK[reported] >= ASSURANCE_RANK[required];
}

export interface BuildConsentEnvelopeInput extends ConsentRequestInput {
  parental_consent_id: string | null;
  consent_token_id: string | null;
  consent_text_hash: string | null;
  proof_hash: string | null;
  guardian: ConsentGuardianAttestation | null;
  acceptance: ConsentAcceptance | null;
  /** Unix seconds. */
  now_seconds?: number;
  /** Token TTL in seconds. */
  token_ttl_seconds: number;
  /** Set when the policy refused to authorise the resource. */
  policy_blocks_resource?: boolean;
}

/**
 * Compose `evaluateConsent` + envelope construction. Validates and runs the
 * privacy guard before returning.
 */
export function buildConsentDecisionEnvelope(
  input: BuildConsentEnvelopeInput,
): ConsentDecisionEnvelope {
  const evaluation = evaluateConsent(
    input,
    input.guardian,
    input.acceptance,
    input.policy_blocks_resource ? { policy_blocks_resource: true } : {},
  );
  const issuedAt = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + input.token_ttl_seconds;
  const envelope: ConsentDecisionEnvelope = {
    envelope_version: CONSENT_ENVELOPE_VERSION,
    decision_domain: CONSENT_DECISION_DOMAIN,
    tenant_id: input.tenant_id,
    application_id: input.application_id,
    consent_request_id: input.consent_request_id,
    parental_consent_id: input.parental_consent_id,
    consent_token_id: input.consent_token_id,
    verification_session_id: input.verification_session_id,
    policy: input.policy,
    decision: evaluation.decision,
    reason_code: evaluation.reason_code,
    resource: input.resource,
    scope: input.scope,
    purpose_codes: input.purpose_codes,
    data_categories: input.data_categories,
    risk_tier: input.risk_tier,
    guardian_verification_method: input.guardian?.method ?? null,
    assurance_level: input.guardian?.reported_assurance ?? null,
    consent_text_hash: input.consent_text_hash,
    proof_hash: input.proof_hash,
    subject_ref_hmac: input.subject_ref_hmac,
    guardian_ref_hmac: input.guardian?.guardian_ref_hmac ?? null,
    issued_at: issuedAt,
    expires_at: expiresAt,
    pii_included: false,
    content_included: false,
  };
  return assertConsentEnvelopeIsPublicSafe(envelope);
}

// Re-export so callers that import only the engine reach the constant.
export { CONSENT_ENVELOPE_VERSION };
