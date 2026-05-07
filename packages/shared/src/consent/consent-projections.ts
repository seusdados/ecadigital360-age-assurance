// Parental Consent — projections for response, webhook, audit and log.
//
// Mirrors the `envelopeTo*` family in `_shared/decision-envelope.ts` for the
// age-verify domain. Every projection is constructive (whitelist) — the
// envelope's strict schema and the privacy guard are belt-and-braces.
//
// Reference: docs/modules/parental-consent/architecture.md

import type {
  WebhookEventType,
  WebhookParentalConsentEvent,
} from '../webhooks/webhook-types.ts';
import type { ConsentDecisionEnvelope } from './consent-envelope.ts';
import { CONSENT_DECISION_DOMAIN } from './consent-types.ts';

const TEXT_ENCODER =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/**
 * Compute a deterministic SHA-256 over the canonical JSON of the envelope.
 * Keys are sorted recursively so identical envelopes always hash the same,
 * regardless of how they were serialised. Returns lowercase hex.
 */
export async function computeConsentEnvelopePayloadHash(
  envelope: ConsentDecisionEnvelope,
): Promise<string> {
  if (TEXT_ENCODER == null) {
    throw new Error('TextEncoder is not available in this runtime');
  }
  const stable = stableStringify(envelope);
  const bytes = TEXT_ENCODER.encode(stable);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
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
 * Audit diff for `audit_events.diff_json`. Whitelist of IDs, hashes,
 * timestamps and the envelope hash; no `subject_ref_hmac` echo, no contact,
 * no PII keys. The privacy guard is not "applied blindly" — it is the
 * enforcement layer; the projection here is the construction layer.
 */
export interface ConsentEnvelopeAuditDiff {
  decision_domain: typeof CONSENT_DECISION_DOMAIN;
  envelope_version: number;
  decision: ConsentDecisionEnvelope['decision'];
  reason_code: string;
  consent_request_id: string;
  parental_consent_id: string | null;
  consent_token_id: string | null;
  verification_session_id: string | null;
  policy_id: string | null;
  policy_version: number | null;
  resource: string;
  scope: string | null;
  risk_tier: ConsentDecisionEnvelope['risk_tier'];
  guardian_verification_method:
    ConsentDecisionEnvelope['guardian_verification_method'];
  assurance_level: ConsentDecisionEnvelope['assurance_level'];
  consent_text_hash: string | null;
  proof_hash: string | null;
  issued_at: number;
  expires_at: number;
  payload_hash: string;
  content_included: false;
  pii_included: false;
}

export function consentEnvelopeAuditDiff(
  envelope: ConsentDecisionEnvelope,
  payloadHash: string,
): ConsentEnvelopeAuditDiff {
  return {
    decision_domain: CONSENT_DECISION_DOMAIN,
    envelope_version: envelope.envelope_version,
    decision: envelope.decision,
    reason_code: envelope.reason_code,
    consent_request_id: envelope.consent_request_id,
    parental_consent_id: envelope.parental_consent_id,
    consent_token_id: envelope.consent_token_id,
    verification_session_id: envelope.verification_session_id,
    policy_id: envelope.policy?.id ?? null,
    policy_version: envelope.policy?.version ?? null,
    resource: envelope.resource,
    scope: envelope.scope,
    risk_tier: envelope.risk_tier,
    guardian_verification_method: envelope.guardian_verification_method,
    assurance_level: envelope.assurance_level,
    consent_text_hash: envelope.consent_text_hash,
    proof_hash: envelope.proof_hash,
    issued_at: envelope.issued_at,
    expires_at: envelope.expires_at,
    payload_hash: payloadHash,
    content_included: false,
    pii_included: false,
  };
}

/** Same whitelist as audit, suited for `log.info('consent.completed', ...)`. */
export function consentEnvelopeLogFields(
  envelope: ConsentDecisionEnvelope,
  payloadHash: string,
): Omit<ConsentEnvelopeAuditDiff, 'decision_domain'> & {
  decision_domain: typeof CONSENT_DECISION_DOMAIN;
} {
  return consentEnvelopeAuditDiff(envelope, payloadHash);
}

/**
 * Build a webhook event payload from the envelope. The caller fills the
 * envelope-independent fields (`event_id`, `created_at`, `event_type`) and
 * we project the rest. Public-safe by construction.
 */
export function consentEnvelopeWebhookPayload(args: {
  event_id: string;
  event_type: WebhookParentalConsentEvent['event_type'];
  envelope: ConsentDecisionEnvelope;
  payload_hash: string;
  created_at?: string;
  reason_codes?: string[];
}): WebhookParentalConsentEvent {
  const env = args.envelope;
  return {
    event_id: args.event_id,
    event_type: args.event_type,
    created_at: args.created_at ?? new Date(env.issued_at * 1000).toISOString(),
    tenant_id: env.tenant_id,
    application_id: env.application_id,
    decision: env.decision,
    consent_request_id: env.consent_request_id,
    consent_token_id: env.consent_token_id,
    policy_id: env.policy?.id ?? null,
    policy_version: env.policy?.version ?? null,
    resource: env.resource,
    reason_codes: args.reason_codes ?? [env.reason_code],
    payload_hash: args.payload_hash,
    pii_included: false,
    content_included: false,
  };
}

/** Map the consent decision to the matching live webhook event type. */
export function consentDecisionToWebhookEventType(
  decision: ConsentDecisionEnvelope['decision'],
): WebhookEventType {
  switch (decision) {
    case 'approved':
      return 'parental_consent.approved';
    case 'denied':
      return 'parental_consent.denied';
    case 'needs_review':
      return 'parental_consent.needs_review';
    case 'pending':
      return 'parental_consent.session_created';
    case 'blocked_by_policy':
      return 'parental_consent.denied';
  }
}
