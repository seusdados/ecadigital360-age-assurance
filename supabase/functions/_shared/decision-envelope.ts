// Decision Envelope adapter for the verifications-session-complete runtime.
//
// Wraps the canonical envelope builder from `@agekey/shared` so the edge
// function has ONE call site that produces a Decision Envelope from the
// runtime types it already has (`PolicySnapshot`, `AdapterResult`, the
// `SessionRecord`). The envelope then becomes the single source for:
//
//   1. Public response body of `POST /verifications/session/:id/complete`.
//   2. JWT claims signed via `signResultToken`.
//   3. Audit diff persisted in `audit_events.diff_json`.
//   4. Structured logs (`log.info('session_completed', …)`).
//   5. Webhook fan-out is driven by the SQL trigger today and the columns the
//      trigger reads (`verification_results`) come from the same envelope.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md
//            docs/audit/agekey-core-runtime-decision-envelope-report.md

import {
  DECISION_ENVELOPE_VERSION,
  type DecisionAdapterEvidence,
  type DecisionEnvelope,
  type ResultTokenClaims,
  assertDecisionEnvelopeIsPublicSafe,
  buildDecisionEnvelope,
  envelopeToTokenClaims,
} from '../../../packages/shared/src/index.ts';
import type {
  AdapterResult,
} from '../../../packages/adapter-contracts/src/index.ts';
import type { PolicySnapshot } from '../../../packages/shared/src/types.ts';

/** Decision-domain tag exposed in audit logs. Keeps room for future
 *  domains (`consent`, `safety`) without colliding with `age_verify`. */
export const DECISION_DOMAIN_AGE_VERIFY = 'age_verify' as const;

export interface BuildVerificationDecisionEnvelopeInput {
  tenantId: string;
  applicationId: string;
  sessionId: string;
  policy: PolicySnapshot;
  adapterResult: AdapterResult;
  externalUserRef: string | null;
  /** Unix seconds. Defaults to `Math.floor(Date.now() / 1000)`. */
  nowSeconds?: number;
}

function snapshotToCanonicalPolicy(p: PolicySnapshot) {
  const ageBand =
    p.age_band_min != null || p.age_band_max != null
      ? { min: p.age_band_min, max: p.age_band_max }
      : null;
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    slug: p.slug,
    name: p.name,
    age_threshold: p.age_threshold,
    age_band: ageBand,
    jurisdiction_code: p.jurisdiction_code,
    method_priority: p.method_priority,
    required_assurance_level: p.required_assurance_level,
    token_ttl_seconds: p.token_ttl_seconds,
    current_version: p.current_version,
    // resolvePolicy() never returns templates — sessions only run on tenant
    // policies — so this is constant in the runtime path.
    is_template: p.tenant_id == null,
  };
}

function evidenceFromAdapter(adapter: AdapterResult): DecisionAdapterEvidence {
  // The adapter's evidence shape is already minimised. Copy only the keys the
  // canonical schema accepts; anything extra goes under `extra` so it still
  // crosses the privacy-guard wall as a checked record.
  const ev = adapter.evidence ?? {};
  const out: DecisionAdapterEvidence = {};
  if (typeof ev.format === 'string') out.format = ev.format;
  if (typeof adapter.issuer_did === 'string') out.issuer_did = adapter.issuer_did;
  if (typeof ev.nonce_match === 'boolean') out.nonce_match = ev.nonce_match;
  if (typeof ev.proof_kind === 'string') out.proof_kind = ev.proof_kind;
  if (ev.extra && typeof ev.extra === 'object') out.extra = ev.extra;
  return out;
}

/**
 * Build the canonical Decision Envelope from the runtime data the edge
 * function already has. The canonical engine re-evaluates the policy →
 * assurance ladder, so the envelope's `decision` and `reason_code` may
 * differ from the raw adapter output (e.g. assurance unmet → denied with
 * POLICY_ASSURANCE_UNMET).
 */
export function buildVerificationDecisionEnvelope(
  input: BuildVerificationDecisionEnvelopeInput,
): DecisionEnvelope {
  return buildDecisionEnvelope({
    policy: snapshotToCanonicalPolicy(input.policy),
    tenant_id: input.tenantId,
    application_id: input.applicationId,
    session_id: input.sessionId,
    attestation: {
      method: input.adapterResult.method,
      threshold_satisfied: input.adapterResult.threshold_satisfied,
      reported_assurance: input.adapterResult.assurance_level,
      reason_code: input.adapterResult.reason_code,
      evidence: evidenceFromAdapter(input.adapterResult),
    },
    external_user_ref: input.externalUserRef,
    ...(typeof input.nowSeconds === 'number'
      ? { now_seconds: input.nowSeconds }
      : {}),
  });
}

/**
 * Project an envelope into the public `SessionCompleteResponse` shape used
 * by the edge function. The privacy guard on the envelope already proved
 * the data is public-safe; this function is a structural projection.
 */
