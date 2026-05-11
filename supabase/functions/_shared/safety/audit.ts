// Safety-specific audit helper. Wraps the generic writeAuditEvent
// helper enforcing the AgeKey Safety Signals invariants:
//
//   - never log raw content (message/raw_text/image/video/audio).
//   - never log PII (name/cpf/email/phone/birthdate/face/biometric/...).
//   - never log raw IP.
//   - only opaque ids, tenant/application ids, rule_code, reason_codes,
//     severity, action verbs and payload_hash when available.
//
// Outputs are append-only rows in `audit_events`. Failure to record
// the audit must NOT break the underlying business action (Safety
// ingest is non-blocking with respect to telemetry); errors are logged
// at warn level and swallowed.
//
// The sanitization rules live in `@agekey/shared` so that this helper
// and the unit-test suite share a single source of truth.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { writeAuditEvent, type AuditEventInput } from '../audit.ts';
import { log } from '../logger.ts';
import {
  sanitizeSafetyAuditDiff,
  type SafetyAuditAction,
  type SafetyAuditDiff,
} from '../../../../packages/shared/src/safety/audit-sanitize.ts';

export type { SafetyAuditAction, SafetyAuditDiff };

export interface SafetyAuditInput {
  client: SupabaseClient;
  tenantId: string;
  action: SafetyAuditAction;
  resourceType: 'safety_alert' | 'safety_event';
  resourceId: string | null;
  actorType: 'api_key' | 'system' | 'cron' | 'user';
  actorId?: string | null;
  diff?: SafetyAuditDiff;
  traceId?: string;
  fn?: string;
}

export async function writeSafetyAudit(input: SafetyAuditInput): Promise<void> {
  const payload: AuditEventInput = {
    tenantId: input.tenantId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    diff: input.diff ? sanitizeSafetyAuditDiff(input.diff) : {},
    clientIp: null,
    userAgent: null,
  };
  try {
    await writeAuditEvent(input.client, payload);
  } catch (err) {
    log.warn('safety_audit_write_failed', {
      fn: input.fn ?? 'safety-audit',
      trace_id: input.traceId,
      action: input.action,
      tenant_id: input.tenantId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      error: (err as Error)?.message ?? 'unknown',
    });
  }
}
