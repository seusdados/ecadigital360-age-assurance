// POST /functions/v1/trust-registry-refresh — periodically refresh issuer JWKS.
//
// Auth: Bearer CRON_SECRET. For each issuer with jwks_uri whose
// jwks_fetched_at is older than 6h, GETs the URI and updates
// public_keys_json. Failure on a single issuer does not abort the run.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { ForbiddenError, InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { config } from '../_shared/env.ts';

const FN = 'trust-registry-refresh';

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6h
const REQUEST_TIMEOUT_MS = 10_000;

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: null };

  try {
    if (req.method !== 'POST') throw new InvalidRequestError('Method not allowed');
    if (req.headers.get('authorization') !== `Bearer ${config.cronSecret()}`) {
      throw new ForbiddenError('Invalid cron secret');
    }

    const client = db();

    const { data: issuers, error } = await client
      .from('issuers')
      .select('id, issuer_did, jwks_uri, jwks_fetched_at')
      .not('jwks_uri', 'is', null)
      .is('deleted_at', null)
      .eq('trust_status', 'trusted');
    if (error) throw error;

    const refreshed: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const i of issuers ?? []) {
      const fetchedAt = i.jwks_fetched_at ? new Date(i.jwks_fetched_at).getTime() : 0;
      if (Date.now() - fetchedAt < STALE_AFTER_MS) continue;

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const resp = await fetch(i.jwks_uri!, { signal: ctrl.signal });
        if (!resp.ok) {
          failed.push({ id: i.id, error: `http_${resp.status}` });
          continue;
        }
        const jwks = await resp.json();
        if (!jwks || typeof jwks !== 'object' || !Array.isArray(jwks.keys)) {
          failed.push({ id: i.id, error: 'invalid_jwks_format' });
          continue;
        }
        const upd = await client
          .from('issuers')
          .update({
            public_keys_json: jwks,
            jwks_fetched_at: new Date().toISOString(),
          })
          .eq('id', i.id);
        if (upd.error) {
          failed.push({ id: i.id, error: 'db_update_failed' });
          continue;
        }
        refreshed.push(i.issuer_did);
      } catch (e) {
        failed.push({ id: i.id, error: e instanceof Error ? e.name : 'unknown' });
      } finally {
        clearTimeout(t);
      }
    }

    log.info('trust_registry_refresh', {
      fn: FN,
      trace_id,
      total: issuers?.length ?? 0,
      refreshed: refreshed.length,
      failed_count: failed.length,
    });

    return jsonResponse(
      { refreshed: refreshed.length, failed: failed.length, items: refreshed },
      { origin: null },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
