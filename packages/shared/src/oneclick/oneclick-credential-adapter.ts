// OneClick Credential Adapter — Contract-Ready.
//
// Espelha o padrão de `disabledCredentialVerifier`. Default é negar com
// `feature_disabled`. NÃO executa cripto. NÃO emite credencial real.
//
// Quando P4 chegar, este adapter será substituído por implementação que
// delegue para o `selectCredentialVerifier` canônico — preservando a
// mesma interface.

import type { CredentialPresentation, CredentialPredicates } from '../credential/types.ts';

export type OneclickCredentialAdapterReason =
  | 'feature_disabled'
  | 'library_unavailable'
  | 'fake_crypto_refused'
  | 'success';

export interface OneclickCredentialIssueRequest {
  /** Predicado etário (mantido como string para evitar acoplamento). */
  readonly agePredicate: string;
  /** ISO-8601 UTC. */
  readonly expiresAt: string;
  /** Referência opaca do sujeito (sem PII). */
  readonly subjectRef: string;
}

export interface OneclickCredentialIssueResult {
  readonly issued: boolean;
  readonly reason: OneclickCredentialAdapterReason;
  /** Quando `issued=true`, identificador opaco da credential emitida. */
  readonly credentialRef?: string;
}

export interface OneclickCredentialVerifyResult {
  readonly valid: boolean;
  readonly reason: OneclickCredentialAdapterReason;
}

export interface OneclickCredentialAdapter {
  issue(
    request: OneclickCredentialIssueRequest,
  ): Promise<OneclickCredentialIssueResult>;
  verify(
    presentation: CredentialPresentation,
    expected: CredentialPredicates,
  ): Promise<OneclickCredentialVerifyResult>;
}

/**
 * Adapter padrão que SEMPRE nega. Usado quando a flag operacional
 * OneClick está off ou nenhuma biblioteca SD-JWT real foi conectada.
 */
export const disabledOneclickCredentialAdapter: OneclickCredentialAdapter = {
  async issue(
    _request: OneclickCredentialIssueRequest,
  ): Promise<OneclickCredentialIssueResult> {
    return { issued: false, reason: 'feature_disabled' };
  },
  async verify(
    _presentation: CredentialPresentation,
    _expected: CredentialPredicates,
  ): Promise<OneclickCredentialVerifyResult> {
    return { valid: false, reason: 'feature_disabled' };
  },
};
