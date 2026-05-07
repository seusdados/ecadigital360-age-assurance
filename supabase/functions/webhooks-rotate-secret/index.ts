// POST /v1/webhooks-rotate-secret — rotate the signing secret of an endpoint.
//
// Generates a fresh raw secret, overwrites the stored sha256 hash, and returns
// the raw value EXACTLY ONCE. There is no overlap window — deliveries signed
// after this call use the new secret immediately. (Webhook signatures are
// pre-computed at enqueue time, so already-queued deliveries keep the old
// signature; that is intentional — only future events use the new secret.)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext, sha256Hex } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { newWebhookSecret } from '../_shared/credentials.ts';
import { WebhookRotateSecretRequestSchema } from '../../../packages/shared/src/schemas/webhooks.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';
import { AgeKeyError } from '../../../packages/shared/src/errors.ts';

const FN = 'webhooks-rotate-secret';

class WebhookNotFoundError extends AgeKeyError {
  constructor() {
    super(404, REASON_CODES.WEBHOOK_NOT_FOUND, 'Webhook endpoint not found');
    this.name = 'WebhookNotFoundError';
  }
}

class WebhookForbiddenTenantError extends AgeKeyError {
  constructor() {
    super(
      403,
      REASON_CODES.WEBHOOK_FORBIDDEN_TENANT,
      'Webhook endpoint belongs to another tenant',
    );
    this.name = 'WebhookForbiddenTenantError';
  }
}

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
    await checkRateLimit(client, principal.apiKeyHash, FN, principal.tenantId);

    const parsed = WebhookRotateSecretRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const { id } = parsed.data;

    const { data: existing, error: existingErr } = await client
      .from('webhook_endpoints')
      .select('id, tenant_id, deleted_at')
      .eq('id', id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing || existing.deleted_at) throw new WebhookNotFoundError();
    if (existing.tenant_id !== principal.tenantId) {
      throw new WebhookForbiddenTenantError();
    }

    const rawSecret = newWebhookSecret();
    const secretHash = await sha256Hex(rawSecret);
    const rotatedAt = new Date().toISOString();

    const upd = await client
      .from('webhook_endpoints')
      .update({ secret_hash: secretHash })
      .eq('id', id)
      .eq('tenant_id', principal.tenantId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (upd.error) throw upd.error;
    if (!upd.data) throw new WebhookNotFoundError();

    log.info('webhook_secret_rotated', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      endpoint_id: id,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      {
        id: upd.data.id,
        raw_secret: rawSecret,
        rotated_at: rotatedAt,
      },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
