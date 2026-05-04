// Privacy Guard canônico do AgeKey.
//
// Varre payloads em profundidade rejeitando chaves proibidas conforme o
// perfil de saída. Núcleo é deny-by-default: a lista de chaves
// permitidas/proibidas vem de `forbidden-claims.ts`.
//
// Documentação: docs/specs/agekey-privacy-guard-canonical.md

import {
  CONTENT_FORBIDDEN_KEYS,
  forbiddenKeysForProfile,
  isAllowedAgePolicyKey,
  normalizeKey,
  type PrivacyGuardProfile,
} from './forbidden-claims.ts';

export const PRIVACY_GUARD_FORBIDDEN_CLAIM_ERROR =
  'AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM';

export interface PrivacyViolation {
  readonly path: string;
  readonly key: string;
  readonly reason: 'pii' | 'content';
}

const CONTENT_SET = new Set<string>(CONTENT_FORBIDDEN_KEYS.map((k) => normalizeKey(k)));

/**
 * Encontra todas as violações em profundidade, sem lançar.
 */
export function findPrivacyViolations(
  payload: unknown,
  profile: PrivacyGuardProfile,
  basePath = '$',
): PrivacyViolation[] {
  const forbidden = forbiddenKeysForProfile(profile);
  const out: PrivacyViolation[] = [];

  function visit(value: unknown, path: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, idx) => visit(item, `${path}[${idx}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;

    for (const [rawKey, child] of Object.entries(value as Record<string, unknown>)) {
      const norm = normalizeKey(rawKey);

      // Exceção controlada: regras da política são permitidas.
      const isAllowed = isAllowedAgePolicyKey(rawKey);

      if (!isAllowed && forbidden.has(norm)) {
        out.push({
          path: `${path}.${rawKey}`,
          key: rawKey,
          reason: CONTENT_SET.has(norm) ? 'content' : 'pii',
        });
      }
      visit(child, `${path}.${rawKey}`);
    }
  }

  visit(payload, basePath);
  return out;
}

/**
 * Lança `Error(AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM)` ao encontrar
 * qualquer violação. Mensagem inclui caminhos para diagnóstico, mas o
 * código (`reasonCode`) deve ser usado para tratamento programático.
 */
export class PrivacyGuardForbiddenClaimError extends Error {
  readonly reasonCode = PRIVACY_GUARD_FORBIDDEN_CLAIM_ERROR;
  readonly profile: PrivacyGuardProfile;
  readonly violations: ReadonlyArray<PrivacyViolation>;

  constructor(profile: PrivacyGuardProfile, violations: PrivacyViolation[]) {
    const detail = violations.map((v) => `${v.path}(${v.reason})`).join(', ');
    super(
      `Privacy guard rejected payload for profile "${profile}": ${detail || 'unknown'}`,
    );
    this.name = 'PrivacyGuardForbiddenClaimError';
    this.profile = profile;
    this.violations = violations;
  }
}

/**
 * Garante que o payload é seguro para o perfil informado. Lança em caso
 * de violação.
 */
export function assertPayloadSafe(
  payload: unknown,
  profile: PrivacyGuardProfile,
): void {
  const violations = findPrivacyViolations(payload, profile);
  if (violations.length > 0) {
    throw new PrivacyGuardForbiddenClaimError(profile, violations);
  }
}

/**
 * Retorna `true` se o payload é seguro; útil em testes e em logging
 * defensivo.
 */
export function isPayloadSafe(
  payload: unknown,
  profile: PrivacyGuardProfile,
): boolean {
  return findPrivacyViolations(payload, profile).length === 0;
}
