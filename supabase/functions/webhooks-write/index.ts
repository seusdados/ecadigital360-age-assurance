// POST /v1/webhooks-write — create / update / soft-delete a webhook endpoint.
//
// Auth: X-AgeKey-API-Key (admin role enforced by RLS on webhook_endpoints).
//
// Body shape (validated by WebhookEndpointWriteRequestSchema):
//   { id?, application_id, name, url, event_types[], active?, delete? }
//
// CREATE: id absent → inserts new row, generates raw secret, returns it ONCE.
// UPDATE: id present → updates name/url/event_types/active for the same row.
// DELETE: id present + delete: true → soft-delete (sets deleted_at).
//
// Anti-SSRF lives in the shared Zod schema (`validateWebhookUrl`) — no `http`,
// no internal/private hosts.

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
import { newWebhookSecret } from '../_shared/credentials.ts';
import { WebhookEndpointWriteRequestSchema } from '../../../packages/shared/src/schemas/webhooks.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';
import { AgeKeyError } from '../../../packages/shared/src/errors.ts';

const FN = 'webhooks-write';

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

  if (req.method !== 'POST' && req.method !== 'PUT') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(client, principal.apiKeyHash, FN, principal.tenantId);

    const parsed = WebhookEndpointWriteRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    // Verify the application belongs to the tenant. RLS would catch this
    // anyway via the FK insert, but we want a clean 403 instead of a raw
    // PG error leaking into the response.
    const { data: app, error: appErr } = await client
      .from('applications')
      .select('id, tenant_id, deleted_at')
      .eq('id', input.application_id)
      .maybeSingle();
    if (appErr) throw appErr;
    if (!app || app.deleted_at) {
      throw new NotFoundError('Application not found');
    }
    if (app.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Application belongs to another tenant');
    }

    // ---------- DELETE (soft) ----------
    if (input.id && input.delete === true) {
      const existing = await client
        .from('webhook_endpoints')
        .select('id, tenant_id, deleted_at')
        .eq('id', input.id)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data || existing.data.deleted_at) {
        throw new WebhookNotFoundError();
      }
      if (existing.data.tenant_id !== principal.tenantId) {
        throw new WebhookForbiddenTenantError();
      }

      const upd = await client
        .from('webhook_endpoints')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'inactive',
        })
        .eq('id', input.id)
        .eq('tenant_id', principal.tenantId)
        .select('id')
        .maybeSingle();
      if (upd.error) throw upd.error;
      if (!upd.data) throw new WebhookNotFoundError();

      log.info('webhook_deleted', {
        fn: FN,
        trace_id,
        tenant_id: principal.tenantId,
        endpoint_id: input.id,
        duration_ms: Date.now() - t0,
      });

      return jsonResponse(
        { id: upd.data.id, status: 'deleted', raw_secret: null },
        { origin },
      );
    }

    // ---------- UPDATE ----------
    if (input.id) {
      const existing = await client
        .from('webhook_endpoints')
        .select('id, tenant_id, deleted_at')
        .eq('id', input.id)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data || existing.data.deleted_at) {
        throw new WebhookNotFoundError();
      }
      if (existing.data.tenant_id !== principal.tenantId) {
        throw new WebhookForbiddenTenantError();
      }

      const upd = await client
        .from('webhook_endpoints')
        .update({
          name: input.name,
          url: input.url,
          events: input.event_types,
          status: input.active ? 'active' : 'inactive',
        })
        .eq('id', input.id)
        .eq('tenant_id', principal.tenantId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      if (upd.error) throw upd.error;
      if (!upd.data) throw new WebhookNotFoundError();

      log.info('webhook_updated', {
        fn: FN,
        trace_id,
        tenant_id: principal.tenantId,
        endpoint_id: upd.data.id,
        duration_ms: Date.now() - t0,
      });

      return jsonResponse(
        { id: upd.data.id, status: 'updated', raw_secret: null },
        { origin },
      );
    }

    // ---------- CREATE ----------
    const rawSecret = newWebhookSecret();
    const secretHash = await sha256Hex(rawSecret);

    const ins = await client
      .from('webhook_endpoints')
      .insert({
        tenant_id: principal.tenantId,
        application_id: input.application_id,
        name: input.name,
        url: input.url,
        secret_hash: secretHash,
        status: input.active ? 'active' : 'inactive',
        events: input.event_types,
      })
      .select('id')
      .single();
    if (ins.error || !ins.data) throw ins.error ?? new Error('Insert failed');

    log.info('webhook_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      endpoint_id: ins.data.id,
      application_id: input.application_id,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      {
        id: ins.data.id,
        status: 'created',
        raw_secret: rawSecret,
      },
      { origin, status: 201 },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
