// AgeKey OneClick — Contract-Ready Types.
//
// **STATUS: CONTRACT-READY ONLY.** Esta camada provê apenas tipos,
// interfaces de adapter e adapters desabilitados. Não há orquestrador
// operacional, nem edge functions, nem migrations criadas por esta PR.
//
// Esta PR prepara o terreno para a implementação operacional do módulo
// OneClick descrita em `docs/specs/agekey-oneclick.md`. A integração com
// `decision-envelope.ts`, `privacy-guard.ts` e `webhook-types.ts`
// canônicos é DEFERIDA até o PR #88 (Safety hardening) mergear, para
// evitar conflitos.
//
// Documentação:
//   - docs/specs/agekey-oneclick.md
//   - docs/security/agekey-oneclick-no-fake-crypto.md
//   - docs/audit/agekey-oneclick-preflight.md

/** Tipo discriminador do uso de uma sessão OneClick. */
export type OneclickSessionType =
  | 'age_verification'
  | 'age_verification_with_parental_consent'
  | 'credential_issuance'
  | 'proof_of_age';

/** Estados de ciclo de vida de uma sessão OneClick. */
export type OneclickStatus =
  | 'created'
  | 'requires_action'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

/**
 * Ações que o frontend precisa executar antes que a sessão possa ser
 * completada. O orquestrador (próxima PR) preencherá essa lista com
 * base na avaliação do `policy-engine` existente.
 */
export type OneclickRequiredAction =
  | 'collect_age_assertion'
  | 'collect_credential_presentation'
  | 'collect_proof_presentation'
  | 'collect_parental_consent'
  | 'collect_parental_consent_evidence'
  | 'step_up_authentication';

/**
 * Predicados etários aceitos pelo OneClick. Espelha a taxonomia
 * canônica (`packages/shared/src/taxonomy/age-taxonomy.ts`) mas
 * permanece independente para não acoplar a evolução do decision
 * envelope durante #88.
 */
export type OneclickAgePredicate =
  | 'OVER_18'
  | 'OVER_16'
  | 'OVER_13'
  | 'AGE_13_15'
  | 'UNDER_13';

/**
 * **PLACEHOLDER TEMPORÁRIO.**
 *
 * Esta projeção mínima existe APENAS para que os contratos OneClick
 * possam tipar uma resposta antes da integração real com
 * `packages/shared/src/decision/decision-envelope.ts`. Será SUBSTITUÍDA
 * pela importação direta do `DecisionEnvelope` canônico após o PR #88
 * (Safety hardening) mergear.
 *
 * NÃO use `OneclickDecisionSummary` como autoridade. NÃO duplique seus
 * campos em outros módulos. Trate como contrato instável.
 */
export interface OneclickDecisionSummary {
  /** Resultado final da sessão. */
  readonly decision: 'approved' | 'denied' | 'needs_review';
  /** Reason code canônico (string para evitar acoplamento ao enum durante #88). */
  readonly reasonCode: string;
  /** Método usado para a decisão, quando aplicável. */
  readonly method?: 'credential' | 'proof' | 'parental_consent' | 'fallback';
  /** Nível de assurance, quando aplicável. */
  readonly assuranceLevel?: 'low' | 'medium' | 'high';
}

export interface OneclickStartInput {
  /** Identificador opaco do tenant (vem do JWT no servidor). */
  readonly tenantId: string;
  /** Tipo de sessão a iniciar. */
  readonly sessionType: OneclickSessionType;
  /** Predicado etário-alvo. */
  readonly agePredicate: OneclickAgePredicate;
  /** Referência opaca do sujeito (HMAC do tenant). NUNCA documento real. */
  readonly subjectRef: string;
  /** Política aplicável (slug). */
  readonly policySlug: string;
  /** Locale BCP-47 para textos exibidos ao usuário. */
  readonly locale?: string;
}

export interface OneclickStartResult {
  /** Identificador opaco da sessão. */
  readonly sessionId: string;
  /** Estado inicial. */
  readonly status: OneclickStatus;
  /** Ações que o frontend ainda precisa executar. */
  readonly requiredActions: ReadonlyArray<OneclickRequiredAction>;
  /** ISO-8601. */
  readonly expiresAt: string;
}

export interface OneclickCompleteInput {
  readonly sessionId: string;
  /**
   * Payload da ação concluída. Conteúdo é específico por ação e é
   * validado pelo adapter correspondente. Esta tipagem aceita
   * `unknown` propositalmente — os adapters narrowing internamente.
   */
  readonly actionPayloads: ReadonlyArray<{
    readonly action: OneclickRequiredAction;
    readonly payload: Readonly<Record<string, unknown>>;
  }>;
}

export interface OneclickCompleteResult {
  readonly sessionId: string;
  readonly status: OneclickStatus;
  readonly decision: OneclickDecisionSummary;
}

/**
 * Erro lançado quando um adapter recebe um pedido para uma funcionalidade
 * que ainda não está habilitada/implementada. Espelha o padrão de
 * `CredentialModeNotImplementedError` / `ProofModeNotImplementedError`.
 */
export class OneclickFeatureNotImplementedError extends Error {
  constructor(feature: string) {
    super(
      `OneClick feature "${feature}" is not implemented. ` +
        `Refusing to fabricate verification. ` +
        `See docs/specs/agekey-oneclick.md and ` +
        `docs/security/agekey-oneclick-no-fake-crypto.md for the path ` +
        `to production. Required for production: external library, test ` +
        `vectors, real issuer, external cryptographic review.`,
    );
    this.name = 'OneclickFeatureNotImplementedError';
  }
}
