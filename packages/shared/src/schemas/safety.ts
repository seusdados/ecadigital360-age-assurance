// AgeKey Safety Signals — schemas Zod e tipos públicos.
//
// Toda resposta pública passa pelo Privacy Guard com perfil
// `safety_event_v1` ou `webhook` ou `public_api_response`. Nenhum
// payload aceita conteúdo bruto (message, raw_text, image, video,
// audio) — Safety v1 é metadata-only.
//
// Documentação: docs/modules/safety-signals/

import { z } from 'zod';
import { UuidSchema } from './common.ts';

// ============================================================
// ENUMS
// ============================================================

export const SafetySeveritySchema = z.enum([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);
export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;

export const SafetyAlertStatusSchema = z.enum([
  'open',
  'acknowledged',
  'escalated',
  'resolved',
  'dismissed',
]);
export type SafetyAlertStatus = z.infer<typeof SafetyAlertStatusSchema>;

export const SafetySubjectAgeStateSchema = z.enum([
  'minor',
  'teen',
  'adult',
  'unknown',
  'eligible_under_policy',
  'not_eligible_under_policy',
  'blocked_under_policy',
]);
export type SafetySubjectAgeState = z.infer<
  typeof SafetySubjectAgeStateSchema
>;

export const SafetyEventTypeSchema = z.enum([
  'message_sent',
  'message_received',
  'media_upload',
  'external_link_shared',
  'profile_view',
  'follow_request',
  'report_filed',
  'private_chat_started',
]);
export type SafetyEventType = z.infer<typeof SafetyEventTypeSchema>;

export const SafetyRuleCodeSchema = z.enum([
  'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
  'ADULT_MINOR_HIGH_FREQUENCY_24H',
  'MEDIA_UPLOAD_TO_MINOR',
  'EXTERNAL_LINK_TO_MINOR',
  'MULTIPLE_REPORTS_AGAINST_ACTOR',
]);
export type SafetyRuleCode = z.infer<typeof SafetyRuleCodeSchema>;

export const SafetyActionSchema = z.enum([
  'log_only',
  'request_step_up',
  'request_parental_consent_check',
  'soft_block',
  'hard_block',
  'notify_safety_team',
  'escalate_to_human_review',
  'rate_limit_actor',
]);
export type SafetyAction = z.infer<typeof SafetyActionSchema>;

export const SafetyRiskCategorySchema = z.enum([
  'unknown_to_minor_contact',
  'high_frequency_adult_minor',
  'media_to_minor',
  'external_content_to_minor',
  'reported_actor',
  'no_risk_signal',
]);
export type SafetyRiskCategory = z.infer<typeof SafetyRiskCategorySchema>;

// ============================================================
// EVENT INGEST
// POST /v1/safety/event
// ============================================================

/**
 * Lista de chaves PROIBIDAS no input. Privacy Guard com perfil
 * `safety_event_v1` aplica esse bloqueio em profundidade. Esta lista
 * é só referência documental; a aplicação real é via privacy-guard.
 */
export const SAFETY_EVENT_FORBIDDEN_KEYS = [
  'message',
  'raw_text',
  'message_body',
  'image',
  'image_data',
  'video',
  'video_data',
  'audio',
  'audio_data',
  'birthdate',
  'date_of_birth',
  'dob',
  'age',
  'exact_age',
  'name',
  'full_name',
  'civil_name',
  'cpf',
  'rg',
  'passport',
  'document',
  'email',
  'phone',
  'selfie',
  'face',
  'biometric',
  'address',
  'ip',
  'gps',
  'latitude',
  'longitude',
] as const;

export const SafetyEventIngestRequestSchema = z
  .object({
    application_slug: z.string().min(1).max(64).optional(),
    event_type: SafetyEventTypeSchema,
    /**
     * HMAC opaco do ator. Tenant gera com sal próprio.
     */
    actor_subject_ref_hmac: z.string().min(8).max(128),
    /**
     * HMAC opaco do contraparte (recipient). Opcional para eventos sem
     * contraparte (ex.: report_filed contra ator).
     */
    counterparty_subject_ref_hmac: z.string().min(8).max(128).optional(),
    /**
     * Estado etário declarado pelo tenant (idealmente vindo do Core).
     * Usado para derivar relationship.
     */
    actor_age_state: SafetySubjectAgeStateSchema.optional(),
    counterparty_age_state: SafetySubjectAgeStateSchema.optional(),
    /**
     * Metadata mínimo. NÃO contém conteúdo bruto.
     */
    metadata: z.record(z.unknown()).default({}),
    /**
     * Hash SHA-256 hex do conteúdo client-side (opcional). Usado para
     * dedup e correlação — nunca para reconstrução de conteúdo.
     */
    content_hash: z.string().min(32).max(128).optional(),
    /**
     * Locale para mensagens de erro/notificação.
     */
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
    /**
     * Timestamp do evento no cliente (ISO-8601). Server pode usar como
     * referência de ordenação; sempre sobrescreve com server-side time
     * em audit_events.
     */
    occurred_at: z.string().datetime().optional(),
  })
  .strict();
export type SafetyEventIngestRequest = z.infer<
  typeof SafetyEventIngestRequestSchema
>;

export const SafetyEventIngestResponseSchema = z.object({
  event_id: UuidSchema,
  actor_subject_id: UuidSchema,
  counterparty_subject_id: UuidSchema.nullable(),
  decision: z.enum([
    'no_risk_signal',
    'logged',
    'soft_blocked',
    'hard_blocked',
    'step_up_required',
    'parental_consent_required',
    'needs_review',
  ]),
  reason_codes: z.array(z.string()).max(16),
  severity: SafetySeveritySchema,
  alert_id: UuidSchema.nullable(),
  step_up_session_id: UuidSchema.nullable(),
  content_included: z.literal(false),
  pii_included: z.literal(false),
});
export type SafetyEventIngestResponse = z.infer<
  typeof SafetyEventIngestResponseSchema
>;

// ============================================================
// DECISION (read-only sub-call)
// POST /v1/safety/decision
// ============================================================

export const SafetyGetDecisionRequestSchema = z
  .object({
    application_slug: z.string().min(1).max(64).optional(),
    actor_subject_ref_hmac: z.string().min(8).max(128),
    counterparty_subject_ref_hmac: z.string().min(8).max(128).optional(),
    event_type: SafetyEventTypeSchema,
    actor_age_state: SafetySubjectAgeStateSchema.optional(),
    counterparty_age_state: SafetySubjectAgeStateSchema.optional(),
  })
  .strict();
export type SafetyGetDecisionRequest = z.infer<
  typeof SafetyGetDecisionRequestSchema
>;

export const SafetyGetDecisionResponseSchema = z.object({
  decision: z.enum([
    'no_risk_signal',
    'soft_blocked',
    'hard_blocked',
    'step_up_required',
    'parental_consent_required',
  ]),
  reason_codes: z.array(z.string()),
  severity: SafetySeveritySchema,
  risk_category: SafetyRiskCategorySchema,
  actions: z.array(SafetyActionSchema),
  step_up_required: z.boolean(),
  parental_consent_required: z.boolean(),
  content_included: z.literal(false),
  pii_included: z.literal(false),
});
export type SafetyGetDecisionResponse = z.infer<
  typeof SafetyGetDecisionResponseSchema
>;

// ============================================================
// ALERT
// ============================================================

export const SafetyAlertItemSchema = z.object({
  id: UuidSchema,
  status: SafetyAlertStatusSchema,
  severity: SafetySeveritySchema,
  rule_code: SafetyRuleCodeSchema,
  risk_category: SafetyRiskCategorySchema,
  reason_codes: z.array(z.string()),
  actions_taken: z.array(SafetyActionSchema),
  actor_subject_id: UuidSchema,
  counterparty_subject_id: UuidSchema.nullable(),
  step_up_session_id: UuidSchema.nullable(),
  parental_consent_request_id: UuidSchema.nullable(),
  created_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable(),
});
export type SafetyAlertItem = z.infer<typeof SafetyAlertItemSchema>;

export const SafetyAlertListQuerySchema = z
  .object({
    status: SafetyAlertStatusSchema.optional(),
    severity: SafetySeveritySchema.optional(),
    rule_code: SafetyRuleCodeSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: UuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type SafetyAlertListQuery = z.infer<typeof SafetyAlertListQuerySchema>;

export const SafetyAlertActionRequestSchema = z
  .object({
    action: z.enum(['acknowledge', 'escalate', 'resolve', 'dismiss']),
    note: z.string().max(2000).optional(),
  })
  .strict();
export type SafetyAlertActionRequest = z.infer<
  typeof SafetyAlertActionRequestSchema
>;

// ============================================================
// RULE
// ============================================================

export const SafetyRuleConfigSchema = z
  .object({
    rule_code: SafetyRuleCodeSchema,
    enabled: z.boolean().default(true),
    severity: SafetySeveritySchema,
    actions: z.array(SafetyActionSchema).min(1).max(8),
    /**
     * Configuração específica da regra (thresholds, janelas etc.).
     */
    config_json: z.record(z.unknown()).default({}),
  })
  .strict();
export type SafetyRuleConfig = z.infer<typeof SafetyRuleConfigSchema>;

// ============================================================
// SUBJECT (read-only via admin)
// ============================================================

export const SafetySubjectItemSchema = z.object({
  id: UuidSchema,
  subject_ref_hmac: z.string(),
  age_state: SafetySubjectAgeStateSchema,
  /** AAL declarado/derivado. Não-PII. */
  assurance_level: z.string().nullable(),
  reports_count: z.number().int().nonnegative(),
  alerts_count: z.number().int().nonnegative(),
  last_seen_at: z.string().datetime(),
  created_at: z.string().datetime(),
});
export type SafetySubjectItem = z.infer<typeof SafetySubjectItemSchema>;

// ============================================================
// AGGREGATE
// ============================================================

export const SafetyAggregateItemSchema = z.object({
  id: UuidSchema,
  subject_id: UuidSchema,
  aggregate_key: z.string(),
  window: z.string(),
  value: z.number(),
  updated_at: z.string().datetime(),
});
export type SafetyAggregateItem = z.infer<typeof SafetyAggregateItemSchema>;

// ============================================================
// EVIDENCE ARTIFACT (referência de evidência opcional)
// ============================================================

export const SafetyEvidenceItemSchema = z.object({
  id: UuidSchema,
  alert_id: UuidSchema,
  artifact_hash: z.string(),
  storage_path: z.string().nullable(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().int().nonnegative().nullable(),
  legal_hold: z.boolean(),
  retention_class: z.string(),
  created_at: z.string().datetime(),
});
export type SafetyEvidenceItem = z.infer<typeof SafetyEvidenceItemSchema>;
