// Parental Consent — result token claims.
//
// Mirrors `ResultTokenClaims` from `schemas/tokens.ts`, but the `agekey.*`
// namespace carries the consent decision instead of the age-verify decision.
// The token is signed with the same kid/key used by the Core (`crypto_keys`),
// so any RP that can verify an age-verify token can also verify a consent
// token without rotating trust.
//
// CLAIMS THAT MUST NEVER APPEAR:
//   guardian_email, guardian_phone, email, phone,
//   name, full_name, civil_name,
//   cpf, rg, passport, document, document_number,
//   birthdate, date_of_birth, dob, exact_age,
//   selfie, face, biometric,
//   address, raw_id, civil_id.
//
// (The privacy guard enforces this list — see `privacy-guard.ts`.)
//
// Reference: docs/specs/agekey-token.md
//            docs/modules/parental-consent/api.md §Token

import { z } from 'zod';
import {
  AssuranceLevelSchema,
  UuidSchema,
} from '../schemas/common.ts';
import {
  CONSENT_DECISION_DOMAIN,
  ConsentDataCategorySchema,
  ConsentDecisionSchema,
  ConsentPurposeCodeSchema,
  ConsentRiskTierSchema,
  GuardianVerificationMethodSchema,
} from './consent-types.ts';
import {
  ConsentPolicyRefSchema,
  ConsentResourceSchema,
} from './consent-envelope.ts';
import type { ConsentDecisionEnvelope } from './consent-envelope.ts';
import { assertPublicPayloadHasNoPii } from '../privacy-guard.ts';

export const ParentalConsentTokenTypeClaim = 'agekey-parental-consent+jwt';

export const ParentalConsentTokenClaimsSchema = z
  .object({
    iss: z.string().url(),
    /** application slug or domain. */
    aud: z.string().min(1),
    /** opaque external_user_ref of the SUBJECT (minor). Optional. */
    sub: z.string().min(1).optional(),
    jti: UuidSchema,
    /** Token type identifier (`typ` claim) — always the literal above. */
    typ: z.literal(ParentalConsentTokenTypeClaim),
    iat: z.number().int(),
    nbf: z.number().int(),
    exp: z.number().int(),

    agekey: z
      .object({
        decision: ConsentDecisionSchema,
        decision_domain: z.literal(CONSENT_DECISION_DOMAIN),
        reason_code: z.string().min(1).max(64),

        consent_request_id: UuidSchema,
        consent_token_id: UuidSchema,
        parental_consent_id: UuidSchema,

        resource: ConsentResourceSchema,
        scope: z.string().max(256).nullable(),
        purpose_codes: z.array(ConsentPurposeCodeSchema).min(1),
        data_categories: z.array(ConsentDataCategorySchema).min(1),
        risk_tier: ConsentRiskTierSchema,

        /** GUARDIAN channel signal. */
        guardian_verified: z.literal(true),
        /** GUARDIAN channel verification method. */
        method: GuardianVerificationMethodSchema,
        /** GUARDIAN channel assurance. */
        assurance_level: AssuranceLevelSchema,

        policy: ConsentPolicyRefSchema.nullable(),
        policy_version: z.number().int().positive().nullable(),

        tenant_id: UuidSchema,
        application_id: UuidSchema,
      })
      .strict(),
  })
  .strict();

export type ParentalConsentTokenClaims = z.infer<
  typeof ParentalConsentTokenClaimsSchema
>;

/**
 * Project an APPROVED consent envelope into JWT claims. Pure function — no
 * I/O, no signing. The caller adds `iss/aud/jti` via `refs` and signs with
 * `crypto_keys`. Throws if the envelope decision is not `approved`.
 *
 * Defense-in-depth: the privacy guard runs on the result claims one extra
 * time before they cross to the signer.
 */
export function envelopeToConsentTokenClaims(
  envelope: ConsentDecisionEnvelope,
  refs: { iss: string; aud: string; jti: string },
): ParentalConsentTokenClaims {
  if (envelope.decision !== 'approved') {
    throw new Error(
      `Cannot mint a consent token for decision='${envelope.decision}'`,
    );
  }
  if (
    envelope.parental_consent_id == null ||
    envelope.assurance_level == null ||
    envelope.guardian_verification_method == null
  ) {
    throw new Error('Approved envelope is missing required claim sources');
  }
  const claims: ParentalConsentTokenClaims = {
    iss: refs.iss,
    aud: refs.aud,
    jti: refs.jti,
    typ: ParentalConsentTokenTypeClaim,
    iat: envelope.issued_at,
    nbf: envelope.issued_at,
    exp: envelope.expires_at,
    agekey: {
      decision: envelope.decision,
      decision_domain: CONSENT_DECISION_DOMAIN,
      reason_code: envelope.reason_code,
      consent_request_id: envelope.consent_request_id,
      consent_token_id: refs.jti,
      parental_consent_id: envelope.parental_consent_id,
      resource: envelope.resource,
      scope: envelope.scope,
      purpose_codes: envelope.purpose_codes,
      data_categories: envelope.data_categories,
      risk_tier: envelope.risk_tier,
      guardian_verified: true,
      method: envelope.guardian_verification_method,
      assurance_level: envelope.assurance_level,
      policy: envelope.policy,
      policy_version: envelope.policy?.version ?? null,
      tenant_id: envelope.tenant_id,
      application_id: envelope.application_id,
    },
  };
  // The schema parse already enforces shape; the guard re-checks key names.
  assertPublicPayloadHasNoPii(claims);
  return ParentalConsentTokenClaimsSchema.parse(claims);
}
