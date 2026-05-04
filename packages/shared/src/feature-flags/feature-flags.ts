// Feature flags canônicos do AgeKey.
//
// Bloqueiam ativação acidental de modos não implementados (SD-JWT VC,
// ZKP/BBS+, Safety Signals, Parental Consent, Credential Mode, Proof Mode)
// antes de existir biblioteca real, issuer, test vectors ou módulo
// completo.
//
// Convenção:
//   - cada flag é booleana, padrão `false`;
//   - cada flag é lida de variável de ambiente correspondente (Edge
//     Functions e admin server-side);
//   - quando desligada, o caminho deve retornar reason code honesto
//     (`CREDENTIAL_FEATURE_DISABLED`, `ZKP_FEATURE_DISABLED`,
//     `GATEWAY_PROVIDER_NOT_CONFIGURED`...) — nunca aprovar.
//
// Documentação: docs/specs/agekey-feature-flags.md

export type AgeKeyFeatureFlagKey =
  | 'AGEKEY_CREDENTIAL_MODE_ENABLED'
  | 'AGEKEY_SD_JWT_VC_ENABLED'
  | 'AGEKEY_PROOF_MODE_ENABLED'
  | 'AGEKEY_ZKP_BBS_ENABLED'
  | 'AGEKEY_SAFETY_SIGNALS_ENABLED'
  | 'AGEKEY_PARENTAL_CONSENT_ENABLED';

export const AGEKEY_FEATURE_FLAG_KEYS: ReadonlyArray<AgeKeyFeatureFlagKey> = [
  'AGEKEY_CREDENTIAL_MODE_ENABLED',
  'AGEKEY_SD_JWT_VC_ENABLED',
  'AGEKEY_PROOF_MODE_ENABLED',
  'AGEKEY_ZKP_BBS_ENABLED',
  'AGEKEY_SAFETY_SIGNALS_ENABLED',
  'AGEKEY_PARENTAL_CONSENT_ENABLED',
] as const;

export type AgeKeyFeatureFlags = Record<AgeKeyFeatureFlagKey, boolean>;

/**
 * Padrões obrigatórios. Toda flag começa desligada e só liga via env
 * explícita. Mudar este default exige co-implementação real do módulo.
 */
export const AGEKEY_FEATURE_FLAG_DEFAULTS: AgeKeyFeatureFlags = Object.freeze({
  AGEKEY_CREDENTIAL_MODE_ENABLED: false,
  AGEKEY_SD_JWT_VC_ENABLED: false,
  AGEKEY_PROOF_MODE_ENABLED: false,
  AGEKEY_ZKP_BBS_ENABLED: false,
  AGEKEY_SAFETY_SIGNALS_ENABLED: false,
  AGEKEY_PARENTAL_CONSENT_ENABLED: false,
});

/**
 * Normaliza valor `string | undefined` (vindo de `process.env` ou
 * `Deno.env.get`) para booleano:
 *   - "true", "1", "on", "yes" → true (case-insensitive);
 *   - qualquer outro valor → false.
 *
 * Caller-friendly: `isFlagOn(Deno.env.get('AGEKEY_ZKP_BBS_ENABLED'))`.
 */
export function isFlagOn(value: string | undefined | null): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'on' || v === 'yes';
}

/**
 * Lê todas as flags a partir de uma fonte de ambiente arbitrária
 * (compatível com `Deno.env.get` e `(name) => process.env[name]`).
 * Aplica os defaults.
 */
export function readFeatureFlags(
  read: (name: string) => string | undefined | null,
): AgeKeyFeatureFlags {
  const out: Record<string, boolean> = {};
  for (const key of AGEKEY_FEATURE_FLAG_KEYS) {
    const raw = read(key);
    out[key] = raw === undefined || raw === null
      ? AGEKEY_FEATURE_FLAG_DEFAULTS[key]
      : isFlagOn(raw);
  }
  return out as AgeKeyFeatureFlags;
}

/**
 * Mapa de flag → reason code canônico recomendado quando a flag está
 * desligada. Útil para Edge Functions devolverem erro honesto em vez de
 * aprovar.
 */
export const AGEKEY_FEATURE_DISABLED_REASON_CODES: Readonly<
  Record<AgeKeyFeatureFlagKey, string>
> = Object.freeze({
  AGEKEY_CREDENTIAL_MODE_ENABLED: 'CREDENTIAL_FEATURE_DISABLED',
  AGEKEY_SD_JWT_VC_ENABLED: 'CREDENTIAL_FEATURE_DISABLED',
  AGEKEY_PROOF_MODE_ENABLED: 'ZKP_FEATURE_DISABLED',
  AGEKEY_ZKP_BBS_ENABLED: 'ZKP_FEATURE_DISABLED',
  AGEKEY_SAFETY_SIGNALS_ENABLED: 'SYSTEM_INVALID_REQUEST',
  AGEKEY_PARENTAL_CONSENT_ENABLED: 'SYSTEM_INVALID_REQUEST',
});
