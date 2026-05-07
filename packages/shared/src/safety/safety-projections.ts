// Safety Signals — projections for response, webhook, audit and log.
//
// Mirrors `consent-projections.ts` and `decision-envelope.ts` projections.
// Every projection is constructive (whitelist) — privacy guard is the
// enforcement layer.

import type {
  WebhookEventType,
  WebhookSafetyEvent,
} from '../webhooks/webhook-types.ts';
import type { SafetyDecisionEnvelope } from './safety-envelope.ts';
import { SAFETY_DECISION_DOMAIN } from './safety-types.ts';

const TEXT_ENCODER =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export async function computeSafetyEnvelopePayloadHash(
  envelope: SafetyDecisionEnvelope,
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
 * decision, severity, reason codes; no `actor_ref_hmac` or
 * `counterparty_ref_hmac` echo.
 */
export interface SafetyEnvelopeAuditDiff {
  decision_domain: typeof SAFETY_DECISION_DOMAIN;
  envelope_version: number;
  decision: SafetyDecisionEnvelope['decision'];
  severity: SafetyDecisionEnvelope['severity'];
  risk_category: SafetyDecisionEnvelope['risk_category'];
  reason_codes: string[];
  event_type: SafetyDecisionEnvelope['event_type'];
  channel_type: SafetyDecisionEnvelope['channel_type'];
  relationship_type: SafetyDecisionEnvelope['relationship_type'];
  actor_age_state: SafetyDecisionEnvelope['actor_age_state'];
  counterparty_age_state: SafetyDecisionEnvelope['counterparty_age_state'];
  safety_event_id: string | null;
  safety_alert_id: string | null;
  interaction_id: string | null;
  verification_session_id: string | null;
  consent_request_id: string | null;
  step_up_required: boolean;
  parental_consent_required: boolean;
  actions: string[];
  ttl_seconds: number | null;
  score: number | null;
  issued_at: number;
  payload_hash: string;
  content_included: false;
  pii_included: false;
}

export function safetyEnvelopeAuditDiff(
  envelope: SafetyDecisionEnvelope,
  payloadHash: string,
): SafetyEnvelopeAuditDiff {
  return {
    decision_domain: SAFETY_DECISION_DOMAIN,
    envelope_version: envelope.envelope_version,
    decision: envelope.decision,
    severity: envelope.severity,
    risk_category: envelope.risk_category,
    reason_codes: envelope.reason_codes,
    event_type: envelope.event_type,
    channel_type: envelope.channel_type,
    relationship_type: envelope.relationship_type,
    actor_age_state: envelope.actor_age_state,
    counterparty_age_state: envelope.counterparty_age_state,
    safety_event_id: envelope.safety_event_id,
    safety_alert_id: envelope.safety_alert_id,
    interaction_id: envelope.interaction_id,
    verification_session_id: envelope.verification_session_id,
    consent_request_id: envelope.consent_request_id,
    step_up_required: envelope.step_up_required,
    parental_consent_required: envelope.parental_consent_required,
    actions: envelope.actions,
    ttl_seconds: envelope.ttl_seconds,
    score: envelope.score,
    issued_at: envelope.issued_at,
    payload_hash: payloadHash,
    content_included: false,
    pii_included: false,
  };
}

export function safetyEnvelopeLogFields(
  envelope: SafetyDecisionEnvelope,
  payloadHash: string,
): SafetyEnvelopeAuditDiff {
  return safetyEnvelopeAuditDiff(envelope, payloadHash);
}

/**
 * Build a webhook payload from the envelope. Public-safe by construction.
 */
export function safetyEnvelopeWebhookPayload(args: {
  event_id: string;
  event_type: WebhookSafetyEvent['event_type'];
  envelope: SafetyDecisionEnvelope;
  payload_hash: string;
  policy_id?: string | null;
  policy_version?: number | null;
  created_at?: string;
}): WebhookSafetyEvent {
  const env = args.envelope;
  return {
    event_id: args.event_id,
    event_type: args.event_type,
    created_at: args.created_at ?? new Date(env.issued_at * 1000).toISOString(),
    tenant_id: env.tenant_id,
    application_id: env.application_id,
    decision: env.decision,
    safety_alert_id: env.safety_alert_id,
    safety_event_id: env.safety_event_id,
    severity: env.severity,
    risk_category: env.risk_category,
    policy_id: args.policy_id ?? null,
    policy_version: args.policy_version ?? null,
    reason_codes: env.reason_codes,
    payload_hash: args.payload_hash,
    pii_included: false,
    content_included: false,
  };
}

export function safetyDecisionToWebhookEventType(
  decision: SafetyDecisionEnvelope['decision'],
): WebhookEventType {
  switch (decision) {
    case 'approved':
      return 'safety.event_ingested';
    case 'needs_review':
      return 'safety.alert_created';
    case 'step_up_required':
      return 'safety.step_up_required';
    case 'parental_consent_required':
      return 'safety.parental_consent_check_required';
    case 'rate_limited':
    case 'soft_blocked':
    case 'hard_blocked':
    case 'blocked_by_policy':
      return 'safety.risk_flagged';
    case 'error':
      return 'safety.event_ingested';
  }
}
