// Listas canônicas de chaves proibidas em payloads públicos do AgeKey.
//
// O Privacy Guard usa estas listas para varrer payloads em profundidade e
// rejeitar PII antes de qualquer serialização pública (token, webhook,
// SDK response, widget response, API pública).
//
// Documentação: docs/specs/agekey-privacy-guard-canonical.md

/**
 * Núcleo absoluto de chaves PROIBIDAS em qualquer payload público.
 *
 * Comparação é case-insensitive e atravessa profundidade de objetos e
 * arrays. Variantes com underscore/hífen são normalizadas (ver
 * `normalizeKey`).
 */
export const CORE_FORBIDDEN_KEYS = [
  // Identidade civil
  'name',
  'full_name',
  'first_name',
  'last_name',
  'civil_name',
  'username_civil',
  'cpf',
  'rg',
  'passport',
  'document',
  'document_number',
  'id_number',
  'civil_id',
  'raw_id',
  'raw_document',
  'identity_scan',

  // Idade / data de nascimento
  'birthdate',
  'date_of_birth',
  'dob',
  'idade',
  'age',
  'exact_age',

  // Biometria
  'selfie',
  'face',
  'faceprint',
  'biometric',
  'biometric_template',

  // Endereço
  'address',
  'address_full',

  // Contato
  'email',
  'phone',
  'guardian_email',
  'guardian_phone',
  'guardian_name',

  // Geolocalização precisa / dispositivo
  'ip',
  'raw_ip',
  'gps',
  'latitude',
  'longitude',
  'location_precise',
] as const;

/**
 * Conteúdo bruto e mídia. Sempre proibido em payload público.
 * No perfil `safety_event_v1` (Safety Signals MVP), também é proibido
 * persistir/ingerir esses campos — Safety v1 é metadata-only.
 */
export const CONTENT_FORBIDDEN_KEYS = [
  'raw_text',
  'message',
  'message_body',
  'image',
  'image_data',
  'video',
  'video_data',
  'audio',
  'audio_data',
] as const;

/**
 * Exceções controladas. Estas chaves são permitidas porque representam
 * regras da política ou estados de elegibilidade — não a idade real do
 * usuário.
 */
export const ALLOWED_AGE_POLICY_KEYS = [
  'minimum_age',
  'age_threshold',
  'policy_age_threshold',
  'age_over_13',
  'age_over_16',
  'age_over_18',
  'age_over_21',
  'age_band_policy',
  'actor_age_band',
  'counterparty_age_band',
  'subject_age_state',
  'age_band_min',
  'age_band_max',
] as const;

/**
 * Normaliza uma chave para comparação case-insensitive e indiferente a
 * separador (underscore/hífen).
 */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

const ALLOWED_SET = new Set<string>(
  ALLOWED_AGE_POLICY_KEYS.map((k) => normalizeKey(k)),
);

/**
 * Indica se a chave é uma exceção controlada (regra da política).
 */
export function isAllowedAgePolicyKey(key: string): boolean {
  return ALLOWED_SET.has(normalizeKey(key));
}

export type PrivacyGuardProfile =
  | 'public_token'
  | 'webhook'
  | 'sdk_response'
  | 'widget_response'
  | 'public_api_response'
  | 'admin_minimized_view'
  | 'audit_internal'
  | 'safety_event_v1'
  | 'guardian_contact_internal';

/**
 * Conjunto de chaves proibidas para o perfil informado.
 *
 * - `public_token`, `webhook`, `sdk_response`, `widget_response`,
 *   `public_api_response`, `admin_minimized_view`, `safety_event_v1`:
 *   bloqueia identidade civil, idade real, biometria, endereço, contato,
 *   geolocalização precisa **e** conteúdo bruto.
 * - `audit_internal`: bloqueia identidade civil bruta, biometria,
 *   conteúdo bruto e idade real, mas pode conter hashes, HMACs e
 *   `payload_hash` legitimamente.
 * - `guardian_contact_internal`: o único perfil em que `guardian_email`
 *   e `guardian_phone` são tolerados — porque o módulo Consent precisa
 *   notificar o responsável. Mesmo aqui, é estritamente server-side, com
 *   retenção própria, cifragem em repouso e trilha de acesso. Conteúdo
 *   bruto e identidade civil continuam proibidos.
 */
export function forbiddenKeysForProfile(
  profile: PrivacyGuardProfile,
): ReadonlySet<string> {
  const base = new Set<string>(CORE_FORBIDDEN_KEYS.map((k) => normalizeKey(k)));
  for (const c of CONTENT_FORBIDDEN_KEYS) base.add(normalizeKey(c));

  if (profile === 'audit_internal') {
    // Audit pode ter hashes; remove apenas a tolerância de contato.
    return base;
  }
  if (profile === 'guardian_contact_internal') {
    base.delete('guardian_email');
    base.delete('guardian_phone');
    base.delete('guardian_name');
    return base;
  }
  return base;
}
