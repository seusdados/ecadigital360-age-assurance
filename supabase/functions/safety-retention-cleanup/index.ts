// POST /v1/safety/retention-cleanup
//
// Cron: apaga safety_events expirados respeitando retention_class e
// **bloqueia legal_hold = true**. Aggregates sobrevivem (alimentados
// por safety-aggregates-refresh).
//
// Auth: Bearer CRON_SECRET.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  ForbiddenError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { config } from '../_shared/env.ts';
import { readSafetyFlags } from '../_shared/safety/feature-flags.ts';
import { writeAuditEvent } from '../_shared/audit.ts';

const FN = 'safety-retention-cleanup';

const RETENTION_CLASS_TO_DAYS: Record<string, number> = {
  no_store: 0,
  session_24h: 1,
  session_7d: 7,
  event_30d: 30,
  event_90d: 90,
  event_180d: 180,
  alert_12m: 365,
  case_24m: 730,
  // legal_hold é tratado em código: nunca expira.
};

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: null };

  try {
    if (req.method !== 'POST') throw new InvalidRequestError('Method not allowed');
    if (req.headers.get('authorization') !== `Bearer ${config.cronSecret()}`) {
      throw new ForbiddenError('Invalid cron secret');
    }
    const flags = readSafetyFlags();
    if (!flags.enabled) {
      return jsonResponse(
        { ok: true, skipped: true, reason: 'safety_disabled' },
        { origin: null },
      );
    }

    const client = db();
    const batchSize = flags.retentionCleanupBatchSize;

    // Sinaliza ao trigger que este DELETE é cleanup autorizado.
    await client.rpc('set_config' as never, {
      setting_name: 'agekey.retention_cleanup',
      new_value: 'on',
      is_local: false,
    } as never);

    let totalDeleted = 0;
    const perClass: Array<{ class: string; deleted: number }> = [];

    for (const [retClass, days] of Object.entries(RETENTION_CLASS_TO_DAYS)) {
      if (retClass === 'no_store' || days === 0) continue;
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

      const { data: candidates } = await client
        .from('safety_events')
        .select('id, tenant_id')
        .eq('retention_class', retClass)
        .eq('legal_hold', false)
        .lt('occurred_at', cutoff)
        .limit(batchSize);

      const ids = (
        (candidates as Array<{ id: string; tenant_id: string }> | null) ?? []
      ).map((c) => c.id);
      if (ids.length === 0) {
        perClass.push({ class: retClass, deleted: 0 });
        continue;
      }

      const { error: delErr } = await client
        .from('safety_events')
        .delete()
        .in('id', ids);
      if (delErr) {
        log.error('safety_retention_cleanup_delete_error', {
          fn: FN,
          trace_id,
          retention_class: retClass,
          error: delErr.message,
        });
        throw delErr;
      }

      const tenantSet = new Set<string>(
        ((candidates as Array<{ tenant_id: string }> | null) ?? []).map(
          (c) => c.tenant_id,
        ),
      );
      for (const tenantId of tenantSet) {
        await writeAuditEvent(client, {
          tenantId,
          actorType: 'cron',
          action: 'safety.retention_cleanup',
          resourceType: 'safety_events',
          diff: {
            retention_class: retClass,
            cutoff,
            deleted_in_tenant: ids.length,
          },
        });
      }

      totalDeleted += ids.length;
      perClass.push({ class: retClass, deleted: ids.length });
    }

    log.info('safety_retention_cleanup_run', {
      fn: FN,
      trace_id,
      total_deleted: totalDeleted,
      per_class: perClass,
      status: 200,
    });

    return jsonResponse(
      { ok: true, total_deleted: totalDeleted, per_class: perClass },
      { origin: null },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
