// Helpers de Decision Envelope para o módulo AgeKey Consent.
//
// Constrói envelopes canônicos a partir do estado interno da request /
// consent / token. NÃO inclui PII (o envelope canônico já é estritamente
// definido em `packages/shared/src/decision/decision-envelope.ts`).
//
// Os envelopes produzidos por este helper são adicionados como CAMPO
// OPCIONAL `decision_envelope` em respostas públicas — nunca substituindo
// nem removendo campos pré-existentes (compat HML preservada).

import {
  createDecisionEnvelope,
  type AgeKeyDecisionEnvelope,
  type AgeKeyDecisionStatus,
} from '../../../../packages/shared/src/decision/decision-envelope.ts';

export interface BuildConsentEnvelopeInput {
  decisionId?: string;
  decision: AgeKeyDecisionStatus;
  reasonCode: string;
  reasonCodes?: string[];
  tenantId?: string;
  applicationId?: string;
  policyId?: string;
  policyVersion?: string | number;
  resource?: string;
  consentTokenId?: string;
  expiresAt?: string;
  assuranceLevel?: string;
}

/**
 * Constrói um Decision Envelope canônico para o domínio
 * `parental_consent`. Aceita apenas campos não-PII e força os literais
 * `content_included: false` / `pii_included: false` via
 * `createDecisionEnvelope`.
 */
export function buildConsentDecisionEnvelope(
  input: BuildConsentEnvelopeInput,
): AgeKeyDecisionEnvelope {
  const envelopeInput: Parameters<typeof createDecisionEnvelope>[0] = {
    decision_domain: 'parental_consent',
    decision: input.decision,
    reason_code: input.reasonCode,
  };
  if (input.decisionId !== undefined) envelopeInput.decision_id = input.decisionId;
  if (input.reasonCodes && input.reasonCodes.length > 0) {
    envelopeInput.reason_codes = input.reasonCodes;
  }
  if (input.tenantId !== undefined) envelopeInput.tenant_id = input.tenantId;
  if (input.applicationId !== undefined) {
    envelopeInput.application_id = input.applicationId;
  }
  if (input.policyId !== undefined) envelopeInput.policy_id = input.policyId;
  if (input.policyVersion !== undefined) {
    envelopeInput.policy_version = String(input.policyVersion);
  }
  if (input.resource !== undefined) envelopeInput.resource = input.resource;
  if (input.consentTokenId !== undefined) {
    envelopeInput.consent_token_id = input.consentTokenId;
  }
  if (input.expiresAt !== undefined) envelopeInput.expires_at = input.expiresAt;
  if (input.assuranceLevel !== undefined) {
    envelopeInput.assurance_level = input.assuranceLevel;
  }
  return createDecisionEnvelope(envelopeInput);
}

/**
 * Mapeia status de `parental_consent_requests` para status canônico do
 * Decision Envelope. Defensivo: status desconhecido vira `pending`.
 */
export function mapRequestStatusToDecision(
  status: string,
): AgeKeyDecisionStatus {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'denied':
      return 'denied';
    case 'expired':
      return 'expired';
    case 'revoked':
      return 'revoked';
    case 'awaiting_guardian':
      return 'pending_guardian';
    case 'awaiting_verification':
      return 'pending_verification';
    case 'awaiting_confirmation':
      return 'pending_verification';
    case 'pending':
      return 'pending';
    default:
      return 'pending';
  }
}
