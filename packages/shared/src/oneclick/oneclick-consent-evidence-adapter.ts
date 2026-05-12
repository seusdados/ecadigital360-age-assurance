// OneClick Consent Evidence Adapter — Contract-Ready.
//
// **APENAS interface e contrato.** Adapter default nega
// (`feature_disabled`). NÃO delega para `parental-consent-confirm` nem
// outra edge function existente — qualquer integração real será
// implementada na PR seguinte, condicionada ao inventário do preflight
// confirmar compatibilidade.

import type {
  ParentalConsentEvidenceInput,
  ParentalConsentEvidenceMethod,
} from '../parental-consent/evidence-types.ts';

export type OneclickConsentEvidenceReason =
  | 'feature_disabled'
  | 'consent_not_found'
  | 'pii_rejected'
  | 'success';

export interface OneclickConsentEvidenceCreateResult {
  readonly accepted: boolean;
  readonly reason: OneclickConsentEvidenceReason;
  /** Identificador opaco da evidência criada quando `accepted=true`. */
  readonly evidenceRef?: string;
}

export interface OneclickConsentEvidenceRevokeRequest {
  /** Identificador opaco da evidência. */
  readonly evidenceRef: string;
  /** Motivo de revogação como string opaca. */
  readonly reason: string;
}

export interface OneclickConsentEvidenceRevokeResult {
  readonly revoked: boolean;
  readonly reason: OneclickConsentEvidenceReason;
}

export interface OneclickConsentEvidenceAdapter {
  /** Lista de métodos que esta implementação aceita. */
  readonly supportedMethods: ReadonlyArray<ParentalConsentEvidenceMethod>;

  create(
    input: ParentalConsentEvidenceInput,
  ): Promise<OneclickConsentEvidenceCreateResult>;

  revoke(
    request: OneclickConsentEvidenceRevokeRequest,
  ): Promise<OneclickConsentEvidenceRevokeResult>;
}

/**
 * Adapter padrão. NUNCA aceita evidência. Garante que código
 * contract-ready não armazene evidência por engano em ambiente onde
 * a feature operacional ainda não foi implementada.
 */
export const disabledOneclickConsentEvidenceAdapter: OneclickConsentEvidenceAdapter =
  {
    supportedMethods: [],
    async create(
      _input: ParentalConsentEvidenceInput,
    ): Promise<OneclickConsentEvidenceCreateResult> {
      return { accepted: false, reason: 'feature_disabled' };
    },
    async revoke(
      _request: OneclickConsentEvidenceRevokeRequest,
    ): Promise<OneclickConsentEvidenceRevokeResult> {
      return { revoked: false, reason: 'feature_disabled' };
    },
  };
