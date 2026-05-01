// GET /v1/webhooks-list — list webhook endpoints for the tenant.
//
// Auth: X-AgeKey-API-Key. Returns endpoints scoped to the caller's tenant
// (RLS enforces it as well). The `secret_hash` is NEVER returned — only the
// public metadata + the latest delivery rollup.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'webhooks-list';

interface EndpointRow {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  url: string;
  status: string;
  events: string[];
  created_at: string;
  updated_at: string;
}

interface DeliveryRollup {
  endpoint_id: string;
  status: string;
  updated_at: string;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };
  const t0 = Date.now();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(client, principal.apiKeyHash, FN, principal.tenantId);

    // Optional filters via query string (preferred) OR JSON body.
    const url = new URL(req.url);
    const applicationId = url.searchParams.get('application_id') ?? undefined;
    const activeRaw = url.searchParams.get('active');
    const eventType = url.searchParams.get('event_type') ?? undefined;

    let bodyApplicationId: string | undefined;
    let bodyActive: boolean | undefined;
    let bodyEventType: string | undefined;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.application_id === 'string') bodyApplicationId = b.application_id;
        if (typeof b.active === 'boolean') bodyActive = b.active;
        if (typeof b.event_type === 'string') bodyEventType = b.event_type;
      }
    }

    const filterAppId = bodyApplicationId ?? applicationId;
    const filterActive =
      bodyActive ?? (activeRaw === null ? undefined : activeRaw === 'true');
    const filterEvent = bodyEventType ?? eventType;

    let q = client
      .from('webhook_endpoints')
      .select(
        'id, tenant_id, application_id, name, url, status, events, created_at, updated_at',
      )
      .eq('tenant_id', principal.tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (filterAppId) q = q.eq('application_id', filterAppId);
    if (filterActive === true) q = q.eq('status', 'active');
    if (filterActive === false) q = q.neq('status', 'active');
    if (filterEvent) q = q.contains('events', [filterEvent]);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as EndpointRow[];

    // Latest delivery rollup per endpoint. We pull the most recent delivery
    // per endpoint via a single query then group in-memory; for typical
    // tenants this is well under 100 endpoints.
    let rollups: Record<string, DeliveryRollup | undefined> = {};
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: deliveries } = await client
        .from('webhook_deliveries')
        .select('endpoint_id, status, updated_at')
        .in('endpoint_id', ids)
        .order('updated_at', { ascending: false })
        .limit(rows.length * 5); // small headroom; we keep first match per endpoint

      if (deliveries) {
        for (const d of deliveries as DeliveryRollup[]) {
          if (!rollups[d.endpoint_id]) {
            rollups[d.endpoint_id] = d;
          }
        }
      }
    }

    const items = rows.map((r) => {
      const rollup = rollups[r.id];
      return {
        id: r.id,
        tenant_id: r.tenant_id,
        application_id: r.application_id,
        name: r.name,
        url: r.url,
        status: r.status,
        event_types: r.events ?? [],
        created_at: r.created_at,
        updated_at: r.updated_at,
        last_delivery_status: rollup?.status ?? null,
        last_delivery_at: rollup?.updated_at ?? null,
      };
    });

    log.info('webhooks_listed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      count: items.length,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse({ items }, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
