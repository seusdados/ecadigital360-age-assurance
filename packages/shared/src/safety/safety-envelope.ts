// AgeKey Safety Signals — Decision Envelope.
//
// Peer of the age-verify and parental-consent envelopes. Reuses the
// canonical privacy guard, the envelope_version discipline and the audit
// projection pattern. The shape is metadata-only by construction:
//   * no raw text / image / video / audio fields,
//   * no PII keys,
//   * actor/counterparty refs are HMAC hex (`*_ref_hmac`),
//   * IP/device refs are HMAC hex,
//   * artefacts referenced only by `artifact_hash`.
//
// Reference: docs/modules/safety-signals/DATA_MODEL.md
//            docs/modules/safety-signals/PRIVACY_GUARD.md

import { z } from 'zod';
import { UuidSchema } from '../schemas/common.ts';
import { assertPublicPayloadHasNoPii } from '../privacy-guard.ts';
import {
  SAFETY_DECISION_DOMAIN,
  SafetyAgeStateSchema,
  SafetyChannelTypeSchema,
  SafetyDecisionSchema,
  SafetyEventTypeSchema,
  SafetyRelationshipTypeSchema,
  SafetyRiskCategorySchema,
  SafetySeveritySchema,
} from './safety-types.ts';

/** Bumped whenever a non-additive change ships in the safety envelope. */
export const SAFETY_ENVELOPE_VERSION = 1;

const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/u, { message: 'expected 64-char lowercase hex' });

export const SafetyDecisionEnvelopeSchema = z
  .object({
    envelope_version: z.literal(SAFETY_ENVELOPE_VERSION),
    decision_domain: z.literal(SAFETY_DECISION_DOMAIN),

    tenant_id: UuidSchema,
    application_id: UuidSchema,
    safety_event_id: UuidSchema.nullable(),
    safety_alert_id: UuidSchema.nullable(),
    interaction_id: UuidSchema.nullable(),
    /** Tied verification_session, when a step-up was requested. */
    verification_session_id: UuidSchema.nullable(),
    /** Tied consent_request_id when the rule asks for parental consent. */
    consent_request_id: UuidSchema.nullable(),

    decision: SafetyDecisionSchema,
    severity: SafetySeveritySchema,
    risk_category: SafetyRiskCategorySchema,
    /** Live reason codes from REASON_CODES (`SAFETY_*`). */
    reason_codes: z.array(z.string().min(1).max(64)).min(1),

    event_type: SafetyEventTypeSchema,
    channel_type: SafetyChannelTypeSchema,
    relationship_type: SafetyRelationshipTypeSchema,

    actor_age_state: SafetyAgeStateSchema,
    counterparty_age_state: SafetyAgeStateSchema,

    actor_ref_hmac: Sha256HexSchema,
    counterparty_ref_hmac: Sha256HexSchema.nullable(),

    /** Tenant-scoped contextual score (0–1). NEVER cross-tenant. */
    score: z.number().min(0).max(1).nullable(),

    /** Step-up handle, when `decision = step_up_required`. */
    step_up_required: z.boolean(),
    parental_consent_required: z.boolean(),

    /** Required action labels for the relying party UI. */
    actions: z.array(z.string().min(1).max(64)).default([]),
    /** Soft TTL the RP can use to throttle the next attempt. */
    ttl_seconds: z.number().int().nonnegative().nullable(),

    issued_at: z.number().int().positive(),
    /** Always `false` on this surface. */
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();

export type SafetyDecisionEnvelope = z.infer<
  typeof SafetyDecisionEnvelopeSchema
>;

export function assertSafetyEnvelopeIsPublicSafe(
  envelope: SafetyDecisionEnvelope,
): SafetyDecisionEnvelope {
  const parsed = SafetyDecisionEnvelopeSchema.parse(envelope);
  assertPublicPayloadHasNoPii(parsed);
  return parsed;
}
