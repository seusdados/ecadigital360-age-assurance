// Retention classes — canonical mapping from data category to maximum
// retention window. The Core, the retention-job edge function and the
// upcoming Consent/Safety modules all read from this single table so the
// privacy policy and the database stay in lockstep.
//
// `max_seconds = null` means "no fixed cap, governed by tenant retention" or
// "permanent (hash-only)". The retention job interprets `null` as "no
// dedicated TTL — fall back to per-tenant `tenants.retention_days`".
//
// Reference: docs/specs/agekey-core-canonical-contracts.md §Retention.
//            supabase/functions/retention-job/index.ts
//            supabase/migrations/001_tenancy.sql (tenants.retention_days)

import { z } from 'zod';

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

/**
 * Retention class codes. The values are the wire spelling — they appear in
 * audit diffs and in the policy version snapshots, so they must remain
 * stable.
 */
export const RETENTION_CLASS_CODES = {
  EPHEMERAL: 'ephemeral',
  SHORT_LIVED: 'short_lived',
  STANDARD_AUDIT: 'standard_audit',
  REGULATORY: 'regulatory',
  PERMANENT_HASH: 'permanent_hash',
} as const;

export type RetentionClassCode =
  (typeof RETENTION_CLASS_CODES)[keyof typeof RETENTION_CLASS_CODES];

export interface RetentionClass {
  readonly code: RetentionClassCode;
  /** Hard cap on seconds. `null` defers to per-tenant configuration. */
  readonly max_seconds: number | null;
  readonly description_pt: string;
}

export const RETENTION_CLASSES: Readonly<
  Record<RetentionClassCode, RetentionClass>
> = {
  ephemeral: {
    code: 'ephemeral',
    max_seconds: 24 * 60 * 60, // 24h
    description_pt:
      'Dados de sessão (challenges, payloads de prova) que somem em até 24h.',
  },
  short_lived: {
    code: 'short_lived',
    max_seconds: 30 * SECONDS_PER_DAY,
    description_pt:
      'Artefatos derivados de prova (proof_artifacts) com utilidade de até 30 dias.',
  },
  standard_audit: {
    code: 'standard_audit',
    max_seconds: 90 * SECONDS_PER_DAY,
    description_pt:
      'Eventos de auditoria e tokens emitidos. Default do tenant é 90 dias; pode subir até 365.',
  },
  regulatory: {
    code: 'regulatory',
    max_seconds: 5 * SECONDS_PER_YEAR,
    description_pt:
      'Versões de policy, registros legais e (futuro) registros de consentimento. 5 anos.',
  },
  permanent_hash: {
    code: 'permanent_hash',
    max_seconds: null,
    description_pt:
      'Hashes irreversíveis (ex.: revogação por jti). Persistem indefinidamente porque não contêm PII.',
  },
};

/**
 * Mapping from data category (the kind of row a table stores) to the
 * retention class that governs it. The retention-job edge function and the
 * Admin UI both read from this table.
 *
 * Round 3 (Parental Consent) and Round 4 (Safety Signals) promoted their
 * categories from RESERVED to LIVE. Plumbing them through the retention-job
 * edge function is tracked in `safety-signals/RETENTION.md` and
 * `parental-consent/data-model.md` (P3 backlog).
 */
export const RETENTION_CATEGORIES = {
  session_state: 'ephemeral',
  challenge_nonce: 'ephemeral',
  proof_artifact: 'short_lived',
  result_token_index: 'standard_audit',
  audit_event: 'standard_audit',
  billing_event: 'standard_audit',
  policy_version: 'regulatory',
  webhook_delivery: 'standard_audit',
  consent_receipt: 'regulatory',
  consent_revocation: 'regulatory',
  consent_text_version: 'regulatory',
  guardian_verification: 'ephemeral',
  safety_event: 'standard_audit',
  safety_alert: 'standard_audit',
  safety_aggregate: 'short_lived',
  safety_risk_signal: 'short_lived',
} as const;

export type RetentionCategory = keyof typeof RETENTION_CATEGORIES;

export const RetentionClassCodeSchema = z.enum([
  RETENTION_CLASS_CODES.EPHEMERAL,
  RETENTION_CLASS_CODES.SHORT_LIVED,
  RETENTION_CLASS_CODES.STANDARD_AUDIT,
  RETENTION_CLASS_CODES.REGULATORY,
  RETENTION_CLASS_CODES.PERMANENT_HASH,
]);

export function getRetentionClassForCategory(
  category: RetentionCategory,
): RetentionClass {
  const code = RETENTION_CATEGORIES[category];
  return RETENTION_CLASSES[code];
}

/**
 * Resolve the effective retention window for a category, taking the per-tenant
 * cap into account. Returns the smaller of the class cap and the tenant cap;
 * `null` on the class side defers entirely to the tenant.
 */
export function effectiveRetentionSeconds(
  category: RetentionCategory,
  tenantRetentionDays: number,
): number {
  if (
    !Number.isInteger(tenantRetentionDays) ||
    tenantRetentionDays <= 0
  ) {
    throw new RangeError('tenantRetentionDays must be a positive integer');
  }
  const tenantSeconds = tenantRetentionDays * SECONDS_PER_DAY;
  const klass = getRetentionClassForCategory(category);
  if (klass.max_seconds == null) return tenantSeconds;
  return Math.min(klass.max_seconds, tenantSeconds);
}

/** Returns true when a category is reserved (not yet enforced).
 *  After Round 3 + 4 promoted both consent_* and safety_* to LIVE in
 *  RETENTION_CATEGORIES, this check returns false — kept as a structural
 *  hook for future modules.
 */
export function isReservedRetentionCategory(_category: string): boolean {
  return false;
}
