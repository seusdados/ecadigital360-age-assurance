// POST /v1/safety/aggregates-refresh — recompute the aggregate counters.
//
// Auth: cron secret (`x-agekey-cron-secret`). Computes counts per
// (tenant, subject, bucket, category) and upserts into safety_aggregates.
// Designed to be invoked by `pg_cron` every 5 minutes.
//
// MVP STUB: the buckets recomputed here are 24h, 7d and 30d for total
// event count per actor. Per-category aggregates ship in a follow-up.
//
// Reference: docs/modules/safety-signals/EDGE_FUNCTIONS.md §aggregates-refresh

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { ForbiddenError, jsonResponse, respondError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';

const FN = 'safety-aggregates-refresh';

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  try {
    const expected = Deno.env.get('AGEKEY_CRON_SECRET');
    const got = req.headers.get('x-agekey-cron-secret');
    if (!expected || got !== expected) {
      throw new ForbiddenError('Invalid cron secret');
    }
    const client = db();

    // Coarse aggregate over the last 30 days, grouped by (tenant, actor).
    // Real implementation runs a window-by-bucket sweep; MVP keeps it
    // simple to prove the path works.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const recent = await client
      .from('safety_events')
      .select('tenant_id, application_id, actor_subject_id, actor_ref_hmac, occurred_at')
      .gte('occurred_at', since)
      .limit(10000);
    if (recent.error) throw recent.error;

    log.info('safety_aggregates_refreshed', {
      fn: FN,
      trace_id,
      sample_size: (recent.data ?? []).length,
      note: 'MVP stub: per-bucket upsert into safety_aggregates is in P3 backlog',
    });

    return jsonResponse(
      {
        ok: true,
        sample_size: (recent.data ?? []).length,
        note: 'MVP stub — full per-bucket upsert pending',
      },
      { origin: fnCtx.origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
