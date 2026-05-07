// Privacy Guard legado do AgeKey.
//
// Estado: superfície estável (zero quebra) + delegação interna para o
// guard canônico em `./privacy/privacy-guard.ts`. Toda chave bloqueada
// pelo legado continua bloqueada; chaves novas adicionadas pela camada
// canônica (`first_name`, `last_name`, `civil_name`, `id_number`,
// `passport`, `selfie`, `biometric_template`, `ip`, `gps`,
// `latitude`, `longitude`, `guardian_email`, `guardian_phone`,
// `guardian_name`, `raw_text`, `message`, `image`, `video`, `audio`...)
// agora também passam a ser bloqueadas via delegação — isso é
// estritamente mais restritivo que o comportamento anterior, ou seja,
// não introduz aprovação onde antes havia rejeição.
//
// Documentação: docs/specs/agekey-privacy-guard-canonical.md

import {
  findPrivacyViolations,
  PRIVACY_GUARD_FORBIDDEN_CLAIM_ERROR,
} from './privacy/privacy-guard.ts';

export interface PrivacyGuardViolation {
  readonly path: string;
  readonly key: string;
}

/**
 * Lista preservada por compatibilidade — consumidores antigos que
 * importam diretamente este array continuam funcionando.
 *
 * **Não estenda este array.** A fonte canônica das chaves proibidas
 * vive em `./privacy/forbidden-claims.ts` (`CORE_FORBIDDEN_KEYS` +
 * `CONTENT_FORBIDDEN_KEYS`).
 */
export const FORBIDDEN_PUBLIC_KEYS = [
  'birthdate',
  'date_of_birth',
  'dob',
  'idade',
  'age',
  'exact_age',
  'document',
  'cpf',
  'rg',
  'passport',
  'name',
  'full_name',
  'email',
  'phone',
  'selfie',
  'face',
  'raw_id',
  'address',
] as const;

/**
 * Encontra chaves proibidas em payload público. Delega para o guard
 * canônico no perfil `public_api_response` — comportamento estritamente
 * igual ou mais restritivo que a versão original (nunca menos).
 */
export function findForbiddenPublicPayloadKeys(
  payload: unknown,
  basePath = '$',
): PrivacyGuardViolation[] {
  return findPrivacyViolations(payload, 'public_api_response', basePath).map(
    (v) => ({ path: v.path, key: v.key }),
  );
}

/**
 * Lança `Error` quando o payload contém chaves PII-like.
 *
 * Mantém a mesma forma de erro da versão original (`Error` cru, não
 * `PrivacyGuardForbiddenClaimError`) para evitar quebra em consumidores
 * que ainda usam `try { ... } catch (e) { e.message... }`. O reason code
 * canônico (`AGEKEY_PRIVACY_GUARD_FORBIDDEN_CLAIM`) é incluído na
 * mensagem para correlação.
 */
export function assertPublicPayloadHasNoPii(payload: unknown): void {
  const violations = findForbiddenPublicPayloadKeys(payload);
  if (violations.length > 0) {
    const detail = violations.map((v) => v.path).join(', ');
    throw new Error(
      `Public payload contains forbidden PII-like keys [${PRIVACY_GUARD_FORBIDDEN_CLAIM_ERROR}]: ${detail}`,
    );
  }
}

/**
 * Redação de token para exibição em logs/admin.
 *
 * Não usa o guard canônico — token JWT em si não é PII (não contém
 * dados do usuário); a redação é apenas para evitar vazamento da
 * assinatura completa em logs.
 */
export function redactTokenForDisplay(token: string): string {
  if (token.length <= 24) return '***';
  return `${token.slice(0, 12)}...${token.slice(-12)}`;
}