export interface PublicCompleteResponse {
  session_id: string;
  status: 'completed';
  decision: DecisionEnvelope['decision'];
  reason_code: string;
  method: DecisionEnvelope['method'];
  assurance_level: DecisionEnvelope['assurance_level'];
  token: {
    jwt: string;
    jti: string;
    expires_at: string;
    kid: string;
  } | null;
}

export function envelopeToCompleteResponse(
  envelope: DecisionEnvelope,
  signedToken: PublicCompleteResponse['token'],
): PublicCompleteResponse {
  return {
    session_id: envelope.session_id,
    status: 'completed',
    decision: envelope.decision,
    reason_code: envelope.reason_code,
    method: envelope.method,
    assurance_level: envelope.assurance_level,
    token: signedToken,
  };
}

/**
 * Project an envelope into JWT claims. Wraps the canonical
 * `envelopeToTokenClaims` and runs the privacy guard one extra time at the
 * exit boundary (defense in depth — if the envelope was ever mutated after
 * `buildVerificationDecisionEnvelope`, the guard catches it before signing).
 */
export function envelopeToSignableClaims(
  envelope: DecisionEnvelope,
  refs: { iss: string; aud: string; jti: string },
): ResultTokenClaims {
  // assertDecisionEnvelopeIsPublicSafe is the canonical entrypoint; running
  // it here keeps the runtime symmetric with the build path.
  assertDecisionEnvelopeIsPublicSafe(envelope);
  return envelopeToTokenClaims(envelope, refs);
}

/**
 * Compute a canonical SHA-256 hex over the envelope. Keys are sorted to make
 * the digest stable across re-serializations. The hash is small, opaque and
 * PII-free; it is safe to log, store in audit, and (later) attach to webhook
 * payloads as a tamper-evident pointer.
 */
export async function computeEnvelopePayloadHash(
  envelope: DecisionEnvelope,
): Promise<string> {
  const stable = stableStringify(envelope);
  const buf = new TextEncoder().encode(stable);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Audit diff projection. Whitelists ONLY the fields auditors need:
 * IDs, hashes, method, assurance level, policy reference, decision, reason
 * code, timestamps and the payload_hash. No `evidence`, no `external_user_ref`,
 * no free-form payload — the privacy guard is not "applied blindly", instead
 * the projection is constructive.
 */
export interface EnvelopeAuditDiff {
  decision_domain: typeof DECISION_DOMAIN_AGE_VERIFY;
  envelope_version: number;
  decision: DecisionEnvelope['decision'];
  threshold_satisfied: boolean;
  method: DecisionEnvelope['method'];
  assurance_level: DecisionEnvelope['assurance_level'];
  reason_code: string;
  policy_id: string;
  policy_version: number;
  session_id: string;
  application_id: string;
  result_token_id: string | null;
  issued_at: number;
  expires_at: number;
  payload_hash: string;
  content_included: false;
  pii_included: false;
}

export function envelopeAuditDiff(
  envelope: DecisionEnvelope,
  payloadHash: string,
  resultTokenJti: string | null,
): EnvelopeAuditDiff {
  return {
    decision_domain: DECISION_DOMAIN_AGE_VERIFY,
    envelope_version: envelope.envelope_version,
    decision: envelope.decision,
    threshold_satisfied: envelope.threshold_satisfied,
    method: envelope.method,
    assurance_level: envelope.assurance_level,
    reason_code: envelope.reason_code,
    policy_id: envelope.policy.id,
    policy_version: envelope.policy.version,
    session_id: envelope.session_id,
    application_id: envelope.application_id,
    result_token_id: resultTokenJti,
    issued_at: envelope.issued_at,
    expires_at: envelope.expires_at,
    payload_hash: payloadHash,
    content_included: false,
    pii_included: false,
  };
}

/**
 * Structured log fields derived from the envelope. Same whitelist as audit
 * but without the `_diff` framing — pre-baked for `log.info(...)`.
 */
export function envelopeLogFields(
  envelope: DecisionEnvelope,
  payloadHash: string,
): Omit<EnvelopeAuditDiff, 'decision_domain' | 'envelope_version'> & {
  envelope_version: number;
} {
  return {
    envelope_version: envelope.envelope_version,
    decision: envelope.decision,
    threshold_satisfied: envelope.threshold_satisfied,
    method: envelope.method,
    assurance_level: envelope.assurance_level,
    reason_code: envelope.reason_code,
    policy_id: envelope.policy.id,
    policy_version: envelope.policy.version,
    session_id: envelope.session_id,
    application_id: envelope.application_id,
    result_token_id: null,
    issued_at: envelope.issued_at,
    expires_at: envelope.expires_at,
    payload_hash: payloadHash,
    content_included: false,
    pii_included: false,
  };
}

/** Re-export the canonical version constant for callers that import only this module. */
export { DECISION_ENVELOPE_VERSION };
