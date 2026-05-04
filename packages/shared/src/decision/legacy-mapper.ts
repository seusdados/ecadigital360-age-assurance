// Mapper legado → Decision Envelope canônico.
//
// Converte respostas legadas do Core (session-complete, session-get) e
// payloads de webhook gerados pelo trigger SQL `fan_out_verification_webhooks`
// (migration 012) em um `AgeKeyDecisionEnvelope` canônico.
//
// **Não substitui** o wire format atual: é um adaptador para novos
// consumidores (admin, dashboards, futuros webhooks Consent/Safety) que
// já querem ler o envelope canônico sem que o Core mude o formato
// público.
//
// Documentação: docs/specs/agekey-decision-envelope.md §6

import type {
  AgeKeyDecisionDomain,
  AgeKeyDecisionEnvelope,
  AgeKeyDecisionStatus,
} from './decision-envelope.ts';
import { createDecisionEnvelope } from './decision-envelope.ts';

/**
 * Estrutura mínima compartilhada entre as respostas legadas:
 *   - `SessionCompleteResponse` (verifications-session-complete)
 *   - `SessionGetResponse` (verifications-session-get)
 *   - payload do webhook `verification.*` gerado pelo trigger SQL
 *
 * Os três compartilham os campos abaixo. Campos específicos de cada
 * resposta (ex.: `token`, `status`, `created_at`) são ignorados pelo
 * mapper — eles continuam disponíveis no objeto original.
 */
export interface LegacyVerificationLike {
  readonly tenant_id?: string | null;
  readonly application_id?: string | null;
  readonly session_id?: string | null;
  readonly decision: 'approved' | 'denied' | 'needs_review' | string;
  readonly reason_code: string;
  readonly method?: string | null;
  readonly assurance_level?: string | null;
  readonly jti?: string | null;
  readonly policy?: {
    readonly id?: string | null;
    readonly version?: number | string | null;
  } | null;
  readonly resource?: string | null;
  readonly expires_at?: string | null;
}

/**
 * Mapeia o `decision` legado (`approved | denied | needs_review`) para
 * o status canônico (`AgeKeyDecisionStatus`). Em caso de valor
 * inesperado, devolve `error` para sinalizar incompatibilidade — nunca
 * `approved` por padrão.
 */
export function mapLegacyDecisionStatus(
  legacy: string,
): AgeKeyDecisionStatus {
  switch (legacy) {
    case 'approved':
      return 'approved';
    case 'denied':
      return 'denied';
    case 'needs_review':
      return 'needs_review';
    default:
      return 'error';
  }
}

/**
 * Converte um payload legado (Core/Verify) em `AgeKeyDecisionEnvelope`.
 *
 * - `decision_domain` é fixado em `"age_verify"` por padrão; chamadas
 *   que originam de Consent ou Safety devem passar o domínio correto.
 * - `pii_included` e `content_included` são literais `false` (garantia
 *   do envelope canônico).
 * - Não copia campos não declarados no envelope — a passagem por
 *   `createDecisionEnvelope` valida via Zod estrito.
 */
export function toCanonicalEnvelope(
  legacy: LegacyVerificationLike,
  domain: AgeKeyDecisionDomain = 'age_verify',
): AgeKeyDecisionEnvelope {
  const status = mapLegacyDecisionStatus(legacy.decision);
  const policyVersion =
    legacy.policy?.version === null || legacy.policy?.version === undefined
      ? undefined
      : String(legacy.policy.version);

  return createDecisionEnvelope({
    decision_domain: domain,
    decision: status,
    reason_code: legacy.reason_code,
    ...(legacy.tenant_id ? { tenant_id: legacy.tenant_id } : {}),
    ...(legacy.application_id
      ? { application_id: legacy.application_id }
      : {}),
    ...(legacy.policy?.id ? { policy_id: legacy.policy.id } : {}),
    ...(policyVersion ? { policy_version: policyVersion } : {}),
    ...(legacy.resource ? { resource: legacy.resource } : {}),
    ...(legacy.session_id
      ? { verification_session_id: legacy.session_id }
      : {}),
    ...(legacy.jti ? { result_token_id: legacy.jti } : {}),
    ...(legacy.assurance_level
      ? { assurance_level: legacy.assurance_level }
      : {}),
    ...(legacy.method ? { method: legacy.method } : {}),
    ...(legacy.expires_at ? { expires_at: legacy.expires_at } : {}),
  });
}
