// Webhook event taxonomy and payload schemas.
//
// Mirrors the event types built by `build_verification_event_payload()` in
// `supabase/migrations/012_webhook_enqueue.sql`. Every payload here is
// public-safe: no PII, no civic identifiers, no proof artifacts.
//
// Reserved Consent and Safety events are listed for forward compatibility
// (subscribers can register them today) but are NOT yet emitted.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Webhook taxonomy.

import { z } from 'zod';
import {
  AssuranceLevelSchema,
  UuidSchema,
  VerificationDecisionSchema,
  VerificationMethodSchema,
} from '../schemas/common.ts';

/** Live event types emitted by the Core today. */
export const WEBHOOK_EVENT_TYPES = {
  VERIFICATION_APPROVED: 'verification.approved',
  VERIFICATION_DENIED: 'verification.denied',
  VERIFICATION_NEEDS_REVIEW: 'verification.needs_review',
  TOKEN_REVOKED: 'token.revoked',
  // Parental Consent module — promoted from RESERVED to LIVE in Round 3.
  PARENTAL_CONSENT_SESSION_CREATED: 'parental_consent.session_created',
  PARENTAL_CONSENT_GUARDIAN_INVITED: 'parental_consent.guardian_invited',
  PARENTAL_CONSENT_GUARDIAN_VERIFIED: 'parental_consent.guardian_verified',
  PARENTAL_CONSENT_APPROVED: 'parental_consent.approved',
  PARENTAL_CONSENT_DENIED: 'parental_consent.denied',
  PARENTAL_CONSENT_NEEDS_REVIEW: 'parental_consent.needs_review',
  PARENTAL_CONSENT_EXPIRED: 'parental_consent.expired',
  PARENTAL_CONSENT_REVOKED: 'parental_consent.revoked',
  // Safety Signals module — promoted from RESERVED to LIVE in Round 4.
  SAFETY_EVENT_INGESTED: 'safety.event_ingested',
  SAFETY_ALERT_CREATED: 'safety.alert_created',
  SAFETY_ALERT_UPDATED: 'safety.alert_updated',
  SAFETY_STEP_UP_REQUIRED: 'safety.step_up_required',
  SAFETY_PARENTAL_CONSENT_CHECK_REQUIRED:
    'safety.parental_consent_check_required',
  SAFETY_RISK_FLAGGED: 'safety.risk_flagged',
} as const;

export type WebhookEventType =
  (typeof WEBHOOK_EVENT_TYPES)[keyof typeof WEBHOOK_EVENT_TYPES];

/**
 * Reserved event types for future modules. Empty after Round 4 promoted
 * the safety.* namespace to LIVE in WEBHOOK_EVENT_TYPES.
 */
export const RESERVED_WEBHOOK_EVENT_TYPES = {} as const;

export type ReservedWebhookEventType =
  (typeof RESERVED_WEBHOOK_EVENT_TYPES)[keyof typeof RESERVED_WEBHOOK_EVENT_TYPES];

export const WebhookEventTypeSchema = z.enum([
  WEBHOOK_EVENT_TYPES.VERIFICATION_APPROVED,
  WEBHOOK_EVENT_TYPES.VERIFICATION_DENIED,
  WEBHOOK_EVENT_TYPES.VERIFICATION_NEEDS_REVIEW,
  WEBHOOK_EVENT_TYPES.TOKEN_REVOKED,
]);

/**
 * Verification.* event payload (the most common case). Matches the JSON the
 * SQL trigger writes into `webhook_deliveries.payload_json`.
 */
export const WebhookVerificationEventSchema = z
  .object({
    event_id: UuidSchema,
    event_type: z.enum([
      WEBHOOK_EVENT_TYPES.VERIFICATION_APPROVED,
      WEBHOOK_EVENT_TYPES.VERIFICATION_DENIED,
      WEBHOOK_EVENT_TYPES.VERIFICATION_NEEDS_REVIEW,
    ]),
    tenant_id: UuidSchema,
    session_id: UuidSchema,
    application_id: UuidSchema,
    decision: VerificationDecisionSchema,
    reason_code: z.string().min(1).max(64),
    method: VerificationMethodSchema,
    assurance_level: AssuranceLevelSchema,
    threshold_satisfied: z.boolean(),
    jti: UuidSchema.nullable(),
    created_at: z.string().datetime(),
  })
  .strict();

export type WebhookVerificationEvent = z.infer<
  typeof WebhookVerificationEventSchema
>;

/** Token revocation payload. */
export const WebhookTokenRevokedEventSchema = z
  .object({
    event_id: UuidSchema,
    event_type: z.literal(WEBHOOK_EVENT_TYPES.TOKEN_REVOKED),
    tenant_id: UuidSchema,
    application_id: UuidSchema,
    jti: UuidSchema,
    reason: z.string().min(1).max(500),
    revoked_at: z.string().datetime(),
  })
  .strict();

export type WebhookTokenRevokedEvent = z.infer<
  typeof WebhookTokenRevokedEventSchema
>;

/**
 * Parental Consent module event payload. Public-safe by construction:
 * no contact, no name, no document, no birthdate. The `consent_token_id`
 * (jti of the parental_consent_token) is a UUID, never a JWT body.
 *
 * `payload_hash` is a SHA-256 hex of the canonical envelope so the receiver
 * can verify the event was not mutated in flight.
 */
