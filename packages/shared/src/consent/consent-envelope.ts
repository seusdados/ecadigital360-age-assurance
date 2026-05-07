// Parental Consent — Decision Envelope.
//
// Peer of `decision/decision-envelope.ts`. The two envelopes share:
//   * the canonical privacy guard (`assertPublicPayloadHasNoPii`)
//   * the `envelope_version` discipline
//   * the JWT signing surface (`envelopeToConsentTokenClaims`)
//   * the audit projection pattern (whitelist, no PII, no contact)
//
// They differ on the decision domain itself: the age-verify envelope carries
// `age_threshold` and `method`; the consent envelope carries `resource`,
// `purpose_codes`, `data_categories` and `assurance_level` (always referring
// to the GUARDIAN channel, never to the minor).
//
// THE CONSENT ENVELOPE NEVER CARRIES PII:
//   * no guardian email or phone (only `guardian_ref_hmac`),
//   * no minor name, document or birthdate (only `subject_ref_hmac`),
//   * no exact age (only the policy-level `age_threshold` if relevant),
//   * no plaintext OTP, no contact ciphertext.
//
// Reference: docs/modules/parental-consent/architecture.md
//            docs/modules/parental-consent/data-model.md
//            docs/modules/parental-consent/security.md

import { z } from 'zod';
import {
  AssuranceLevelSchema,
  UuidSchema,
} from '../schemas/common.ts';
import { assertPublicPayloadHasNoPii } from '../privacy-guard.ts';
import {
  CONSENT_DECISION_DOMAIN,
  ConsentDataCategorySchema,
  ConsentDecisionSchema,
  ConsentPurposeCodeSchema,
  ConsentRiskTierSchema,
  GuardianVerificationMethodSchema,
} from './consent-types.ts';

/** Bumped whenever a non-additive change ships in the consent envelope. */
export const CONSENT_ENVELOPE_VERSION = 1;

export const ConsentPolicyRefSchema = z
  .object({
    id: UuidSchema,
    slug: z.string().min(1).max(64),
    version: z.number().int().positive(),
  })
  .strict();

export type ConsentPolicyRef = z.infer<typeof ConsentPolicyRefSchema>;

/** Hex SHA-256. Both `subject_ref_hmac` and `guardian_ref_hmac` must be 32-byte
 *  HMAC-SHA256 outputs (per-tenant key) so they cannot be linked across
 *  tenants. The schema accepts the raw hex (lowercase) to keep the wire format
 *  uniform across SQL and TS. */
export const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/u, { message: 'expected 64-char lowercase hex' });

/**
 * Resource the consent grants access to. Free string but bounded; the engine
 * matches it case-sensitively against the rely-party's request, so the wire
 * spelling must be stable across tenant + application + version.
 */
export const ConsentResourceSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_:.\-]{0,127}$/u, {
    message:
      'resource must be lowercase, start alphanumeric and contain only [a-z0-9_:.\\-]',
  });

export const ConsentDecisionEnvelopeSchema = z
  .object({
    envelope_version: z.literal(CONSENT_ENVELOPE_VERSION),
    decision_domain: z.literal(CONSENT_DECISION_DOMAIN),

    tenant_id: UuidSchema,
    application_id: UuidSchema,
    consent_request_id: UuidSchema,
    parental_consent_id: UuidSchema.nullable(),
    consent_token_id: UuidSchema.nullable(),
    /** verification_session_id from `verification_sessions`, when the request
     *  is bound to an age-verify session (e.g. age gate triggered consent). */
    verification_session_id: UuidSchema.nullable(),

    policy: ConsentPolicyRefSchema.nullable(),

    decision: ConsentDecisionSchema,
    /** Verbatim canonical reason code (e.g. `CONSENT_GRANTED`,
     *  `CONSENT_GUARDIAN_NOT_VERIFIED`). Never a free-form sentence. */
    reason_code: z.string().min(1).max(64),

    resource: ConsentResourceSchema,
    /** Tenant-defined sub-resource scope. Optional; never PII. */
    scope: z.string().max(256).nullable(),
    purpose_codes: z.array(ConsentPurposeCodeSchema).min(1),
    data_categories: z.array(ConsentDataCategorySchema).min(1),
    risk_tier: ConsentRiskTierSchema,

    /** Method used to verify the GUARDIAN channel. `null` until verified. */
    guardian_verification_method:
      GuardianVerificationMethodSchema.nullable(),
    /** Assurance of the GUARDIAN channel. `null` until verified. */
    assurance_level: AssuranceLevelSchema.nullable(),

    /** SHA-256 of the consent text version the guardian accepted. `null`
     *  until acceptance. Combined with `policy.version` and `proof_hash` it
     *  forms the consent receipt's tamper-evident anchor. */
    consent_text_hash: Sha256HexSchema.nullable(),
    /** SHA-256 of the canonical consent record (subject_ref || guardian_ref ||
     *  resource || consent_text_hash || issued_at). `null` until acceptance. */
    proof_hash: Sha256HexSchema.nullable(),

    /** Opaque per-tenant identifiers. NEVER PII. */
    subject_ref_hmac: Sha256HexSchema,
    guardian_ref_hmac: Sha256HexSchema.nullable(),

    /** Unix seconds. */
    issued_at: z.number().int().positive(),
    expires_at: z.number().int().positive(),

    /** Always `false` on this surface. The privacy guard enforces it. */
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict()
  .superRefine((env, ctx) => {
    if (env.expires_at <= env.issued_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expires_at must be strictly greater than issued_at',
        path: ['expires_at'],
      });
    }
    if (env.decision === 'approved') {
      const required: ReadonlyArray<readonly [keyof typeof env, unknown]> = [
        ['parental_consent_id', env.parental_consent_id],
        ['guardian_ref_hmac', env.guardian_ref_hmac],
        ['guardian_verification_method', env.guardian_verification_method],
        ['assurance_level', env.assurance_level],
        ['consent_text_hash', env.consent_text_hash],
        ['proof_hash', env.proof_hash],
      ];
      for (const [field, value] of required) {
        if (value == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${String(field)} is required when decision = approved`,
            path: [field as string],
          });
        }
      }
    }
  });

export type ConsentDecisionEnvelope = z.infer<
  typeof ConsentDecisionEnvelopeSchema
>;

/**
 * Build + validate + privacy-guard. Mirror of `assertDecisionEnvelopeIsPublicSafe`
 * for the consent envelope. The privacy guard is allowed to see the schema
 * keys (`subject_ref_hmac`, `guardian_ref_hmac`, `consent_text_hash`,
 * `proof_hash`) because none of those overlap with the canonical PII
 * blacklist; if a future refactor introduces a key that DOES overlap, the
 * guard refuses the envelope before it crosses any boundary.
 */
export function assertConsentEnvelopeIsPublicSafe(
  envelope: ConsentDecisionEnvelope,
): ConsentDecisionEnvelope {
  const parsed = ConsentDecisionEnvelopeSchema.parse(envelope);
  assertPublicPayloadHasNoPii(parsed);
  return parsed;
}
