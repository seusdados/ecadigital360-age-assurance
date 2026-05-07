// Safety Signals — feature flag constants.
//
// Defaults are conservative: every flag below ships OFF. v1 is metadata-only;
// content analysis, evidence vault, model governance and legal hold are
// reserved for future rounds with separate compliance reviews.

export const SAFETY_FEATURE_FLAGS = {
  /** Master switch. */
  ENABLED: 'AGEKEY_SAFETY_SIGNALS_ENABLED',
  /** Content analysis (transient processing of message bytes for hashing).
   *  Reserved for v2; MVP rejects raw content unconditionally. */
  CONTENT_ANALYSIS_ENABLED: 'AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED',
  /** Media guard pipeline. Reserved for v2. */
  MEDIA_GUARD_ENABLED: 'AGEKEY_SAFETY_MEDIA_GUARD_ENABLED',
  /** Enterprise evidence vault for legal/regulatory holds. Reserved. */
  EVIDENCE_VAULT_ENABLED: 'AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED',
  /** Model governance loop (drift, explainability, retraining). Reserved. */
  MODEL_GOVERNANCE_ENABLED: 'AGEKEY_SAFETY_MODEL_GOVERNANCE_ENABLED',
  /** Legal hold mode for retention. Reserved. */
  LEGAL_HOLD_ENABLED: 'AGEKEY_SAFETY_LEGAL_HOLD_ENABLED',
} as const;

export type SafetyFeatureFlagName =
  (typeof SAFETY_FEATURE_FLAGS)[keyof typeof SAFETY_FEATURE_FLAGS];

export const SAFETY_FEATURE_FLAG_DEFAULTS: Record<
  SafetyFeatureFlagName,
  boolean
> = {
  AGEKEY_SAFETY_SIGNALS_ENABLED: false,
  AGEKEY_SAFETY_CONTENT_ANALYSIS_ENABLED: false,
  AGEKEY_SAFETY_MEDIA_GUARD_ENABLED: false,
  AGEKEY_SAFETY_EVIDENCE_VAULT_ENABLED: false,
  AGEKEY_SAFETY_MODEL_GOVERNANCE_ENABLED: false,
  AGEKEY_SAFETY_LEGAL_HOLD_ENABLED: false,
};

export function readSafetyFeatureFlag(
  source: Readonly<Record<string, string | undefined>>,
  name: SafetyFeatureFlagName,
): boolean {
  const raw = source[name];
  if (raw == null || raw === '') {
    return SAFETY_FEATURE_FLAG_DEFAULTS[name];
  }
  return raw === '1' || raw.toLowerCase() === 'true';
}
