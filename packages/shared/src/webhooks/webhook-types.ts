// Contrato de Webhooks canônico do AgeKey.
//
// Eventos comuns aos três módulos (Core/Verify, Consent, Safety Signals)
// e payload mínimo que sempre carrega o Decision Envelope canônico.
// Documentação: docs/specs/agekey-webhook-contract.md

import { z } from 'zod';
import {
  DecisionEnvelopeSchema,
  type AgeKeyDecisionEnvelope,
} from '../decision/decision-envelope.ts';

export type AgeKeyWebhookEvent =
  // ====== Core/Verify ======
  | 'verification.session_created'
  | 'verification.approved'
  | 'verification.denied'
  | 'verification.expired'
  | 'verification.revoked'
  // ====== Consent ======
  | 'parental_consent.session_created'
  | 'parental_consent.guardian_invited'
  | 'parental_consent.guardian_verified'
  | 'parental_consent.approved'
  | 'parental_consent.denied'
  | 'parental_consent.expired'
  | 'parental_consent.revoked'
  | 'parental_consent.needs_review'
  // ====== Safety Signals ======
  | 'safety.event_ingested'
  | 'safety.alert_created'
  | 'safety.alert_updated'
  | 'safety.step_up_required'
  | 'safety.parental_consent_check_required';

export interface AgeKeyWebhookPayload {
  event_id: string;
  event_type: AgeKeyWebhookEvent;
  created_at: string;
  tenant_id: string;
  application_id: string;
  decision?: AgeKeyDecisionEnvelope;
  session_id?: string;
  consent_token_id?: string;
  safety_alert_id?: string;
  policy_id?: string;
  policy_version?: string;
  resource?: string;
  reason_codes?: string[];
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
  content_included: false;
  pii_included: false;
  payload_hash: string;
}

export const WebhookEventSchema = z.enum([
  'verification.session_created',
  'verification.approved',
  'verification.denied',
  'verification.expired',
  'verification.revoked',
  'parental_consent.session_created',
  'parental_consent.guardian_invited',
  'parental_consent.guardian_verified',
  'parental_consent.approved',
  'parental_consent.denied',
  'parental_consent.expired',
  'parental_consent.revoked',
  'parental_consent.needs_review',
  'safety.event_ingested',
  'safety.alert_created',
  'safety.alert_updated',
  'safety.step_up_required',
  'safety.parental_consent_check_required',
]);

export const WebhookPayloadSchema = z
  .object({
    event_id: z.string().min(1),
    event_type: WebhookEventSchema,
    created_at: z.string().datetime(),
    tenant_id: z.string().min(1),
    application_id: z.string().min(1),
    decision: DecisionEnvelopeSchema.optional(),
    session_id: z.string().min(1).optional(),
    consent_token_id: z.string().min(1).optional(),
    safety_alert_id: z.string().min(1).optional(),
    policy_id: z.string().min(1).optional(),
    policy_version: z.string().min(1).optional(),
    resource: z.string().min(1).max(255).optional(),
    reason_codes: z.array(z.string().min(1)).max(32).optional(),
    severity: z.enum(['info', 'low', 'medium', 'high', 'critical']).optional(),
    content_included: z.literal(false),
    pii_included: z.literal(false),
    payload_hash: z.string().min(1),
  })
  .strict();

/**
 * Cabeçalhos canônicos de assinatura de webhook do AgeKey.
 */
export const WEBHOOK_HEADERS = {
  TIMESTAMP: 'X-AgeKey-Webhook-Timestamp',
  NONCE: 'X-AgeKey-Webhook-Nonce',
  SIGNATURE: 'X-AgeKey-Webhook-Signature',
  IDEMPOTENCY_KEY: 'X-AgeKey-Idempotency-Key',
  EVENT_TYPE: 'X-AgeKey-Event-Type',
  EVENT_ID: 'X-AgeKey-Event-Id',
} as const;

/**
 * Janela aceita para `X-AgeKey-Webhook-Timestamp` (em segundos).
 * Padrão: 5 minutos. Receivers devem rejeitar fora dessa janela com
 * `WEBHOOK_TIMESTAMP_OUT_OF_WINDOW`.
 */
export const WEBHOOK_TIMESTAMP_WINDOW_SECONDS = 5 * 60;