export const WebhookParentalConsentEventSchema = z
  .object({
    event_id: UuidSchema,
    event_type: z.enum([
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_SESSION_CREATED,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_GUARDIAN_INVITED,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_GUARDIAN_VERIFIED,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_APPROVED,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_DENIED,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_NEEDS_REVIEW,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_EXPIRED,
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_REVOKED,
    ]),
    created_at: z.string().datetime(),
    tenant_id: UuidSchema,
    application_id: UuidSchema,
    decision: z.enum([
      'approved',
      'denied',
      'needs_review',
      'pending',
      'revoked',
      'expired',
      'blocked_by_policy',
    ]),
    consent_request_id: UuidSchema,
    consent_token_id: UuidSchema.nullable(),
    policy_id: UuidSchema.nullable(),
    policy_version: z.number().int().positive().nullable(),
    resource: z.string().min(1).max(128),
    reason_codes: z.array(z.string().min(1).max(64)).min(1),
    payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();

export type WebhookParentalConsentEvent = z.infer<
  typeof WebhookParentalConsentEventSchema
>;

/**
 * Safety Signals event payload. METADATA-ONLY by construction:
 *   * no raw text, no media, no IP plaintext;
 *   * no PII keys (privacy guard rejects them on egress);
 *   * `payload_hash` anchors the canonical envelope hash for tamper-evidence.
 */
export const WebhookSafetyEventSchema = z
  .object({
    event_id: UuidSchema,
    event_type: z.enum([
      WEBHOOK_EVENT_TYPES.SAFETY_EVENT_INGESTED,
      WEBHOOK_EVENT_TYPES.SAFETY_ALERT_CREATED,
      WEBHOOK_EVENT_TYPES.SAFETY_ALERT_UPDATED,
      WEBHOOK_EVENT_TYPES.SAFETY_STEP_UP_REQUIRED,
      WEBHOOK_EVENT_TYPES.SAFETY_PARENTAL_CONSENT_CHECK_REQUIRED,
      WEBHOOK_EVENT_TYPES.SAFETY_RISK_FLAGGED,
    ]),
    created_at: z.string().datetime(),
    tenant_id: UuidSchema,
    application_id: UuidSchema,
    decision: z.enum([
      'approved',
      'needs_review',
      'step_up_required',
      'rate_limited',
      'soft_blocked',
      'hard_blocked',
      'blocked_by_policy',
      'parental_consent_required',
      'error',
    ]),
    safety_alert_id: UuidSchema.nullable(),
    safety_event_id: UuidSchema.nullable(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    risk_category: z.string().min(1).max(64),
    policy_id: UuidSchema.nullable(),
    policy_version: z.number().int().positive().nullable(),
    reason_codes: z.array(z.string().min(1).max(64)).min(1),
    payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();

export type WebhookSafetyEvent = z.infer<typeof WebhookSafetyEventSchema>;

/** Discriminated union over all live webhook payload shapes. */
export const WebhookEventPayloadSchema = z.discriminatedUnion('event_type', [
  WebhookVerificationEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.VERIFICATION_APPROVED),
  }),
  WebhookVerificationEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.VERIFICATION_DENIED),
  }),
  WebhookVerificationEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.VERIFICATION_NEEDS_REVIEW),
  }),
  WebhookTokenRevokedEventSchema,
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_SESSION_CREATED),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_GUARDIAN_INVITED,
    ),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(
      WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_GUARDIAN_VERIFIED,
    ),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_APPROVED),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_DENIED),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_NEEDS_REVIEW),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_EXPIRED),
  }),
  WebhookParentalConsentEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.PARENTAL_CONSENT_REVOKED),
  }),
  WebhookSafetyEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.SAFETY_EVENT_INGESTED),
  }),
  WebhookSafetyEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.SAFETY_ALERT_CREATED),
  }),
  WebhookSafetyEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.SAFETY_ALERT_UPDATED),
  }),
  WebhookSafetyEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.SAFETY_STEP_UP_REQUIRED),
  }),
  WebhookSafetyEventSchema.extend({
    event_type: z.literal(
      WEBHOOK_EVENT_TYPES.SAFETY_PARENTAL_CONSENT_CHECK_REQUIRED,
    ),
  }),
  WebhookSafetyEventSchema.extend({
    event_type: z.literal(WEBHOOK_EVENT_TYPES.SAFETY_RISK_FLAGGED),
  }),
]);

export type WebhookEventPayload = z.infer<typeof WebhookEventPayloadSchema>;

/** Returns true if the event_type targets a parental_consent.* event. */
export function isParentalConsentEventType(
  eventType: string,
): eventType is WebhookParentalConsentEvent['event_type'] {
  return eventType.startsWith('parental_consent.');
}

/** Returns true if the event_type targets a safety.* event. */
export function isSafetyEventType(
  eventType: string,
): eventType is WebhookSafetyEvent['event_type'] {
  return eventType.startsWith('safety.');
}

/** Returns true if the event_type belongs to the live (emitted) catalog. */
export function isLiveWebhookEventType(
  eventType: string,
): eventType is WebhookEventType {
  return Object.values(WEBHOOK_EVENT_TYPES).includes(
    eventType as WebhookEventType,
  );
}

/** Returns true if the event_type is reserved for Consent or Safety. */
export function isReservedWebhookEventType(
  eventType: string,
): eventType is ReservedWebhookEventType {
  return Object.values(RESERVED_WEBHOOK_EVENT_TYPES).includes(
    eventType as ReservedWebhookEventType,
  );
}
