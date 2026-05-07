// AgeKey Safety — rule engine puro (V1).
//
// Recebe (event_type, relationship, aggregates, config) e devolve
// {decision, reason_codes, severity, risk_category, actions}.
//
// Não-objetivo: emitir conclusão jurídica. As regras geram sinais e
// recomendam ações proporcionais.

import type {
  SafetyAction,
  SafetyEventType,
  SafetyRiskCategory,
  SafetyRuleCode,
  SafetySeverity,
} from '../schemas/safety.ts';
import {
  isAdultToMinor,
  isUnknownToMinor,
  type SafetyRelationship,
} from './relationship.ts';

export interface RuleConfig {
  rule_code: SafetyRuleCode;
  enabled: boolean;
  severity: SafetySeverity;
  actions: SafetyAction[];
  config_json: Record<string, unknown>;
}

export interface RuleContext {
  event_type: SafetyEventType;
  relationship: SafetyRelationship;
  aggregates: {
    /**
     * Mensagens adulto→menor nas últimas 24h envolvendo este par.
     */
    adult_to_minor_messages_24h?: number;
    /**
     * Reports contra este ator nos últimos 7 dias.
     */
    reports_against_actor_7d?: number;
  };
  /**
   * Hash do conteúdo (apenas correlação, nunca conteúdo).
   */
  content_hash?: string | undefined;
  /**
   * Indicação de que o evento envolve link externo. Inferido pelo
   * caller a partir do metadata (ex.: `metadata.has_external_url=true`).
   * Nunca a URL em si — apenas o flag.
   */
  has_external_link?: boolean | undefined;
  /**
   * Indicação de que o evento envolve mídia. Idem — apenas o flag.
   */
  has_media?: boolean | undefined;
}

export interface RuleDecision {
  rule_code: SafetyRuleCode;
  triggered: boolean;
  reason_code: string;
  severity: SafetySeverity;
  risk_category: SafetyRiskCategory;
  actions: SafetyAction[];
}

export interface AggregatedDecision {
  decision:
    | 'no_risk_signal'
    | 'logged'
    | 'soft_blocked'
    | 'hard_blocked'
    | 'step_up_required'
    | 'parental_consent_required'
    | 'needs_review';
  reason_codes: string[];
  severity: SafetySeverity;
  risk_category: SafetyRiskCategory;
  actions: SafetyAction[];
  step_up_required: boolean;
  parental_consent_required: boolean;
  triggered_rules: SafetyRuleCode[];
}

const SEV_RANK: Record<SafetySeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function maxSeverity(
  a: SafetySeverity,
  b: SafetySeverity,
): SafetySeverity {
  return SEV_RANK[a] >= SEV_RANK[b] ? a : b;
}

/**
 * Defense-in-depth: enforce that high/critical severity always carries
 * at least one human-review action (`escalate_to_human_review` or
 * `notify_safety_team`). Used to backstop tenant overrides that may
 * accidentally drop human review from the action set.
 *
 * Returns a new array with `notify_safety_team` appended when missing.
 * Order is preserved so audit logs remain stable.
 */
export function enforceSeverityActionInvariant(
  severity: SafetySeverity,
  actions: ReadonlyArray<SafetyAction>,
): SafetyAction[] {
  const out = Array.from(actions);
  if (severity !== 'high' && severity !== 'critical') return out;
  const hasHumanReview =
    out.includes('escalate_to_human_review') ||
    out.includes('notify_safety_team');
  if (!hasHumanReview) out.push('notify_safety_team');
  return out;
}

// ============================================================
// Regras sistêmicas (5)
// ============================================================

function ruleUnknownToMinorPrivateMessage(ctx: RuleContext): RuleDecision {
  const triggered =
    isUnknownToMinor(ctx.relationship) &&
    (ctx.event_type === 'message_sent' ||
      ctx.event_type === 'private_chat_started');
  return {
    rule_code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    triggered,
    reason_code: triggered
      ? 'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE'
      : 'SAFETY_NO_RISK_SIGNAL',
    severity: triggered ? 'high' : 'info',
    risk_category: triggered ? 'unknown_to_minor_contact' : 'no_risk_signal',
    actions: triggered
      ? ['request_step_up', 'soft_block', 'notify_safety_team']
      : [],
  };
}

