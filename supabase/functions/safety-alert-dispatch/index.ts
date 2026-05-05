// POST /v1/safety/alert/:id/dispatch
//
// Operações de admin no alerta:
//   action: 'acknowledge' | 'escalate' | 'resolve' | 'dismiss'.
//
// Auth: X-AgeKey-API-Key (admin do tenant via api_key dedicada — em
// rodada futura, exigir role 'admin' via auth-jwt).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  ForbiddenError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { readSafetyFlags } from '../_shared/safety/feature-flags.ts';
import { SafetyAlertActionRequestSchema } from '../../../packages/shared/src/schemas/safety.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'safety-alert-dispatch';

function extractAlertId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i] ?? '';
    if (/^[0-9a-f-]{36}$/i.test(seg)) return seg;
  }
  return null;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const flags = readSafetyFlags();
    if (!flags.enabled) throw new ForbiddenError('Safety Signals module disabled.');

    const url = new URL(req.url);
    const alertId = extractAlertId(url);
    if (!alertId) throw new InvalidRequestError('Invalid alert id');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    assertPayloadSafe(body, 'admin_minimized_view');
    const parsed = SafetyAlertActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    const { data: alertRow, error } = await client
      .from('safety_alerts')
      .select('id, tenant_id, status')
      .eq('id', alertId)
      .maybeSingle();
    if (error) throw error;
    if (!alertRow) throw new NotFoundError('alert not found');
    if (alertRow.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('cross-tenant access denied');
    }

    const newStatus = (() => {
      switch (parsed.data.action) {
        case 'acknowledge':
          return 'acknowledged';
        case 'escalate':
          return 'escalated';
        case 'resolve':
          return 'resolved';
        case 'dismiss':
          return 'dismissed';
      }
    })();

    const update: Record<string, unknown> = { status: newStatus };
    if (parsed.data.note) update.resolved_note = parsed.data.note;
    if (newStatus === 'resolved' || newStatus === 'dismissed') {
      update.resolved_at = new Date().toISOString();
    }

    const { error: updErr } = await client
      .from('safety_alerts')
      .update(update)
      .eq('id', alertId);
    if (updErr) throw updErr;

    log.info('safety_alert_status_changed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      alert_id: alertId,
      action: parsed.data.action,
      new_status: newStatus,
      status: 200,
    });

    return jsonResponse(
      { id: alertId, status: newStatus },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
