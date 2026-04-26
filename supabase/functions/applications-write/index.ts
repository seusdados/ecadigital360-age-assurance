// POST /v1/applications-write — create or update an application.
//
// On create: returns raw api_key + raw webhook_secret EXACTLY ONCE.
//            Caller MUST store them; the panel never sees them again.
// On update: api_key/webhook_secret in response are null.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext, sha256Hex } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  InvalidRequestError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { newApiKey, newWebhookSecret } from '../_shared/credentials.ts';
import { ApplicationWriteRequestSchema } from '../../../packages/shared/src/schemas/admin.ts';
import { config } from '../_shared/env.ts';

const FN = 'applications-write';

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
      'applications-write',
      principal.tenantId,
    );

    const parsed = ApplicationWriteRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    const env = config.environment();
    const envLabel: 'live' | 'test' | 'dev' =
      env === 'production' ? 'live' : env === 'development' ? 'dev' : 'test';

    if (input.id) {
      // UPDATE — never rotates the api_key or secret.
      const upd = await client
        .from('applications')
        .update({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          callback_url: input.callback_url ?? null,
          webhook_url: input.webhook_url ?? null,
          allowed_origins: input.allowed_origins,
        })
        .eq('id', input.id)
        .eq('tenant_id', principal.tenantId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      if (upd.error) throw upd.error;
      if (!upd.data) throw new NotFoundError('Application not found');

      log.info('application_updated', {
        fn: FN,
        trace_id,
        tenant_id: principal.tenantId,
        application_id: upd.data.id,
        duration_ms: Date.now() - t0,
      });

      return jsonResponse(
        { id: upd.data.id, status: 'updated', api_key: null, webhook_secret: null },
        { origin },
      );
    }

    // CREATE — generate raw credentials, store hashes only.
    const apiKey = newApiKey(envLabel);
    const webhookSecret = newWebhookSecret();
    const apiKeyHash = await sha256Hex(apiKey.raw);
    const webhookSecretHash = await sha256Hex(webhookSecret);

    const ins = await client
      .from('applications')
      .insert({
        tenant_id: principal.tenantId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKey.prefix,
        callback_url: input.callback_url ?? null,
        webhook_url: input.webhook_url ?? null,
        webhook_secret_hash: webhookSecretHash,
        allowed_origins: input.allowed_origins,
      })
      .select('id')
      .single();
    if (ins.error || !ins.data) throw ins.error ?? new Error('Insert failed');

    log.info('application_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: ins.data.id,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      {
        id: ins.data.id,
        status: 'created',
        api_key: apiKey.raw,
        webhook_secret: webhookSecret,
      },
      { origin, status: 201 },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
