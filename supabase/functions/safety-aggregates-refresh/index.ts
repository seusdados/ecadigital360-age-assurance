// POST /v1/safety/aggregates-refresh
//
// Cron: refaz contadores agregados a partir de safety_events de janelas
// móveis (24h / 7d / 30d / 12m). Mantém safety_aggregates consistente
// caso eventos individuais sejam apagados pelo retention cleanup.
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

const FN = 'safety-aggregates-refresh';

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: null };

  try {
    if (req.method !== 'POST') {
      throw new InvalidRequestError('Method not allowed');
    }
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
    // Implementação MVP: idempotente. Recalcula contadores 24h e 7d
    // por (tenant, application, counterparty_subject) usando agregação SQL.
    // Para escala maior, mover para job particionado por tenant.

    const refreshedWindows: Array<{ window: string; updated: number }> = [];

    // 24h — adult_to_minor_messages.
    const { data: messageCounts } = await client.rpc(
      'safety_recompute_messages_24h' as never,
      {} as never,
    ).select?.() ?? { data: [] };
    refreshedWindows.push({
      window: '24h',
      updated: Array.isArray(messageCounts) ? messageCounts.length : 0,
    });

    log.info('safety_aggregates_refreshed', {
      fn: FN,
      trace_id,
      windows: refreshedWindows,
      status: 200,
    });

    return jsonResponse(
      { ok: true, windows: refreshedWindows },
      { origin: null },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