function ruleAdultMinorHighFrequency24h(
  ctx: RuleContext,
  cfg: Record<string, unknown> | undefined,
): RuleDecision {
  const threshold =
    typeof cfg?.threshold_messages === 'number'
      ? cfg.threshold_messages
      : 20;
  const count = ctx.aggregates.adult_to_minor_messages_24h ?? 0;
  const triggered =
    isAdultToMinor(ctx.relationship) &&
    (ctx.event_type === 'message_sent' ||
      ctx.event_type === 'message_received') &&
    count >= threshold;
  return {
    rule_code: 'ADULT_MINOR_HIGH_FREQUENCY_24H',
    triggered,
    reason_code: triggered
      ? 'SAFETY_ADULT_MINOR_HIGH_FREQUENCY_24H'
      : 'SAFETY_NO_RISK_SIGNAL',
    severity: triggered ? 'high' : 'info',
    risk_category: triggered
      ? 'high_frequency_adult_minor'
      : 'no_risk_signal',
    actions: triggered
      ? ['notify_safety_team', 'escalate_to_human_review', 'rate_limit_actor']
      : [],
  };
}

function ruleMediaUploadToMinor(ctx: RuleContext): RuleDecision {
  const involvesMinorRecipient =
    ctx.relationship === 'adult_to_minor' ||
    ctx.relationship === 'unknown_to_minor' ||
    ctx.relationship === 'minor_to_minor';
  const triggered =
    ctx.event_type === 'media_upload' &&
    involvesMinorRecipient &&
    (ctx.has_media ?? true);
  return {
    rule_code: 'MEDIA_UPLOAD_TO_MINOR',
    triggered,
    reason_code: triggered
      ? 'SAFETY_MEDIA_UPLOAD_TO_MINOR'
      : 'SAFETY_NO_RISK_SIGNAL',
    severity: triggered ? 'medium' : 'info',
    risk_category: triggered ? 'media_to_minor' : 'no_risk_signal',
    actions: triggered ? ['log_only', 'request_parental_consent_check'] : [],
  };
}

function ruleExternalLinkToMinor(ctx: RuleContext): RuleDecision {
  const involvesMinorRecipient =
    ctx.relationship === 'adult_to_minor' ||
    ctx.relationship === 'unknown_to_minor' ||
    ctx.relationship === 'minor_to_minor';
  const triggered =
    ctx.event_type === 'external_link_shared' &&
    involvesMinorRecipient &&
    Boolean(ctx.has_external_link);
  return {
    rule_code: 'EXTERNAL_LINK_TO_MINOR',
    triggered,
    reason_code: triggered
      ? 'SAFETY_EXTERNAL_LINK_TO_MINOR'
      : 'SAFETY_NO_RISK_SIGNAL',
    severity: triggered ? 'medium' : 'info',
    risk_category: triggered ? 'external_content_to_minor' : 'no_risk_signal',
    actions: triggered ? ['log_only', 'soft_block'] : [],
  };
}

function ruleMultipleReportsAgainstActor(
  ctx: RuleContext,
  cfg: Record<string, unknown> | undefined,
): RuleDecision {
  const threshold =
    typeof cfg?.threshold_reports === 'number'
      ? cfg.threshold_reports
      : 3;
  const count = ctx.aggregates.reports_against_actor_7d ?? 0;
  const triggered = count >= threshold;
  return {
    rule_code: 'MULTIPLE_REPORTS_AGAINST_ACTOR',
    triggered,
    reason_code: triggered
      ? 'SAFETY_MULTIPLE_REPORTS_AGAINST_ACTOR'
      : 'SAFETY_NO_RISK_SIGNAL',
    severity: triggered ? 'critical' : 'info',
    risk_category: triggered ? 'reported_actor' : 'no_risk_signal',
    actions: triggered
      ? ['notify_safety_team', 'escalate_to_human_review', 'rate_limit_actor']
      : [],
  };
}

