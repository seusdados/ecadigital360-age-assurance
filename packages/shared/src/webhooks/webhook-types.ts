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
} as const;

export type WebhookEventType =
  (typeof WEBHOOK_EVENT_TYPES)[keyof typeof WEBHOOK_EVENT_TYPES];

/**
 * Reserved event types for Consent and Safety. Subscribers can include them
 * in their `events` array; the Core does not emit them yet.
 */
export const RESERVED_WEBHOOK_EVENT_TYPES = {
  CONSENT_GRANTED: 'consent.granted',
  CONSENT_REVOKED: 'consent.revoked',
  SAFETY_RISK_FLAGGED: 'safety.risk_flagged',
} as const;

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
]);

export type WebhookEventPayload = z.infer<typeof WebhookEventPayloadSchema>;

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
