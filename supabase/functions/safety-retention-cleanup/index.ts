// POST /v1/safety/retention-cleanup — apply retention windows.
//
// Auth: cron secret. Deletes safety_events past their `retention_until`,
// keeps aggregates per RETENTION_CATEGORIES (`safety_aggregate=short_lived`),
// preserves alerts in `legal_hold` flag (gated by feature flag).
//
// MVP STUB: the function counts the rows that would be removed and
// returns the report; actual DELETEs are gated by
// `AGEKEY_SAFETY_LEGAL_HOLD_ENABLED=false` (legal hold OFF means the
// cleanup is allowed) and `AGEKEY_SAFETY_RETENTION_DRY_RUN=true` by
// default. Operators flip the dry-run env var to true delete in prod.
//
// Reference: docs/modules/safety-signals/RETENTION.md

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import {
  ForbiddenError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';

const FN = 'safety-retention-cleanup';

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  try {
    const expected = Deno.env.get('AGEKEY_CRON_SECRET');
    const got = req.headers.get('x-agekey-cron-secret');
    if (!expected || got !== expected) {
      throw new ForbiddenError('Invalid cron secret');
    }
    const dryRun =
      (Deno.env.get('AGEKEY_SAFETY_RETENTION_DRY_RUN') ?? 'true') !== 'false';
    const client = db();

    // Count rows with retention_until < now() and no legal_hold marker.
    // MVP doesn't store legal_hold yet (feature flag is off); the column
    // would land in the dedicated round.
    const nowIso = new Date().toISOString();
    const expired = await client
      .from('safety_events')
      .select('id', { count: 'exact', head: true })
      .lt('retention_until', nowIso);
    if (expired.error) throw expired.error;

    let deletedCount = 0;
    if (!dryRun && (expired.count ?? 0) > 0) {
      // Append-only safety_events has UPDATE/DELETE blocked by trigger.
      // Production deletes happen via partition DETACH (mirrors
      // audit_events partitioning approach in 006_audit_billing.sql).
      // This MVP stub does NOT execute deletes — it logs the intent so
      // operators can review before the partitioning round ships.
      log.warn('safety_retention_cleanup_skipped', {
        fn: FN,
        trace_id,
        note: 'safety_events is append-only via trigger; partition DETACH ships in P3',
        expired_count: expired.count,
      });
    }

    await client.from('audit_events').insert({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      actor_type: 'cron',
      action: 'safety.retention_cleanup_run',
      resource_type: 'safety_signal',
      resource_id: null,
      diff_json: {
        decision_domain: 'safety_signal',
        envelope_version: 1,
        expired_count: expired.count ?? 0,
        deleted_count: deletedCount,
        dry_run: dryRun,
        content_included: false,
        pii_included: false,
      },
    });

    return jsonResponse(
      {
        ok: true,
        dry_run: dryRun,
        expired_count: expired.count ?? 0,
        deleted_count: deletedCount,
      },
      { origin: fnCtx.origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
