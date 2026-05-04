// Decision Envelope canônico do AgeKey.
//
// Contrato comum a Core/Verify, Consent, Safety Signals e (futuro) Pass.
// Toda decisão pública atravessa este envelope. Não pode conter PII.
// Não pode conter conteúdo bruto. Documentação: docs/specs/agekey-decision-envelope.md

import { z } from 'zod';

export type AgeKeyDecisionDomain =
  | 'age_verify'
  | 'parental_consent'
  | 'safety_signal'
  | 'credential'
  | 'gateway'
  | 'fallback';

export type AgeKeyDecisionStatus =
  | 'approved'
  | 'denied'
  | 'pending'
  | 'pending_guardian'
  | 'pending_verification'
  | 'needs_review'
  | 'expired'
  | 'revoked'
  | 'blocked_by_policy'
  | 'step_up_required'
  | 'rate_limited'
  | 'soft_blocked'
  | 'hard_blocked'
  | 'error';

export type AgeKeySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AgeKeyDecisionEnvelope {
  decision_id?: string;
  decision_domain: AgeKeyDecisionDomain;
  decision: AgeKeyDecisionStatus;

  tenant_id?: string;
  application_id?: string;
  policy_id?: string;
  policy_version?: string;

  resource?: string;
  scope?: string[];

  verification_session_id?: string;
  result_token_id?: string;
  consent_token_id?: string;
  safety_alert_id?: string;

  assurance_level?: string;
  method?: string;

  reason_code: string;
  reason_codes?: string[];

  risk_category?: string;
  severity?: AgeKeySeverity;

  actions?: string[];
  step_up_required?: boolean;
  parental_consent_required?: boolean;

  expires_at?: string;
  ttl_seconds?: number;

  // Literais — não podem ser true. Garantia em nível de tipo.
  content_included: false;
  pii_included: false;
}

export const DecisionDomainSchema = z.enum([
  'age_verify',
  'parental_consent',
  'safety_signal',
  'credential',
  'gateway',
  'fallback',
]);

export const DecisionStatusSchema = z.enum([
  'approved',
  'denied',
  'pending',
  'pending_guardian',
  'pending_verification',
  'needs_review',
  'expired',
  'revoked',
  'blocked_by_policy',
  'step_up_required',
  'rate_limited',
  'soft_blocked',
  'hard_blocked',
  'error',
]);

export const SeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);

export const DecisionEnvelopeSchema = z
  .object({
    decision_id: z.string().min(1).optional(),
    decision_domain: DecisionDomainSchema,
    decision: DecisionStatusSchema,
    tenant_id: z.string().min(1).optional(),
    application_id: z.string().min(1).optional(),
    policy_id: z.string().min(1).optional(),
    policy_version: z.string().min(1).optional(),
    resource: z.string().min(1).max(255).optional(),
    scope: z.array(z.string().min(1).max(64)).max(64).optional(),
    verification_session_id: z.string().min(1).optional(),
    result_token_id: z.string().min(1).optional(),
    consent_token_id: z.string().min(1).optional(),
    safety_alert_id: z.string().min(1).optional(),
    assurance_level: z.string().min(1).optional(),
    method: z.string().min(1).optional(),
    reason_code: z.string().min(1),
    reason_codes: z.array(z.string().min(1)).max(32).optional(),
    risk_category: z.string().min(1).max(64).optional(),
    severity: SeveritySchema.optional(),
    actions: z.array(z.string().min(1).max(64)).max(32).optional(),
    step_up_required: z.boolean().optional(),
    parental_consent_required: z.boolean().optional(),
    expires_at: z.string().datetime().optional(),
    ttl_seconds: z.number().int().positive().optional(),
    content_included: z.literal(false),
    pii_included: z.literal(false),
  })
  .strict();

export type DecisionEnvelopeParsed = z.infer<typeof DecisionEnvelopeSchema>;

/**
 * Cria um envelope canônico já com `content_included: false` e
 * `pii_included: false` definidos. O caller só fornece os campos próprios
 * de domínio. Validação Zod aplicada para garantir contrato e ausência
 * de campos extras.
 */
export function createDecisionEnvelope(
  input: Omit<AgeKeyDecisionEnvelope, 'content_included' | 'pii_included'>,
): AgeKeyDecisionEnvelope {
  const candidate: AgeKeyDecisionEnvelope = {
    ...input,
    content_included: false,
    pii_included: false,
  };
  return DecisionEnvelopeSchema.parse(candidate) as AgeKeyDecisionEnvelope;
}

/**
 * Indica se o status é terminal (não evolui mais sem nova ação humana ou
 * nova sessão).
 */
export function isTerminalDecision(status: AgeKeyDecisionStatus): boolean {
  return (
    status === 'approved' ||
    status === 'denied' ||
    status === 'expired' ||
    status === 'revoked' ||
    status === 'blocked_by_policy' ||
    status === 'hard_blocked'
  );
}

/**
 * Indica se o status pode ser resolvido por uma ação automática do mesmo
 * fluxo (sem nova interação do usuário final).
 */
export function isPendingDecision(status: AgeKeyDecisionStatus): boolean {
  return (
    status === 'pending' ||
    status === 'pending_guardian' ||
    status === 'pending_verification' ||
    status === 'needs_review' ||
    status === 'step_up_required'
  );
}
