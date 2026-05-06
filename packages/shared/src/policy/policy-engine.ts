// Policy engine — pure functions that turn an adapter attestation into a
// canonical decision envelope.
//
// The engine knows nothing about HTTP, the database or signing. It is the
// deterministic heart of the Core: given a policy and a typed attestation,
// it returns the same envelope every time. Network/IO concerns live in the
// edge functions that wrap it.
//
// Three responsibilities:
//   1. Check the assurance level required by the policy is satisfied.
//   2. Pick the adapter method according to client capabilities and the
//      policy's `method_priority`.
//   3. Build the DecisionEnvelope (the Core's public-safe output).
//
// Consent and Safety hooks are NOT yet wired here — the engine returns a
// `policy_only` decision and leaves room for those modules to layer on top
// without breaking the envelope shape.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Policy engine.

import {
  ASSURANCE_RANK,
  type AssuranceLevel,
  type ClientCapabilities,
  type VerificationMethod,
} from '../types.ts';
import { REASON_CODES, type ReasonCode } from '../reason-codes.ts';
import {
  DECISION_ENVELOPE_VERSION,
  type DecisionAdapterEvidence,
  type DecisionEnvelope,
  assertDecisionEnvelopeIsPublicSafe,
} from '../decision/decision-envelope.ts';
import type { PolicyDefinition } from './policy-types.ts';

/** Available adapter methods for the current platform. */
export interface AdapterAvailability {
  zkp: boolean;
  vc: boolean;
  gateway: boolean;
  fallback: boolean;
}

const ALL_METHODS: VerificationMethod[] = ['zkp', 'vc', 'gateway', 'fallback'];

/**
 * Pick the first method in `policy.method_priority` that is reported as
 * available. Returns `null` when no method matches — the caller should map
 * that to `POLICY_ASSURANCE_UNMET` or trigger the fallback flow.
 */
export function selectAdapterMethod(
  policy: PolicyDefinition,
  availability: AdapterAvailability,
): VerificationMethod | null {
  for (const method of policy.method_priority) {
    if (availability[method]) return method;
  }
  return null;
}

/**
 * Heuristic mapping from `client_capabilities` to adapter availability.
 * Conservative on purpose — when a capability is missing or unknown the
 * adapter is treated as unavailable and the engine falls through to the
 * next method in the priority list.
 */
export function deriveAdapterAvailability(
  capabilities: ClientCapabilities | undefined,
): AdapterAvailability {
  const caps = capabilities ?? {};
  return {
    // ZKP requires a wallet that can present a BBS/BBS+ proof.
    zkp: Boolean(caps.wallet_present),
    // VC works whenever a wallet is present — works for both web and native.
    vc: Boolean(caps.wallet_present || caps.digital_credentials_api),
    // Gateway is a hosted flow — always available.
    gateway: true,
    // Fallback (self-declaration + signals) is always available; the engine
    // still respects the policy's method_priority.
    fallback: true,
  };
}

/**
 * `meetsAssurance(reported, required)` — true when `reported` is at least as
 * strong as `required` on the AssuranceLevel ladder.
 */
export function meetsAssurance(
  reported: AssuranceLevel,
  required: AssuranceLevel,
): boolean {
  return ASSURANCE_RANK[reported] >= ASSURANCE_RANK[required];
}

/**
 * Adapter attestation shape. The Core's adapters all converge to this shape
 * before the policy engine sees them — the engine never inspects the raw
 * proof, only the derived flags.
 */
export interface AdapterAttestation {
  method: VerificationMethod;
  /** `true` when the adapter could verify the threshold; `null` when neutral. */
  threshold_satisfied: boolean | null;
  reported_assurance: AssuranceLevel;
  reason_code: ReasonCode;
  evidence: DecisionAdapterEvidence;
}

export interface PolicyEvaluation {
  decision: 'approved' | 'denied' | 'needs_review';
  reason_code: ReasonCode;
  threshold_satisfied: boolean;
}

/**
 * Apply the policy to an attestation. Pure; no I/O.
 *
 * - If the attestation already failed (`threshold_satisfied !== true` or a
 *   non-positive reason code), the engine surfaces the adapter's reason as-is.
 * - If the assurance level is below `policy.required_assurance_level`, the
 *   engine downgrades the decision to `denied` with `POLICY_ASSURANCE_UNMET`.
 * - Otherwise the engine returns `approved`.
 */
export function evaluatePolicy(
  policy: PolicyDefinition,
  attestation: AdapterAttestation,
): PolicyEvaluation {
  if (attestation.threshold_satisfied !== true) {
    return {
      decision: 'denied',
      reason_code: attestation.reason_code,
      threshold_satisfied: false,
    };
  }
  if (!meetsAssurance(attestation.reported_assurance, policy.required_assurance_level)) {
    return {
      decision: 'denied',
      reason_code: REASON_CODES.POLICY_ASSURANCE_UNMET,
      threshold_satisfied: false,
    };
  }
  return {
    decision: 'approved',
    reason_code: attestation.reason_code,
    threshold_satisfied: true,
  };
}

export interface BuildEnvelopeInput {
  policy: PolicyDefinition;
  tenant_id: string;
  application_id: string;
  session_id: string;
  attestation: AdapterAttestation;
  external_user_ref: string | null;
  /** Unix seconds. Defaults to `Math.floor(Date.now() / 1000)`. */
  now_seconds?: number;
}

/**
 * Compose `evaluatePolicy` + envelope construction. The result is validated
 * against `DecisionEnvelopeSchema` and the privacy guard before being
 * returned, so the caller cannot accidentally introduce PII.
 */
export function buildDecisionEnvelope(
  input: BuildEnvelopeInput,
): DecisionEnvelope {
  const evaluation = evaluatePolicy(input.policy, input.attestation);
  const issuedAt = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + input.policy.token_ttl_seconds;
  const envelope: DecisionEnvelope = {
    envelope_version: DECISION_ENVELOPE_VERSION,
    tenant_id: input.tenant_id,
    application_id: input.application_id,
    session_id: input.session_id,
    policy: {
      id: input.policy.id,
      slug: input.policy.slug,
      version: input.policy.current_version,
    },
    decision: evaluation.decision,
    threshold_satisfied: evaluation.threshold_satisfied,
    age_threshold: input.policy.age_threshold,
    age_band: input.policy.age_band,
    method: input.attestation.method,
    assurance_level: input.attestation.reported_assurance,
    reason_code: evaluation.reason_code,
    evidence: input.attestation.evidence,
    issued_at: issuedAt,
    expires_at: expiresAt,
    external_user_ref: input.external_user_ref,
  };
  return assertDecisionEnvelopeIsPublicSafe(envelope);
}

/** Surfaced for tests / introspection. */
export const POLICY_ENGINE_FALLBACK_METHODS = ALL_METHODS;
