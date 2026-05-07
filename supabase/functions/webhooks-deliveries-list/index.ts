// POST /v1/webhooks-deliveries-list — paginated webhook_deliveries inspector.
//
// Auth: X-AgeKey-API-Key (operator+ enforced by RLS on webhook_deliveries).
//
// Filters:
//   - endpoint_id (required)
//   - status      (optional — pending|delivered|failed|dead_letter)
//   - since       (optional — ISO timestamp; created_at >= since)
//   - cursor      (optional — id of last returned row for keyset pagination)
//   - limit       (default 50, max 100)
//
// Returns deliveries newest-first. Use status='dead_letter' to inspect
// permanently failed deliveries (>= 6 attempts).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  InvalidRequestError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { WebhookDeliveriesListRequestSchema } from '../../../packages/shared/src/schemas/webhooks.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';
import { AgeKeyError } from '../../../packages/shared/src/errors.ts';

const FN = 'webhooks-deliveries-list';

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

    const parsed = WebhookDeliveriesListRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const q = parsed.data;

    // Tenant ownership check on the endpoint — keeps cross-tenant lookups
    // from leaking information via timing differences.
    const { data: endpoint, error: endpointErr } = await client
      .from('webhook_endpoints')
      .select('id, tenant_id, deleted_at')
      .eq('id', q.endpoint_id)
      .maybeSingle();
    if (endpointErr) throw endpointErr;
    if (!endpoint) throw new WebhookNotFoundError();
    if (endpoint.tenant_id !== principal.tenantId) {
      throw new WebhookForbiddenTenantError();
    }

    let query = client
      .from('webhook_deliveries')
      .select(
        'id, endpoint_id, tenant_id, event_type, payload_json, idempotency_key, status, attempts, next_attempt_at, last_response_code, last_error, created_at, updated_at',
      )
      .eq('tenant_id', principal.tenantId)
      .eq('endpoint_id', q.endpoint_id)
      .order('id', { ascending: false })
      .limit(q.limit + 1);

    if (q.status) query = query.eq('status', q.status);
    if (q.since) query = query.gte('created_at', q.since);
    if (q.cursor) query = query.lt('id', q.cursor);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      endpoint_id: string;
      tenant_id: string;
      event_type: string;
      payload_json: Record<string, unknown>;
      idempotency_key: string;
      status: string;
      attempts: number;
      next_attempt_at: string;
      last_response_code: number | null;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>;

    let items = rows;
    let hasMore = false;
    if (items.length > q.limit) {
      hasMore = true;
      items = items.slice(0, q.limit);
    }

    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    log.info('webhooks_deliveries_listed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      endpoint_id: q.endpoint_id,
      count: items.length,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      { items, next_cursor: nextCursor, has_more: hasMore },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
