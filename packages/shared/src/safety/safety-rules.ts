// AgeKey Safety Signals — pure rule engine.
//
// MVP supports a tiny boolean DSL on a flat `field → operator → value`
// shape. The engine is pure (no I/O), works on a typed `RuleContext`
// derived from the canonical Safety envelope plus aggregates loaded by the
// edge function.
//
// The DSL allowlists fields explicitly so a rule cannot ever read raw
// content even if the row has it (Safety v1 doesn't store any, but the
// allowlist is the future-proof guarantee).
//
// Reference: docs/modules/safety-signals/TAXONOMY.md

import { z } from 'zod';
import { SafetyRuleOperatorSchema } from './safety-types.ts';

/** Closed catalogue of fields a rule may read. */
export const RULE_FIELDS = [
  'event_type',
  'channel_type',
  'relationship_type',
  'actor_age_state',
  'counterparty_age_state',
  'severity',
  'risk_category',
  'aggregate_24h_count',
  'aggregate_7d_count',
  'aggregate_30d_count',
  'aggregate_actor_reports_7d',
  'aggregate_link_attempts_24h',
  'aggregate_media_to_minor_24h',
  'consent_status',
  'verification_assurance_level',
] as const;
export const RuleFieldSchema = z.enum(RULE_FIELDS);
export type RuleField = z.infer<typeof RuleFieldSchema>;

const RuleAtomSchema = z
  .object({
    field: RuleFieldSchema,
    op: SafetyRuleOperatorSchema,
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()])),
      z.null(),
    ]),
  })
  .strict();

export type RuleAtom = z.infer<typeof RuleAtomSchema>;

export interface RuleGroup {
  op: 'all' | 'any';
  rules: Array<RuleAtom | RuleGroup>;
}

const RuleGroupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z
    .object({
      op: z.enum(['all', 'any']),
      rules: z.array(z.union([RuleAtomSchema, RuleGroupSchema])).min(1).max(32),
    })
    .strict(),
);

export const RuleConditionSchema = z.union([RuleAtomSchema, RuleGroupSchema]);
export type RuleCondition = z.infer<typeof RuleConditionSchema>;

export const RULE_ACTION_VERBS = [
  'allow',
  'rate_limit',
  'soft_block',
  'hard_block',
  'create_alert',
  'queue_for_human_review',
  'notify_tenant_webhook',
  'require_step_up_age_assurance',
  'require_parental_consent_check',
  'warn_user',
] as const;
export const RuleActionVerbSchema = z.enum(RULE_ACTION_VERBS);
export type RuleActionVerb = z.infer<typeof RuleActionVerbSchema>;

export const RuleActionSchema = z
  .object({
    verb: RuleActionVerbSchema,
    severity: z
      .enum(['low', 'medium', 'high', 'critical'])
      .default('medium'),
    risk_category: z.string().min(1).max(64),
    reason_code: z.string().min(1).max(64),
    ttl_seconds: z.number().int().nonnegative().optional(),
  })
  .strict();
export type RuleAction = z.infer<typeof RuleActionSchema>;

export const SafetyRuleDefinitionSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(255),
    description: z.string().max(1024).optional(),
    enabled: z.boolean().default(true),
    is_system_rule: z.boolean().default(false),
    risk_category: z.string().min(1).max(64),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    condition: RuleConditionSchema,
    actions: z.array(RuleActionSchema).min(1).max(8),
  })
  .strict();
export type SafetyRuleDefinition = z.infer<typeof SafetyRuleDefinitionSchema>;

export interface RuleContext {
  event_type: string;
  channel_type: string;
  relationship_type: string;
  actor_age_state: string;
  counterparty_age_state: string;
  severity?: string;
  risk_category?: string;
  aggregate_24h_count: number;
  aggregate_7d_count: number;
  aggregate_30d_count: number;
  aggregate_actor_reports_7d: number;
  aggregate_link_attempts_24h: number;
  aggregate_media_to_minor_24h: number;
  consent_status: 'active' | 'denied' | 'expired' | 'revoked' | 'absent';
  verification_assurance_level?: 'low' | 'substantial' | 'high' | null;
}

export function evaluateRule(
  rule: RuleCondition,
  ctx: RuleContext,
): boolean {
  if ('op' in rule && (rule.op === 'all' || rule.op === 'any')) {
    const results = (rule as RuleGroup).rules.map((r) => evaluateRule(r, ctx));
    return rule.op === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }
  const atom = rule as RuleAtom;
  const lhs = (ctx as unknown as Record<string, unknown>)[atom.field];
  switch (atom.op) {
    case 'eq':
      return lhs === atom.value;
    case 'neq':
      return lhs !== atom.value;
    case 'in':
      return Array.isArray(atom.value)
        ? (atom.value as unknown[]).includes(lhs as never)
        : false;
    case 'gte':
      return typeof lhs === 'number' && typeof atom.value === 'number'
        ? lhs >= atom.value
        : false;
    case 'lte':
      return typeof lhs === 'number' && typeof atom.value === 'number'
        ? lhs <= atom.value
        : false;
    case 'gt':
      return typeof lhs === 'number' && typeof atom.value === 'number'
        ? lhs > atom.value
        : false;
    case 'lt':
      return typeof lhs === 'number' && typeof atom.value === 'number'
        ? lhs < atom.value
        : false;
    case 'exists':
      return lhs !== undefined && lhs !== null;
    case 'all':
    case 'any':
      // Atom should not have group ops; treat as no-match.
      return false;
  }
}

