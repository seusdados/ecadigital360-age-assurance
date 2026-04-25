// POST /v1/applications-rotate-key — rotate the api_key of an application.
//
// Returns the NEW raw key once; the old hash is overwritten so any future
// request signed with the old key gets 401. Webhook secret is NOT rotated
// here — use a separate flow for that (out of scope in MVP).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext, sha256Hex } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { newApiKey } from '../_shared/credentials.ts';
import { ApplicationRotateKeyRequestSchema } from '../../../packages/shared/src/schemas/admin.ts';
import { config } from '../_shared/env.ts';

const FN = 'applications-rotate-key';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };
  const t0 = Date.now();

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'applications-rotate-key',
      principal.tenantId,
    );

    const parsed = ApplicationRotateKeyRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const { application_id } = parsed.data;

    const { data: app, error: appErr } = await client
      .from('applications')
      .select('id, tenant_id, deleted_at')
      .eq('id', application_id)
      .maybeSingle();
    if (appErr) throw appErr;
    if (!app || app.deleted_at) throw new NotFoundError('Application not found');
    if (app.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Application belongs to another tenant');
    }

    const env = config.environment();
    const envLabel: 'live' | 'test' | 'dev' =
      env === 'production' ? 'live' : env === 'development' ? 'dev' : 'test';
    const newKey = newApiKey(envLabel);
    const newHash = await sha256Hex(newKey.raw);

    const upd = await client
      .from('applications')
      .update({
        api_key_hash: newHash,
        api_key_prefix: newKey.prefix,
      })
      .eq('id', application_id)
      .select('id')
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) throw new NotFoundError('Application not found');

    log.info('application_key_rotated', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      {
        application_id,
        api_key: newKey.raw,
        api_key_prefix: newKey.prefix,
        rotated_at: new Date().toISOString(),
      },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
