// AgeKey Safety — derivação de `relationship` entre actor e counterparty.
//
// Pure: testável em vitest. Usado pelo rule engine para classificar
// pares (adult_to_minor, unknown_to_minor, etc.) sem inferir idade real.

import type { SafetySubjectAgeState } from '../schemas/safety.ts';

export type SafetyRelationship =
  | 'adult_to_minor'
  | 'adult_to_teen'
  | 'adult_to_adult'
  | 'minor_to_minor'
  | 'minor_to_adult'
  | 'unknown_to_minor'
  | 'unknown_to_teen'
  | 'unknown_to_adult'
  | 'unknown_to_unknown'
  | 'minor_to_unknown'
  | 'self_actor'
  | 'other';

interface PairKey {
  a: SafetySubjectAgeState | undefined | null;
  c: SafetySubjectAgeState | undefined | null;
}

const TABLE: Array<{
  match: (k: PairKey) => boolean;
  out: SafetyRelationship;
}> = [
  { match: (k) => !k.c, out: 'self_actor' },
  { match: (k) => k.a === 'adult' && k.c === 'minor', out: 'adult_to_minor' },
  { match: (k) => k.a === 'adult' && k.c === 'teen', out: 'adult_to_teen' },
  { match: (k) => k.a === 'adult' && k.c === 'adult', out: 'adult_to_adult' },
  { match: (k) => k.a === 'minor' && k.c === 'minor', out: 'minor_to_minor' },
  { match: (k) => k.a === 'minor' && k.c === 'adult', out: 'minor_to_adult' },
  { match: (k) => k.a === 'minor' && k.c === 'unknown', out: 'minor_to_unknown' },
  { match: (k) => k.a === 'unknown' && k.c === 'minor', out: 'unknown_to_minor' },
  { match: (k) => k.a === 'unknown' && k.c === 'teen', out: 'unknown_to_teen' },
  { match: (k) => k.a === 'unknown' && k.c === 'adult', out: 'unknown_to_adult' },
  { match: (k) => k.a === 'unknown' && k.c === 'unknown', out: 'unknown_to_unknown' },
];

export function deriveRelationship(
  actorAgeState: SafetySubjectAgeState | undefined | null,
  counterpartyAgeState: SafetySubjectAgeState | undefined | null,
): SafetyRelationship {
  const k: PairKey = { a: actorAgeState, c: counterpartyAgeState };
  for (const row of TABLE) {
    if (row.match(k)) return row.out;
  }
  return 'other';
}

/**
 * Indica se a relação envolve um menor (idade conhecida ou estado de
 * elegibilidade que sinalize menor).
 */
export function involvesMinor(rel: SafetyRelationship): boolean {
  return (
    rel === 'adult_to_minor' ||
    rel === 'unknown_to_minor' ||
    rel === 'minor_to_minor' ||
    rel === 'minor_to_adult' ||
    rel === 'minor_to_unknown'
  );
}

/**
 * Indica se a relação tem ator adulto interagindo com menor — caso de
 * maior atenção em regras como `ADULT_MINOR_HIGH_FREQUENCY_24H`.
 */
export function isAdultToMinor(rel: SafetyRelationship): boolean {
  return rel === 'adult_to_minor';
}

/**
 * Indica se a relação tem ator desconhecido falando com menor.
 */
export function isUnknownToMinor(rel: SafetyRelationship): boolean {
  return rel === 'unknown_to_minor';
}
