// AgeKey Safety Signals — public ingest contract.
//
// **METADATA-ONLY**. The ingest path is the single most sensitive boundary
// of the module: anything sent here that resembles raw content or PII must
// be **rejected**, not minimised silently.
//
// This file declares:
//   * `SafetyEventIngestRequestSchema` — accepts only metadata.
//   * `FORBIDDEN_INGEST_KEYS`         — hard-list checked BEFORE Zod parse,
//     with an explicit reason code (`SAFETY_RAW_CONTENT_REJECTED` /
//     `SAFETY_PII_DETECTED`) so the relying party knows exactly what
//     went wrong.
//   * helpers `rejectForbiddenIngestKeys`, `assertNoRawContent`.
//
// Reference: docs/modules/safety-signals/API_CONTRACT.md
//            docs/modules/safety-signals/PRIVACY_GUARD.md

import { z } from 'zod';
import { UuidSchema, LocaleSchema } from '../schemas/common.ts';
import { REASON_CODES } from '../reason-codes.ts';
import {
  SafetyAgeStateSchema,
  SafetyChannelTypeSchema,
  SafetyEventTypeSchema,
} from './safety-types.ts';

export const Sha256HexLooseSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/u, { message: 'expected 64-char hex' })
  .transform((s) => s.toLowerCase());

/**
 * Keys that MUST NOT appear at any depth of the ingest payload. Checked by
 * `rejectForbiddenIngestKeys` BEFORE Zod parsing so the boundary error
 * carries the dedicated reason code.
 *
 * Two groups:
 *   * Raw content keys — block content_processed=false invariant.
 *   * PII keys — same canonical list as the privacy guard (subset relevant
 *     to ingest; the privacy guard is still applied on egress for defense
 *     in depth).
 */
export const FORBIDDEN_INGEST_RAW_CONTENT_KEYS = [
  'message',
  'raw_text',
  'text',
  'body',
  'content',
  'image',
  'image_data',
  'video',
  'video_data',
  'audio',
  'audio_data',
  'attachment',
  'attachment_data',
  'transcript',
  'caption',
] as const;

export const FORBIDDEN_INGEST_PII_KEYS = [
  'birthdate',
  'date_of_birth',
  'dob',
  'birth_date',
  'birthday',
  'data_nascimento',
  'nascimento',
  'idade',
  'age',
  'exact_age',
  'document',
  'cpf',
  'cnh',
  'rg',
  'passport',
  'passport_number',
  'id_number',
  'civil_id',
  'social_security',
  'ssn',
  'name',
  'full_name',
  'nome',
  'nome_completo',
  'first_name',
  'last_name',
  'email',
  'phone',
  'mobile',
  'telefone',
  'address',
  'endereco',
  'street',
  'postcode',
  'zipcode',
  'selfie',
  'face',
  'face_image',
  'biometric',
  'biometrics',
  'raw_id',
  'latitude',
  'longitude',
  'gps',
  'lat',
  'lng',
  'lon',
] as const;

function canonicalize(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

const RAW_CONTENT_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_INGEST_RAW_CONTENT_KEYS.map(canonicalize),
);
const PII_SET: ReadonlySet<string> = new Set(
  FORBIDDEN_INGEST_PII_KEYS.map(canonicalize),
);

export interface ForbiddenIngestKey {
  path: string;
  key: string;
  category: 'raw_content' | 'pii';
}

export function findForbiddenIngestKeys(
  payload: unknown,
): ForbiddenIngestKey[] {
  const out: ForbiddenIngestKey[] = [];
  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const canon = canonicalize(key);
      if (RAW_CONTENT_SET.has(canon)) {
        out.push({ path: `${path}.${key}`, key, category: 'raw_content' });
      } else if (PII_SET.has(canon)) {
        out.push({ path: `${path}.${key}`, key, category: 'pii' });
      }
      visit(child, `${path}.${key}`);
    }
  }
  visit(payload, '$');
  return out;
}

/** Returns the matching reason code for the first violation, or null. */
export function rejectForbiddenIngestKeys(
  payload: unknown,
): { reasonCode: string; offending: ForbiddenIngestKey[] } | null {
  const offending = findForbiddenIngestKeys(payload);
  if (offending.length === 0) return null;
  // raw content takes precedence; PII otherwise.
  const hasRaw = offending.some((o) => o.category === 'raw_content');
  return {
    reasonCode: hasRaw
      ? REASON_CODES.SAFETY_RAW_CONTENT_REJECTED
      : REASON_CODES.SAFETY_PII_DETECTED,
    offending,
  };
}

/** Bounded "small JSON" object: Records of primitives only, no nesting. */
const PrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const SmallMetadataSchema = z
  .record(z.string().max(64), PrimitiveSchema)
  .refine(
    (obj) => Object.keys(obj).length <= 16,
    { message: 'metadata may carry at most 16 keys' },
  );

/**
 * Public ingest body. Every field is optional except the bare minimum
 * needed for routing (`application_id`, `event_type`, `actor_external_ref`,
 * `occurred_at`).
 */
export const SafetyEventIngestRequestSchema = z
  .object({
    application_id: UuidSchema,
    client_event_id: z.string().min(8).max(128).optional(),
    event_type: SafetyEventTypeSchema,
    occurred_at: z.string().datetime(),

    actor_external_ref: z.string().min(8).max(256),
    counterparty_external_ref: z.string().min(8).max(256).optional(),

    actor_age_state: SafetyAgeStateSchema.default('unknown'),
    counterparty_age_state: SafetyAgeStateSchema.default('unknown'),

    interaction_ref: z.string().min(1).max(128).optional(),
    channel_type: SafetyChannelTypeSchema.default('unknown'),

    /** Optional. The backend hashes immediately. NEVER stored as plaintext. */
    ip: z.string().ip().optional(),
    user_agent: z.string().max(512).optional(),
    device_external_ref: z.string().min(1).max(128).optional(),

    duration_ms: z.number().int().nonnegative().max(7 * 24 * 3600 * 1000)
      .optional(),

    /** SHA-256 hex of an artefact computed CLIENT-side. The artefact itself
     *  is NOT uploaded by Safety v1; only its hash is referenced. */
    artifact_hash: Sha256HexLooseSchema.optional(),
    artifact_type: z.string().min(1).max(64).optional(),

    /** Always `false` on Safety v1. Schema literal locks the wire format. */
    content_processed: z.literal(false).default(false),
    content_stored: z.literal(false).default(false),

    locale: LocaleSchema.optional(),

    /** Bounded metadata. PII / content keys are rejected by
     *  `rejectForbiddenIngestKeys` before Zod sees the payload. */
    metadata: SmallMetadataSchema.optional(),
  })
  .strict();

export type SafetyEventIngestRequest = z.infer<
  typeof SafetyEventIngestRequestSchema
>;

/** Public response from `POST /v1/safety/event-ingest`. */
export const SafetyEventIngestResponseSchema = z
  .object({
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
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    risk_category: z.string().min(1).max(64),
    reason_codes: z.array(z.string().min(1).max(64)).min(1),
    safety_event_id: UuidSchema.nullable(),
    safety_alert_id: UuidSchema.nullable(),
    step_up_required: z.boolean(),
    parental_consent_required: z.boolean(),
    actions: z.array(z.string().min(1).max(64)).default([]),
    ttl_seconds: z.number().int().nonnegative().nullable(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();

export type SafetyEventIngestResponse = z.infer<
  typeof SafetyEventIngestResponseSchema
>;
