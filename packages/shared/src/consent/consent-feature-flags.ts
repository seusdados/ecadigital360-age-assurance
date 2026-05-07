// Parental Consent — feature flag constants.
//
// Single source of truth for the env-var names that gate the Consent module.
// The edge functions read from `Deno.env.get(...)`; the Admin UI reads from
// `process.env`; SQL functions read from GUC `app.consent_*`. Keeping the
// names here avoids drift across surfaces.
//
// Defaults are conservative: the module is OFF unless explicitly enabled per
// environment. SD-JWT VC and gateway providers are always OFF in MVP because
// neither path has real implementations, test vectors or revocation infra.
//
// Reference: docs/modules/parental-consent/security.md §Feature flags

export const CONSENT_FEATURE_FLAGS = {
  /** Master switch. When false, all parental-consent endpoints return 503. */
  ENABLED: 'AGEKEY_PARENTAL_CONSENT_ENABLED',
  /** Enables guardian-channel OTP. Off → only federated SSO is possible. */
  GUARDIAN_OTP_ENABLED: 'AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED',
  /** Enables the Admin/Parental dashboard surfaces. */
  PANEL_ENABLED: 'AGEKEY_CONSENT_PANEL_ENABLED',
  /** SD-JWT VC consent receipt. STUB ONLY — keep false. */
  SD_JWT_VC_ENABLED: 'AGEKEY_CONSENT_SD_JWT_VC_ENABLED',
  /** Third-party guardian-verification provider. STUB ONLY — keep false. */
  GATEWAY_PROVIDERS_ENABLED: 'AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED',
  /** Strict privacy guard mode. When true, public responses re-run the guard
   *  unconditionally (defense in depth). Recommended ON in prod. */
  STRICT_PRIVACY_GUARD: 'AGEKEY_CONSENT_STRICT_PRIVACY_GUARD',
} as const;

export type ConsentFeatureFlagName =
  (typeof CONSENT_FEATURE_FLAGS)[keyof typeof CONSENT_FEATURE_FLAGS];

export const CONSENT_FEATURE_FLAG_DEFAULTS: Record<
  ConsentFeatureFlagName,
  boolean
> = {
  AGEKEY_PARENTAL_CONSENT_ENABLED: false,
  AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED: false,
  AGEKEY_CONSENT_PANEL_ENABLED: false,
  AGEKEY_CONSENT_SD_JWT_VC_ENABLED: false,
  AGEKEY_CONSENT_GATEWAY_PROVIDERS_ENABLED: false,
  AGEKEY_CONSENT_STRICT_PRIVACY_GUARD: true,
};

/** Read a feature flag from a string-keyed map (e.g. `process.env`). */
export function readConsentFeatureFlag(
  source: Readonly<Record<string, string | undefined>>,
  name: ConsentFeatureFlagName,
): boolean {
  const raw = source[name];
  if (raw == null || raw === '') {
    return CONSENT_FEATURE_FLAG_DEFAULTS[name];
  }
  return raw === '1' || raw.toLowerCase() === 'true';
}
