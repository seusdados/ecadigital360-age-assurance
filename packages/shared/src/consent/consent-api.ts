// Parental Consent — public API contracts.
//
// Defines the request/response Zod schemas consumed by the edge functions
// `parental-consent-*`. The shapes are intentionally minimised:
//
//   * Inputs accept HMAC'd opaque references (`external_user_ref`) or raw
//     channel pointers that the backend hashes immediately. They never accept
//     plaintext PII through any path that reaches storage.
//   * Outputs derive from the canonical `ConsentDecisionEnvelope`, projected
//     by `envelopeToConsentResponse`.
//   * Every public response carries `pii_included: false` and
//     `content_included: false` as a self-attestation; the privacy guard
//     additionally verifies key names.
//
// Reference: docs/modules/parental-consent/api.md

import { z } from 'zod';
import {
  AssuranceLevelSchema,
  LocaleSchema,
  UuidSchema,
} from '../schemas/common.ts';
import {
  ConsentDecisionSchema,
  ConsentDataCategorySchema,
  ConsentPurposeCodeSchema,
  ConsentRiskTierSchema,
  ConsentRequestStatusSchema,
  ConsentRevocationActorTypeSchema,
  GuardianContactTypeSchema,
  GuardianVerificationMethodSchema,
  GuardianVerificationStatusSchema,
  ParentalConsentStatusSchema,
} from './consent-types.ts';
import { ConsentResourceSchema } from './consent-envelope.ts';

// --- Public request/response: POST /v1/parental-consent/session ---

export const ConsentClientContextSchema = z
  .object({
    user_agent: z.string().max(512).optional(),
    platform: z.enum(['web', 'ios', 'android']).optional(),
    locale: LocaleSchema.optional(),
    referrer_host: z.string().max(253).optional(),
  })
  .strict();
export type ConsentClientContext = z.infer<typeof ConsentClientContextSchema>;

export const ConsentSessionCreateRequestSchema = z
  .object({
    application_id: UuidSchema,
    /** Opaque ref of the SUBJECT (minor). Never PII. The backend hashes it
     *  before storing as `subject_ref_hmac`. */
    external_user_ref: z.string().min(8).max(256),
    resource: ConsentResourceSchema,
    /** Optional scope below the resource (free-form, never PII). */
    scope: z.string().max(256).nullable().optional(),
    /** Closed catalogues — extension goes through reason-codes / data-model. */
    purpose_codes: z.array(ConsentPurposeCodeSchema).min(1),
    data_categories: z.array(ConsentDataCategorySchema).min(1),
    risk_tier: ConsentRiskTierSchema.default('low'),
    /** Tenant policy slug. The handler resolves it server-side; null/missing
     *  means "use the tenant default consent policy". */
    policy_slug: z.string().min(1).max(64).nullable().optional(),
    /** Tenant-supplied correlation id for downstream webhooks. */
    webhook_correlation_id: z.string().min(1).max(128).nullable().optional(),
    /** URL to redirect the guardian to after the flow completes. The backend
     *  validates that the host is allow-listed for the application. */
    return_url: z.string().url().nullable().optional(),
    locale: LocaleSchema.optional(),
    client_context: ConsentClientContextSchema.optional(),
    /** Optional age-verify session id this consent is bound to (e.g. age gate
     *  triggered the consent flow). */
    verification_session_id: UuidSchema.nullable().optional(),
  })
  .strict();
export type ConsentSessionCreateRequest = z.infer<
  typeof ConsentSessionCreateRequestSchema
>;

