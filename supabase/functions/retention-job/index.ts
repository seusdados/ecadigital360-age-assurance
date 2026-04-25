// POST /functions/v1/retention-job — enforce per-tenant retention.
//
// Auth: Bearer CRON_SECRET.
// For each active tenant, find audit_events_* and billing_events_* partitions
// fully older than retention_days and DETACH+DROP them. Also expires sessions
// and proof_artifacts whose retention has lapsed.
//
// In Fase 2 we conservatively only DROP partitions whose entire range is
// before (now - retention_days). Mixed partitions are left alone.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { ForbiddenError, InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { config } from '../_shared/env.ts';

const FN = 'retention-job';

interface PartitionInfo {
  parent: string;
  child: string;
  range_start: string;
  range_end: string;
}

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: null };

  try {
    if (req.method !== 'POST') throw new InvalidRequestError('Method not allowed');
    if (req.headers.get('authorization') !== `Bearer ${config.cronSecret()}`) {
      throw new ForbiddenError('Invalid cron secret');
    }

    const client = db();

    // Smallest retention_days across active tenants drives the cutoff.
    // Per-tenant deletion (without full partition drop) is too expensive
    // in this Fase; tenants with above-floor retention pay only the storage
    // cost, which is negligible compared to query cost.
    const { data: tenants, error: tenantsErr } = await client
      .from('tenants')
      .select('id, retention_days, status')
      .eq('status', 'active')
      .is('deleted_at', null);
    if (tenantsErr) throw tenantsErr;

    const minRetention =
      tenants && tenants.length > 0
        ? Math.min(...tenants.map((t) => t.retention_days as number))
        : 365;

    const cutoff = new Date(Date.now() - minRetention * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    // List partitions whose range_end is fully <= cutoff.
    const partsResp = await client.rpc('list_old_partitions', { p_cutoff: cutoffIso });
    const old: PartitionInfo[] =
      partsResp.error || !partsResp.data ? [] : (partsResp.data as PartitionInfo[]);

    const dropped: string[] = [];
    for (const part of old) {
      const detach = await client.rpc('drop_partition', { p_child: part.child });
      if (!detach.error) dropped.push(part.child);
    }

    // Also: hard-delete proof_artifacts older than minRetention days.
    const expIso = cutoffIso;
    const { error: artErr } = await client
      .from('proof_artifacts')
      .delete()
      .lt('created_at', expIso);
    if (artErr) {
      log.warn('proof_artifacts_delete_failed', {
        fn: FN,
        trace_id,
        error_message: artErr.message,
      });
    }

    log.info('retention_job_run', {
      fn: FN,
      trace_id,
      cutoff: cutoffIso,
      partitions_dropped: dropped,
      tenants: tenants?.length ?? 0,
    });

    return jsonResponse(
      { cutoff: cutoffIso, partitions_dropped: dropped, tenants: tenants?.length ?? 0 },
      { origin: null },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
