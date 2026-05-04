// Taxonomia canônica de idade/elegibilidade do AgeKey.
//
// Padroniza nomes que percorrem token, decision envelope, webhook,
// safety event e admin labels. Todos os valores aqui são públicos e não
// constituem PII — são predicados, faixas e estados de elegibilidade,
// nunca a idade real do usuário.
//
// Documentação: docs/specs/agekey-product-taxonomy.md

export type AgePredicate = 'over_13' | 'over_16' | 'over_18' | 'over_21';

export type SubjectAgeState =
  | 'minor'
  | 'teen'
  | 'adult'
  | 'unknown'
  | 'eligible_under_policy'
  | 'not_eligible_under_policy'
  | 'blocked_under_policy';

export type AgeAssuranceLevel =
  | 'AAL-0'
  | 'AAL-1'
  | 'AAL-2'
  | 'AAL-3'
  | 'AAL-4';

export type ConsentAssuranceLevel =
  | 'AAL-C0'
  | 'AAL-C1'
  | 'AAL-C2'
  | 'AAL-C3'
  | 'AAL-C4';

/**
 * Compatibilidade com a notação Safety Signals (status legado).
 * Mapeia para `SubjectAgeState` + `AgeAssuranceLevel` quando existirem.
 *
 * - `minor_verified`     -> `subject_age_state: minor` + assurance conhecido
 * - `teen_verified`      -> `subject_age_state: teen` + assurance conhecido
 * - `adult_verified`     -> `subject_age_state: adult` + assurance conhecido
 * - `unknown`            -> `subject_age_state: unknown`
 *
 * Estados resultado de política (não idade real):
 *
 * - `eligible_under_policy`
 * - `not_eligible_under_policy`
 * - `blocked_under_policy`
 */
export const SAFETY_AGE_STATE_LEGACY = [
  'minor_verified',
  'teen_verified',
  'adult_verified',
  'unknown',
  'eligible_under_policy',
  'not_eligible_under_policy',
  'blocked_under_policy',
] as const;

export type SafetyAgeStateLegacy = (typeof SAFETY_AGE_STATE_LEGACY)[number];

export interface SafetyAgeStateMapped {
  subject_age_state: SubjectAgeState;
  assurance_level?: AgeAssuranceLevel;
}

export function mapSafetyLegacyAgeState(
  legacy: SafetyAgeStateLegacy,
): SafetyAgeStateMapped {
  switch (legacy) {
    case 'minor_verified':
      return { subject_age_state: 'minor' };
    case 'teen_verified':
      return { subject_age_state: 'teen' };
    case 'adult_verified':
      return { subject_age_state: 'adult' };
    case 'unknown':
      return { subject_age_state: 'unknown' };
    case 'eligible_under_policy':
      return { subject_age_state: 'eligible_under_policy' };
    case 'not_eligible_under_policy':
      return { subject_age_state: 'not_eligible_under_policy' };
    case 'blocked_under_policy':
      return { subject_age_state: 'blocked_under_policy' };
  }
}

/**
 * Hierarquia AAL canônica do AgeKey (idade).
 *
 * Renomeado a partir de `ASSURANCE_RANK` (legado em `../types.ts`) para
 * evitar colisão de export — o legado expõe níveis `low | substantial | high`.
 */
export const AGE_ASSURANCE_RANK: Record<AgeAssuranceLevel, number> = {
  'AAL-0': 0,
  'AAL-1': 1,
  'AAL-2': 2,
  'AAL-3': 3,
  'AAL-4': 4,
};

export const CONSENT_ASSURANCE_RANK: Record<ConsentAssuranceLevel, number> = {
  'AAL-C0': 0,
  'AAL-C1': 1,
  'AAL-C2': 2,
  'AAL-C3': 3,
  'AAL-C4': 4,
};

export function meetsAgeAssurance(
  delivered: AgeAssuranceLevel,
  required: AgeAssuranceLevel,
): boolean {
  return AGE_ASSURANCE_RANK[delivered] >= AGE_ASSURANCE_RANK[required];
}

export function meetsConsentAssurance(
  delivered: ConsentAssuranceLevel,
  required: ConsentAssuranceLevel,
): boolean {
  return CONSENT_ASSURANCE_RANK[delivered] >= CONSENT_ASSURANCE_RANK[required];
}

/**
 * Mapa de predicado para valor inteiro do limiar declarado pela política.
 * Apenas para lógica interna de comparação contra `policy_age_threshold`
 * — nunca para inferir idade real.
 */
export const PREDICATE_THRESHOLD: Record<AgePredicate, 13 | 16 | 18 | 21> = {
  over_13: 13,
  over_16: 16,
  over_18: 18,
  over_21: 21,
};