export const ConsentSessionCreateResponseSchema = z
  .object({
    session_id: UuidSchema,
    consent_request_id: UuidSchema,
    decision: ConsentDecisionSchema,
    status: ConsentRequestStatusSchema,
    reason_code: z.string().min(1).max(64),
    resource: ConsentResourceSchema,
    /** Public-facing URL the guardian must visit to complete the flow. */
    redirect_url: z.string().url(),
    expires_at: z.string().datetime(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();
export type ConsentSessionCreateResponse = z.infer<
  typeof ConsentSessionCreateResponseSchema
>;

// --- Public request/response: POST /v1/parental-consent/:id/guardian/start ---

export const ConsentGuardianStartRequestSchema = z
  .object({
    /** The contact value is the only PII-shaped field on the public boundary.
     *  The handler hashes it (per-tenant HMAC) and ciphertexts it before any
     *  storage; it is NEVER echoed back. The schema accepts max 320 chars
     *  (RFC 5321 email max) to bound the hashing path. */
    contact: z.string().min(3).max(320),
    contact_type: GuardianContactTypeSchema,
    preferred_method: GuardianVerificationMethodSchema.optional(),
  })
  .strict();
export type ConsentGuardianStartRequest = z.infer<
  typeof ConsentGuardianStartRequestSchema
>;

export const ConsentGuardianStartResponseSchema = z
  .object({
    consent_request_id: UuidSchema,
    decision: ConsentDecisionSchema,
    status: ConsentRequestStatusSchema,
    reason_code: z.string().min(1).max(64),
    method: GuardianVerificationMethodSchema,
    verification_status: GuardianVerificationStatusSchema,
    /** When the OTP / verification challenge expires. */
    expires_at: z.string().datetime(),
    /** RFC 5322-compliant rate-limit window remaining; never echoes contact. */
    retry_after_seconds: z.number().int().nonnegative().optional(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();
export type ConsentGuardianStartResponse = z.infer<
  typeof ConsentGuardianStartResponseSchema
>;

// --- Public request/response: POST /v1/parental-consent/:id/confirm ---

export const ConsentConfirmRequestSchema = z
  .object({
    otp: z.string().min(4).max(12).regex(/^[0-9A-Z\-]+$/u),
    consent_text_version_id: UuidSchema,
    accepted: z.boolean(),
    declaration: z
      .object({
        guardian_responsibility_confirmed: z.boolean(),
        understands_scope: z.boolean(),
        understands_revocation: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type ConsentConfirmRequest = z.infer<
  typeof ConsentConfirmRequestSchema
>;

export const ConsentConfirmResponseSchema = z
  .object({
    consent_request_id: UuidSchema,
    decision: ConsentDecisionSchema,
    status: ConsentRequestStatusSchema,
    reason_code: z.string().min(1).max(64),
    /** Filled only when decision = approved. */
    consent_token_id: UuidSchema.nullable(),
    parental_consent_id: UuidSchema.nullable(),
    verification_session_id: UuidSchema.nullable(),
    /** JWT consent token — only emitted on approved. */
    token: z
      .object({
        jwt: z.string().min(20),
        jti: UuidSchema,
        issued_at: z.string().datetime(),
        expires_at: z.string().datetime(),
        kid: z.string().min(1),
        token_type: z.literal('agekey_jws'),
      })
      .strict()
      .nullable(),
    method: GuardianVerificationMethodSchema.nullable(),
    assurance_level: AssuranceLevelSchema.nullable(),
    expires_at: z.string().datetime(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();
export type ConsentConfirmResponse = z.infer<
  typeof ConsentConfirmResponseSchema
>;

// --- Public request/response: GET /v1/parental-consent/session/:session_id ---

export const ConsentSessionStatusResponseSchema = z
  .object({
    consent_request_id: UuidSchema,
    application_id: UuidSchema,
    resource: ConsentResourceSchema,
    decision: ConsentDecisionSchema,
    status: ConsentRequestStatusSchema,
    reason_code: z.string().min(1).max(64),
    parental_consent_id: UuidSchema.nullable(),
    parental_consent_status: ParentalConsentStatusSchema.nullable(),
    consent_token_id: UuidSchema.nullable(),
    expires_at: z.string().datetime().nullable(),
    requested_at: z.string().datetime(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();
export type ConsentSessionStatusResponse = z.infer<
  typeof ConsentSessionStatusResponseSchema
>;

// --- Public request/response: POST /v1/parental-consent/:consent_token_id/revoke ---

export const ConsentRevokeRequestSchema = z
  .object({
    actor_type: ConsentRevocationActorTypeSchema,
    reason_code: z.string().min(1).max(64).optional(),
    /** Optional free-form note. NEVER PII; the handler validates against
     *  privacy guard. */
    reason_text: z.string().max(500).optional(),
  })
  .strict();
export type ConsentRevokeRequest = z.infer<typeof ConsentRevokeRequestSchema>;

export const ConsentRevokeResponseSchema = z
  .object({
    parental_consent_id: UuidSchema,
    consent_token_id: UuidSchema.nullable(),
    status: ParentalConsentStatusSchema,
    reason_code: z.string().min(1).max(64),
    revoked_at: z.string().datetime(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();
export type ConsentRevokeResponse = z.infer<
  typeof ConsentRevokeResponseSchema
>;

// --- Public request/response: POST /v1/parental-consent/token/verify ---

export const ConsentTokenVerifyRequestSchema = z
  .object({
    token: z.string().min(20),
    expected_audience: z.string().min(1).optional(),
    expected_resource: ConsentResourceSchema.optional(),
  })
  .strict();
export type ConsentTokenVerifyRequest = z.infer<
  typeof ConsentTokenVerifyRequestSchema
>;

export const ConsentTokenVerifyResponseSchema = z
  .object({
    valid: z.boolean(),
    revoked: z.boolean(),
    reason_code: z.string().min(1).max(64).optional(),
    parental_consent_id: UuidSchema.nullable(),
    resource: ConsentResourceSchema.nullable(),
    /** Public claims projection — never echoes the JWT body verbatim. */
    claims: z
      .object({
        decision: ConsentDecisionSchema,
        decision_domain: z.literal('parental_consent'),
        resource: ConsentResourceSchema,
        scope: z.string().max(256).nullable(),
        purpose_codes: z.array(ConsentPurposeCodeSchema).min(1),
        data_categories: z.array(ConsentDataCategorySchema).min(1),
        method: GuardianVerificationMethodSchema,
        assurance_level: AssuranceLevelSchema,
        risk_tier: ConsentRiskTierSchema,
        consent_token_id: UuidSchema,
        parental_consent_id: UuidSchema,
        tenant_id: UuidSchema,
        application_id: UuidSchema,
        iat: z.number().int(),
        exp: z.number().int(),
      })
      .strict()
      .optional(),
    pii_included: z.literal(false),
    content_included: z.literal(false),
  })
  .strict();
export type ConsentTokenVerifyResponse = z.infer<
  typeof ConsentTokenVerifyResponseSchema
>;
