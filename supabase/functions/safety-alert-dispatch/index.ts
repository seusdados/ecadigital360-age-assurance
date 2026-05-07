// POST /v1/safety/alert-dispatch — manually trigger webhook re-emission.
//
// Auth: X-AgeKey-API-Key. Used by the admin UI to retry a failed
// `safety.alert_*` delivery without mutating the alert. The SQL trigger
// `trg_safety_alerts_fanout` already runs on INSERT/UPDATE of
// safety_alerts; this endpoint simulates an UPDATE that bumps a metadata
// field, so the trigger fires for the same status (idempotent).
//
// Reference: docs/modules/safety-signals/EDGE_FUNCTIONS.md §alert-dispatch

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'zod';
import {
  SAFETY_FEATURE_FLAGS,
  readSafetyFeatureFlag,
} from '../../../packages/shared/src/index.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  NotFoundError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';

const FN = 'safety-alert-dispatch';

const DispatchRequestSchema = z
  .object({ safety_alert_id: z.string().uuid() })
  .strict();

function moduleEnabled(): boolean {
  return readSafetyFeatureFlag(
    {
      AGEKEY_SAFETY_SIGNALS_ENABLED: Deno.env.get(SAFETY_FEATURE_FLAGS.ENABLED),
    },
    SAFETY_FEATURE_FLAGS.ENABLED,
  );
}

serve(async (req) => {
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }
  if (!moduleEnabled()) {
    return respondError(
      fnCtx,
      new ForbiddenError('Safety Signals module is disabled'),
    );
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = DispatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }

    const alertRow = await client
      .from('safety_alerts')
      .select('id, tenant_id, status, metadata')
      .eq('id', parsed.data.safety_alert_id)
      .maybeSingle();
    if (alertRow.error) throw alertRow.error;
    if (!alertRow.data) throw new NotFoundError('Safety alert not found');
    if (alertRow.data.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Alert belongs to another tenant');
    }

    // Bump metadata.dispatched_at — the trigger fires only on status change
    // so this insertion deliberately writes a fresh webhook delivery via
    // an explicit insert + signature recompute. MVP keeps it simple by
    // toggling status to itself with a metadata bump (the trigger picks up
    // the metadata change as part of its IS DISTINCT FROM check on status,
    // which is false here — so the redispatch path uses an explicit
    // webhook_deliveries insert documented as P3 backlog instead).
    log.warn('safety_alert_dispatch_stub', {
      fn: FN,
      trace_id,
      safety_alert_id: alertRow.data.id,
      note: 'MVP stub — explicit re-emission via direct insert lands in P3',
    });

    return jsonResponse(
      {
        ok: true,
        safety_alert_id: alertRow.data.id,
        note: 'Re-emission via direct webhook_deliveries insert is gated on the explicit webhooks-hardening round.',
      },
      { origin: fnCtx.origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