const RULES: Array<{
  code: SafetyRuleCode;
  fn: (ctx: RuleContext, cfg: Record<string, unknown> | undefined) => RuleDecision;
}> = [
  { code: 'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE', fn: ruleUnknownToMinorPrivateMessage },
  { code: 'ADULT_MINOR_HIGH_FREQUENCY_24H', fn: ruleAdultMinorHighFrequency24h },
  { code: 'MEDIA_UPLOAD_TO_MINOR', fn: ruleMediaUploadToMinor },
  { code: 'EXTERNAL_LINK_TO_MINOR', fn: ruleExternalLinkToMinor },
  { code: 'MULTIPLE_REPORTS_AGAINST_ACTOR', fn: ruleMultipleReportsAgainstActor },
];

// ============================================================
// Avaliação agregada
// ============================================================

export function evaluateAllRules(
  ctx: RuleContext,
  configs: ReadonlyArray<RuleConfig>,
): { individual: RuleDecision[]; aggregated: AggregatedDecision } {
  const cfgByCode = new Map<SafetyRuleCode, RuleConfig>();
  for (const c of configs) {
    if (c.enabled) cfgByCode.set(c.rule_code, c);
  }

  const individual: RuleDecision[] = [];
  for (const r of RULES) {
    const cfg = cfgByCode.get(r.code);
    if (!cfg) continue; // regra desabilitada
    const out = r.fn(ctx, cfg.config_json);
    // Override severity/actions com config do tenant (rule.config tem precedência).
    if (out.triggered) {
      out.severity = cfg.severity;
      // Defense-in-depth: aplica invariante severity↔action mesmo se o
      // tenant tiver desabilitado human-review num override.
      out.actions = enforceSeverityActionInvariant(cfg.severity, cfg.actions);
    }
    individual.push(out);
  }

  const triggered = individual.filter((d) => d.triggered);
  if (triggered.length === 0) {
    return {
      individual,
      aggregated: {
        decision: 'no_risk_signal',
        reason_codes: ['SAFETY_NO_RISK_SIGNAL'],
        severity: 'info',
        risk_category: 'no_risk_signal',
        actions: [],
        step_up_required: false,
        parental_consent_required: false,
        triggered_rules: [],
      },
    };
  }

  let severity: SafetySeverity = 'info';
  const actions = new Set<SafetyAction>();
  const reasonCodes = new Set<string>();
  let topCategory: SafetyRiskCategory = 'no_risk_signal';
  let topSevForCategory = 0;
  for (const t of triggered) {
    severity = maxSeverity(severity, t.severity);
    for (const a of t.actions) actions.add(a);
    reasonCodes.add(t.reason_code);
    if (SEV_RANK[t.severity] > topSevForCategory) {
      topSevForCategory = SEV_RANK[t.severity];
      topCategory = t.risk_category;
    }
  }

  // Aggregated invariant: high/critical severity must carry human review.
  for (const a of enforceSeverityActionInvariant(severity, Array.from(actions))) {
    actions.add(a);
  }

  const stepUp = actions.has('request_step_up');
  const parentalCheck = actions.has('request_parental_consent_check');
  const hardBlock = actions.has('hard_block');
  const softBlock = actions.has('soft_block');
  const escalate = actions.has('escalate_to_human_review');

  let decision: AggregatedDecision['decision'];
  if (hardBlock) decision = 'hard_blocked';
  else if (escalate) decision = 'needs_review';
  else if (stepUp) decision = 'step_up_required';
  else if (parentalCheck) decision = 'parental_consent_required';
  else if (softBlock) decision = 'soft_blocked';
  else decision = 'logged';

  return {
    individual,
    aggregated: {
      decision,
      reason_codes: Array.from(reasonCodes),
      severity,
      risk_category: topCategory,
      actions: Array.from(actions),
      step_up_required: stepUp,
      parental_consent_required: parentalCheck,
      triggered_rules: triggered.map((t) => t.rule_code),
    },
  };
}
