// Regras puras de cleanup por classe de retenção.
//
// Pure: testável em vitest. Não fala com banco.

import type { AgeKeyRetentionClass } from './retention-classes.ts';

export interface CleanupDecision {
  shouldDelete: boolean;
  reason:
    | 'within_ttl'
    | 'ttl_expired'
    | 'legal_hold_active'
    | 'no_store_does_not_persist'
    | 'dynamic_ttl_unspecified'
    | 'unknown_class';
}

export interface CleanupContext {
  /** Timestamp atual (epoch ms). */
  now: number;
  /** Quando a linha foi criada/registrada (epoch ms). */
  occurredAt: number;
  /** Classe canônica de retenção. */
  retentionClass: AgeKeyRetentionClass | string;
  /** Linha tem `legal_hold = true`. */
  legalHold: boolean;
  /**
   * TTL dinâmico em segundos quando `retentionClass` é
   * `verification_result_policy_ttl` ou `result_token_policy_ttl`.
   */
  policyTtlSeconds?: number | undefined;
}

const DAY_MS = 86_400_000;

const STATIC_TTL_DAYS: Record<string, number> = {
  no_store: 0,
  session_24h: 1,
  session_7d: 7,
  otp_24h: 1,
  otp_30d: 30,
  event_30d: 30,
  event_90d: 90,
  event_180d: 180,
  aggregate_12m: 365,
  consent_expired_audit_window: 365,
  alert_12m: 365,
  case_24m: 730,
};

export function decideCleanup(ctx: CleanupContext): CleanupDecision {
  if (ctx.legalHold) {
    return { shouldDelete: false, reason: 'legal_hold_active' };
  }
  if (ctx.retentionClass === 'legal_hold') {
    // Por design, classe legal_hold nunca cleanup automático.
    return { shouldDelete: false, reason: 'legal_hold_active' };
  }
  if (ctx.retentionClass === 'no_store') {
    return { shouldDelete: false, reason: 'no_store_does_not_persist' };
  }

  // Classes com TTL dinâmico baseado em policy.
  if (
    ctx.retentionClass === 'verification_result_policy_ttl' ||
    ctx.retentionClass === 'result_token_policy_ttl' ||
    ctx.retentionClass === 'consent_active_until_expiration'
  ) {
    if (typeof ctx.policyTtlSeconds !== 'number' || ctx.policyTtlSeconds <= 0) {
      return { shouldDelete: false, reason: 'dynamic_ttl_unspecified' };
    }
    const ttlMs = ctx.policyTtlSeconds * 1000;
    if (ctx.now - ctx.occurredAt >= ttlMs) {
      return { shouldDelete: true, reason: 'ttl_expired' };
    }
    return { shouldDelete: false, reason: 'within_ttl' };
  }

  const days = STATIC_TTL_DAYS[ctx.retentionClass as string];
  if (typeof days !== 'number') {
    return { shouldDelete: false, reason: 'unknown_class' };
  }
  if (days === 0) {
    return { shouldDelete: false, reason: 'no_store_does_not_persist' };
  }
  if (ctx.now - ctx.occurredAt >= days * DAY_MS) {
    return { shouldDelete: true, reason: 'ttl_expired' };
  }
  return { shouldDelete: false, reason: 'within_ttl' };
}
