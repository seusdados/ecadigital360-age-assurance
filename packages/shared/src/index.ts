// Pacote compartilhado AgeKey — superfície pública.
//
// Convenção: tipos e schemas Zod legados continuam exportados a partir
// dos módulos de origem (./types, ./schemas/*, ./reason-codes,
// ./errors, ./jws, ./jws-generic, ./agekey-claims, ./privacy-guard).
//
// A camada canônica (Rodada 1 — claude/agekey-canonical-modular-architecture)
// adiciona contratos comuns a Core/Verify, Consent, Safety Signals e
// (futuro) Pass via subdiretórios dedicados.

// Legado (mantido por compatibilidade):
export * from './types.ts';
export * from './reason-codes.ts';
export * from './errors.ts';
export * from './jws.ts';
export * from './jws-generic.ts';
export * from './schemas/index.ts';
export {
  assertPublicPayloadHasNoPii,
  findForbiddenPublicPayloadKeys,
  redactTokenForDisplay,
} from './privacy-guard.ts';
export type { PrivacyGuardViolation } from './privacy-guard.ts';
export {
  assertAgeKeyTokenClaimsArePublicSafe,
  isApprovedAgeKeyToken,
} from './agekey-claims.ts';

// Camada canônica:
export * from './decision/index.ts';
export * from './policy/index.ts';
export * from './privacy/index.ts';
export * from './taxonomy/index.ts';
export * from './webhooks/index.ts';
export * from './retention/index.ts';
export * from './feature-flags/index.ts';
