// Parental Consent — primitive types and enums.
//
// Mirrors the SQL enums declared in supabase/migrations/018_parental_consent.sql
// (tabelas parental_consent_*). The Consent module is a peer of the AgeKey Core
// `age_verify` decision domain — it produces its own DecisionEnvelope shape
// and signs its own result tokens, but reuses every canonical primitive
// (privacy guard, webhook signer, retention classes, audit_events).
//
// Reference: docs/modules/parental-consent/architecture.md
//            docs/modules/parental-consent/data-model.md

import { z } from 'zod';

/** Lifecycle of a `parental_consent_requests` row. */
export const ConsentRequestStatusSchema = z.enum([
  'created',
  'pending_guardian',
  'pending_verification',
  'approved',
  'denied',
  'expired',
  'revoked',
  'failed',
  'under_review',
  'blocked_by_policy',
]);
export type ConsentRequestStatus = z.infer<typeof ConsentRequestStatusSchema>;

/** Lifecycle of a `parental_consents` row. */
export const ParentalConsentStatusSchema = z.enum([
  'active',
  'denied',
  'expired',
  'revoked',
  'superseded',
]);
export type ParentalConsentStatus = z.infer<typeof ParentalConsentStatusSchema>;

/** How the guardian channel was reached. */
export const GuardianContactTypeSchema = z.enum([
  'email',
  'phone',
  'school_account',
  'federated_account',
]);
export type GuardianContactType = z.infer<typeof GuardianContactTypeSchema>;

/** Verification method for the guardian channel. MVP supports OTP only. */
export const GuardianVerificationMethodSchema = z.enum([
  'otp_email',
  'otp_phone',
  'school_sso',
  'federated_sso',
]);
export type GuardianVerificationMethod = z.infer<
  typeof GuardianVerificationMethodSchema
>;

export const GuardianVerificationStatusSchema = z.enum([
  'pending',
  'sent',
  'verified',
  'failed',
  'expired',
]);
export type GuardianVerificationStatus = z.infer<
  typeof GuardianVerificationStatusSchema
>;

export const ConsentDecisionSchema = z.enum([
  'approved',
  'denied',
  'needs_review',
  'pending',
  'blocked_by_policy',
]);
export type ConsentDecision = z.infer<typeof ConsentDecisionSchema>;

/**
 * Token wrapper format. `agekey_jws` is the only live shape. `sd_jwt_vc` and
 * `presentation` are RESERVED and gated behind feature flags — no real
 * implementation in MVP (no test vectors, no issuer, no revocation registry).
 */
export const ParentalConsentTokenTypeSchema = z.enum([
  'agekey_jws',
  'sd_jwt_vc',
  'presentation',
]);
export type ParentalConsentTokenType = z.infer<
  typeof ParentalConsentTokenTypeSchema
>;

export const ParentalConsentTokenStatusSchema = z.enum([
  'active',
  'revoked',
  'expired',
]);
export type ParentalConsentTokenStatus = z.infer<
  typeof ParentalConsentTokenStatusSchema
>;

/**
 * Closed catalog of `purpose_codes`. The Consent module is purpose-bound:
 * a consent for `account_creation` does NOT cover `data_sharing_third_party`.
 * Tenant-specific purposes can be added as system-rule extensions in a later
 * round; no free-form strings cross the public boundary.
 */
export const ConsentPurposeCodeSchema = z.enum([
  'account_creation',
  'platform_use',
  'data_processing_minimum',
  'communications_with_minor',
  'parental_dashboard_access',
  'analytics_aggregated',
]);
export type ConsentPurposeCode = z.infer<typeof ConsentPurposeCodeSchema>;

/**
 * Closed catalog of `data_categories`. Mirrors LGPD/GDPR data minimisation.
 * The list is intentionally short — anything not listed must be added here
 * before being persisted.
 */
export const ConsentDataCategorySchema = z.enum([
  'profile_minimum',
  'usage_metadata',
  'safety_signals',
  'parental_dashboard',
  'service_communications',
]);
export type ConsentDataCategory = z.infer<typeof ConsentDataCategorySchema>;

/** Risk tier — drives required guardian assurance and review escalation. */
export const ConsentRiskTierSchema = z.enum(['low', 'medium', 'high']);
export type ConsentRiskTier = z.infer<typeof ConsentRiskTierSchema>;

/** Actor who triggered a revocation. */
export const ConsentRevocationActorTypeSchema = z.enum([
  'guardian',
  'tenant_admin',
  'subject',
  'agekey_system',
  'regulator',
]);
export type ConsentRevocationActorType = z.infer<
  typeof ConsentRevocationActorTypeSchema
>;

/** `consent_text_versions` lifecycle. */
export const ConsentTextStatusSchema = z.enum([
  'draft',
  'published',
  'retired',
]);
export type ConsentTextStatus = z.infer<typeof ConsentTextStatusSchema>;

export const CONSENT_DECISION_DOMAIN = 'parental_consent' as const;
export type ConsentDecisionDomain = typeof CONSENT_DECISION_DOMAIN;