/** System rules shipped with the MVP. Tenant rules can override or add. */
export const SYSTEM_SAFETY_RULES: SafetyRuleDefinition[] = [
  {
    id: 'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    name: 'Mensagem privada de desconhecido para menor',
    description:
      'Quando uma sessão envia mensagem em DM para um menor sem relação prévia.',
    enabled: true,
    is_system_rule: true,
    risk_category: 'unknown_minor_contact',
    severity: 'medium',
    condition: {
      op: 'all',
      rules: [
        { field: 'channel_type', op: 'eq', value: 'direct_message' },
        {
          field: 'event_type',
          op: 'in',
          value: ['message_send_attempt', 'message_sent'],
        },
        { field: 'relationship_type', op: 'eq', value: 'unknown_to_minor' },
      ],
    },
    actions: [
      {
        verb: 'require_step_up_age_assurance',
        severity: 'medium',
        risk_category: 'unknown_minor_contact',
        reason_code: 'SAFETY_STEP_UP_REQUIRED',
      },
      {
        verb: 'notify_tenant_webhook',
        severity: 'medium',
        risk_category: 'unknown_minor_contact',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
    ],
  },
  {
    id: 'SAFETY_ADULT_MINOR_HIGH_FREQUENCY_24H',
    name: 'Alto volume adulto→menor em 24h',
    description: 'Sinaliza frequência atípica de contato adulto→menor.',
    enabled: true,
    is_system_rule: true,
    risk_category: 'high_frequency_contact',
    severity: 'high',
    condition: {
      op: 'all',
      rules: [
        { field: 'relationship_type', op: 'eq', value: 'adult_to_minor' },
        { field: 'aggregate_24h_count', op: 'gte', value: 50 },
      ],
    },
    actions: [
      {
        verb: 'rate_limit',
        severity: 'high',
        risk_category: 'high_frequency_contact',
        reason_code: 'SAFETY_RATE_LIMITED',
        ttl_seconds: 3600,
      },
      {
        verb: 'create_alert',
        severity: 'high',
        risk_category: 'high_frequency_contact',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
      {
        verb: 'notify_tenant_webhook',
        severity: 'high',
        risk_category: 'high_frequency_contact',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
    ],
  },
  {
    id: 'SAFETY_MEDIA_UPLOAD_TO_MINOR',
    name: 'Upload de mídia para menor',
    description:
      'Tentativa de upload de mídia em interação adulto↔menor exige revisão humana.',
    enabled: true,
    is_system_rule: true,
    risk_category: 'media_exchange_risk',
    severity: 'high',
    condition: {
      op: 'all',
      rules: [
        { field: 'relationship_type', op: 'eq', value: 'adult_to_minor' },
        {
          field: 'event_type',
          op: 'in',
          value: ['media_upload_attempt'],
        },
      ],
    },
    actions: [
      {
        verb: 'soft_block',
        severity: 'high',
        risk_category: 'media_exchange_risk',
        reason_code: 'SAFETY_SOFT_BLOCKED',
      },
      {
        verb: 'queue_for_human_review',
        severity: 'high',
        risk_category: 'media_exchange_risk',
        reason_code: 'SAFETY_NEEDS_REVIEW',
      },
      {
        verb: 'notify_tenant_webhook',
        severity: 'high',
        risk_category: 'media_exchange_risk',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
    ],
  },
  {
    id: 'SAFETY_EXTERNAL_LINK_TO_MINOR',
    name: 'Link externo para menor',
    description:
      'Sinaliza tentativas de migração para fora da plataforma envolvendo menor.',
    enabled: true,
    is_system_rule: true,
    risk_category: 'off_platform_migration',
    severity: 'medium',
    condition: {
      op: 'all',
      rules: [
        {
          field: 'relationship_type',
          op: 'in',
          value: ['adult_to_minor', 'unknown_to_minor'],
        },
        {
          field: 'event_type',
          op: 'in',
          value: ['external_link_attempt'],
        },
      ],
    },
    actions: [
      {
        verb: 'warn_user',
        severity: 'medium',
        risk_category: 'off_platform_migration',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
      {
        verb: 'create_alert',
        severity: 'medium',
        risk_category: 'off_platform_migration',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
    ],
  },
  {
    id: 'SAFETY_MULTIPLE_REPORTS_AGAINST_ACTOR',
    name: 'Atuante denunciado múltiplas vezes',
    description:
      '3+ denúncias contra o mesmo ator em 7 dias envolvendo menores.',
    enabled: true,
    is_system_rule: true,
    risk_category: 'repeat_reported_actor',
    severity: 'high',
    condition: {
      op: 'all',
      rules: [
        { field: 'event_type', op: 'eq', value: 'report_submitted' },
        { field: 'aggregate_actor_reports_7d', op: 'gte', value: 3 },
      ],
    },
    actions: [
      {
        verb: 'queue_for_human_review',
        severity: 'high',
        risk_category: 'repeat_reported_actor',
        reason_code: 'SAFETY_NEEDS_REVIEW',
      },
      {
        verb: 'notify_tenant_webhook',
        severity: 'high',
        risk_category: 'repeat_reported_actor',
        reason_code: 'SAFETY_RISK_FLAGGED',
      },
    ],
  },
];
