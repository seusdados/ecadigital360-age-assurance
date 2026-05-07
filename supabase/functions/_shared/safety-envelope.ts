// Edge-function adapter for the canonical Safety Decision Envelope.
//
// Wraps the pure builder from `@agekey/shared/safety` so the edge functions
// have a single helper that produces a Safety envelope from the runtime
// types they already loaded (subjects, interactions, aggregates).
//
// Reference: docs/modules/safety-signals/EDGE_FUNCTIONS.md

export {
  SAFETY_ENVELOPE_VERSION,
  SAFETY_DECISION_DOMAIN,
  SafetyDecisionEnvelopeSchema,
  assertSafetyEnvelopeIsPublicSafe,
  buildSafetyDecisionEnvelope,
  computeSafetyEnvelopePayloadHash,
  deriveRelationship,
  safetyDecisionToWebhookEventType,
  safetyEnvelopeAuditDiff,
  safetyEnvelopeWebhookPayload,
  safetyEnvelopeLogFields,
  SYSTEM_SAFETY_RULES,
  evaluateRule,
} from '../../../packages/shared/src/safety/index.ts';

export type {
  SafetyDecisionEnvelope,
} from '../../../packages/shared/src/safety/index.ts';
