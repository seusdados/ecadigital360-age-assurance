// Decision Envelope — canonical Core output (pre-token).
//
// The Decision Envelope is the deterministic, public-safe summary that the
// Core verifier produces for every session, before any signing happens. It is
// the contract between:
//   1. The internal verifier-core (adapter outputs → policy decision)
//   2. The token signer (envelope → ResultTokenClaims JWT)
//   3. The webhook fan-out (envelope → event payload)
//   4. The audit pipeline (envelope → verification_results row)
//
// Three guarantees:
//   * No PII may live in the envelope (enforced by the privacy guard).
//   * `envelope_version` lets the Consent and Safety modules append fields
//     without breaking older consumers.
//   * The envelope is the only object used to derive the JWT claims, so the
//     two cannot drift.
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Decision envelope.

import { z } from 'zod';
import {
  AssuranceLevelSchema,
  UuidSchema,
  VerificationDecisionSchema,
  VerificationMethodSchema,
} from '../schemas/common.ts';
import { AgeBandSchema, AgeThresholdSchema } from '../taxonomy/age-taxonomy.ts';
import { assertPublicPayloadHasNoPii } from '../privacy-guard.ts';
import type { ResultTokenClaims } from '../schemas/tokens.ts';

/** Bumped whenever a non-additive change ships in the envelope. */
export const DECISION_ENVELOPE_VERSION = 1;

/**
 * Adapter evidence kept after minimisation. Free-form on purpose: every
 * adapter ships its own keys (e.g. `proof_kind`, `nonce_match`). The privacy
 * guard rejects PII keys regardless of where they sit.
 */
export const DecisionAdapterEvidenceSchema = z
  .object({
    format: z.string().max(64).optional(),
    issuer_did: z.string().max(512).optional(),
    nonce_match: z.boolean().optional(),
    proof_kind: z.string().max(64).optional(),
    extra: z
      .record(z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .strict();

export type DecisionAdapterEvidence = z.infer<
  typeof DecisionAdapterEvidenceSchema
>;

export const DecisionPolicyRefSchema = z
  .object({
    id: UuidSchema,
    slug: z.string().min(1).max(64),
    version: z.number().int().positive(),
  })
  .strict();

export type DecisionPolicyRef = z.infer<typeof DecisionPolicyRefSchema>;

export const DecisionEnvelopeSchema = z
  .object({
    envelope_version: z.literal(DECISION_ENVELOPE_VERSION),
    tenant_id: UuidSchema,
    application_id: UuidSchema,
    session_id: UuidSchema,
    policy: DecisionPolicyRefSchema,

    decision: VerificationDecisionSchema,
    threshold_satisfied: z.boolean(),
    age_threshold: AgeThresholdSchema,
    age_band: AgeBandSchema.nullable(),
    method: VerificationMethodSchema,
    assurance_level: AssuranceLevelSchema,
    reason_code: z.string().min(1).max(64),

    evidence: DecisionAdapterEvidenceSchema,

    /** Unix seconds. */
    issued_at: z.number().int().positive(),
    /** Unix seconds. Must be >= issued_at. */
    expires_at: z.number().int().positive(),

    /** Opaque client reference. NEVER PII. May be null. */
    external_user_ref: z.string().min(8).max(256).nullable(),
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
    if (env.decision === 'approved' && env.threshold_satisfied !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'approved decisions require threshold_satisfied = true',
        path: ['threshold_satisfied'],
      });
    }
    if (env.decision === 'denied' && env.threshold_satisfied !== false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'denied decisions require threshold_satisfied = false',
        path: ['threshold_satisfied'],
      });
    }
  });

export type DecisionEnvelope = z.infer<typeof DecisionEnvelopeSchema>;

/**
 * Validate envelope shape AND assert no PII keys leaked into evidence/extra.
 * The Core invokes this before signing; webhook fan-out invokes it before
 * enqueuing.
 */
export function assertDecisionEnvelopeIsPublicSafe(
  envelope: DecisionEnvelope,
): DecisionEnvelope {
  const parsed = DecisionEnvelopeSchema.parse(envelope);
  assertPublicPayloadHasNoPii(parsed);
  return parsed;
}

/**
 * Project an envelope into the public AgeKey token claims. Pure function — no
 * I/O, no signing. The caller adds `iss`, `aud` and `jti`, then signs.
 *
 * The mapping is total: every claim required by `ResultTokenClaimsSchema`
 * comes from the envelope, so a token cannot include data the envelope did
 * not contain.
 */
export function envelopeToTokenClaims(
  envelope: DecisionEnvelope,
  refs: { iss: string; aud: string; jti: string },
): ResultTokenClaims {
  const claims: ResultTokenClaims = {
    iss: refs.iss,
    aud: refs.aud,
    jti: refs.jti,
    iat: envelope.issued_at,
    nbf: envelope.issued_at,
    exp: envelope.expires_at,
    agekey: {
      decision: envelope.decision,
      threshold_satisfied: envelope.threshold_satisfied,
      age_threshold: envelope.age_threshold,
      method: envelope.method,
      assurance_level: envelope.assurance_level,
      reason_code: envelope.reason_code,
      policy: {
        id: envelope.policy.id,
        slug: envelope.policy.slug,
        version: envelope.policy.version,
      },
      tenant_id: envelope.tenant_id,
      application_id: envelope.application_id,
    },
  };
  if (envelope.external_user_ref != null) {
    claims.sub = envelope.external_user_ref;
  }
  return claims;
}
