// Pure Safety Signals decision engine.
//
// Given an ingest payload, the relationship type, the aggregate snapshot,
// the consent status (when the rule asks for it) and the active rule list,
// returns a `SafetyDecisionEnvelope`. No I/O.
//
// Reference: docs/modules/safety-signals/PRD.md §Decision flow

import { REASON_CODES } from '../reason-codes.ts';
import type {
  SafetyDecision,
  SafetyEventType,
  SafetyChannelType,
  SafetyAgeState,
  SafetyRelationshipType,
  SafetySeverity,
  SafetyRiskCategory,
} from './safety-types.ts';
import {
  SAFETY_DECISION_DOMAIN,
  SAFETY_RISK_CATEGORIES,
} from './safety-types.ts';
import {
  SAFETY_ENVELOPE_VERSION,
  assertSafetyEnvelopeIsPublicSafe,
} from './safety-envelope.ts';
import type { SafetyDecisionEnvelope } from './safety-envelope.ts';
import {
  evaluateRule,
  type RuleAction,
  type RuleContext,
  type SafetyRuleDefinition,
} from './safety-rules.ts';

const SEVERITY_RANK: Record<SafetySeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const VERB_TO_DECISION: Record<RuleAction['verb'], SafetyDecision> = {
  allow: 'approved',
  rate_limit: 'rate_limited',
  soft_block: 'soft_blocked',
  hard_block: 'hard_blocked',
  create_alert: 'needs_review',
  queue_for_human_review: 'needs_review',
  notify_tenant_webhook: 'approved',
  require_step_up_age_assurance: 'step_up_required',
  require_parental_consent_check: 'parental_consent_required',
  warn_user: 'approved',
};

const DECISION_RANK: Record<SafetyDecision, number> = {
  approved: 0,
  needs_review: 1,
  step_up_required: 2,
  parental_consent_required: 3,
  rate_limited: 4,
  soft_blocked: 5,
  hard_blocked: 6,
  blocked_by_policy: 7,
  error: 8,
};

export function deriveRelationship(
  actor: SafetyAgeState,
  counterparty: SafetyAgeState,
): SafetyRelationshipType {
  const isMinor = (s: SafetyAgeState) =>
    s === 'minor' || s === 'minor_under_13' || s === 'minor_13_to_17';
  const isAdult = (s: SafetyAgeState) =>
    s === 'adult' || s === 'adult_18_plus';
  if (isAdult(actor) && isMinor(counterparty)) return 'adult_to_minor';
  if (isMinor(actor) && isAdult(counterparty)) return 'minor_to_adult';
  if (isMinor(actor) && isMinor(counterparty)) return 'minor_to_minor';
  if (isAdult(actor) && isAdult(counterparty)) return 'adult_to_adult';
  if (counterparty === 'unknown' && isMinor(actor)) return 'minor_to_unknown';
  if (actor === 'unknown' && isMinor(counterparty)) return 'unknown_to_minor';
  return 'unknown_to_unknown';
}

export interface EvaluateSafetyInput {
  tenant_id: string;
  application_id: string;
  safety_event_id: string | null;
  safety_alert_id: string | null;
  interaction_id: string | null;
  verification_session_id: string | null;
  consent_request_id: string | null;
  event_type: SafetyEventType;
  channel_type: SafetyChannelType;
  actor_age_state: SafetyAgeState;
  counterparty_age_state: SafetyAgeState;
  actor_ref_hmac: string;
  counterparty_ref_hmac: string | null;
  rules: SafetyRuleDefinition[];
  context: RuleContext;
  /** Tenant-scoped score (0–1). Optional. */
  score?: number | null;
  /** Unix seconds. */
  now_seconds?: number;
}

/**
 * Pure evaluation. Returns the safety decision envelope (validated +
 * privacy-guard checked) based on the highest-severity rule that matched.
 * If no rule matches, returns an `approved / SAFETY_OK` envelope.
 */
export function buildSafetyDecisionEnvelope(
  input: EvaluateSafetyInput,
): SafetyDecisionEnvelope {
  const matched = input.rules
    .filter((r) => r.enabled)
    .filter((r) => evaluateRule(r.condition, input.context));

  let decision: SafetyDecision = 'approved';
  let severity: SafetySeverity = 'low';
  let riskCategory: SafetyRiskCategory = 'unknown';
  const reasonCodes = new Set<string>();
  const actions = new Set<string>();
  let stepUpRequired = false;
  let parentalConsentRequired = false;
  let ttlSeconds: number | null = null;

  if (matched.length === 0) {
    reasonCodes.add(REASON_CODES.SAFETY_OK);
  } else {
    for (const rule of matched) {
      for (const action of rule.actions) {
        actions.add(action.verb);
        reasonCodes.add(action.reason_code);
        const candidate = VERB_TO_DECISION[action.verb];
        if (DECISION_RANK[candidate] > DECISION_RANK[decision]) {
          decision = candidate;
        }
        if (SEVERITY_RANK[action.severity] > SEVERITY_RANK[severity]) {
          severity = action.severity;
        }
        if (
          (SAFETY_RISK_CATEGORIES as readonly string[]).includes(
            action.risk_category,
          )
        ) {
          riskCategory = action.risk_category as SafetyRiskCategory;
        }
        if (action.verb === 'require_step_up_age_assurance') {
          stepUpRequired = true;
        }
        if (action.verb === 'require_parental_consent_check') {
          parentalConsentRequired = true;
        }
        if (
          typeof action.ttl_seconds === 'number' &&
          (ttlSeconds === null || action.ttl_seconds > ttlSeconds)
        ) {
          ttlSeconds = action.ttl_seconds;
        }
      }
    }
  }

  const issuedAt = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const relationship = deriveRelationship(
    input.actor_age_state,
    input.counterparty_age_state,
  );

  const envelope: SafetyDecisionEnvelope = {
    envelope_version: SAFETY_ENVELOPE_VERSION,
    decision_domain: SAFETY_DECISION_DOMAIN,
    tenant_id: input.tenant_id,
    application_id: input.application_id,
    safety_event_id: input.safety_event_id,
    safety_alert_id: input.safety_alert_id,
    interaction_id: input.interaction_id,
    verification_session_id: input.verification_session_id,
    consent_request_id: input.consent_request_id,
    decision,
    severity,
    risk_category: riskCategory,
    reason_codes: Array.from(reasonCodes),
    event_type: input.event_type,
    channel_type: input.channel_type,
    relationship_type: relationship,
    actor_age_state: input.actor_age_state,
    counterparty_age_state: input.counterparty_age_state,
    actor_ref_hmac: input.actor_ref_hmac,
    counterparty_ref_hmac: input.counterparty_ref_hmac,
    score: input.score ?? null,
    step_up_required: stepUpRequired,
    parental_consent_required: parentalConsentRequired,
    actions: Array.from(actions),
    ttl_seconds: ttlSeconds,
    issued_at: issuedAt,
    pii_included: false,
    content_included: false,
  };

  return assertSafetyEnvelopeIsPublicSafe(envelope);
}

export { SAFETY_ENVELOPE_VERSION };
