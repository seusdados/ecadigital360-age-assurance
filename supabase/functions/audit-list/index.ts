// GET /v1/audit-list — paginated audit_events feed for the panel.
//
// Auth: X-AgeKey-API-Key (caller must have role >= auditor in the tenant —
// enforced by RLS on audit_events).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { AuditListQuerySchema } from '../../../packages/shared/src/schemas/admin.ts';

const FN = 'audit-list';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };
  const t0 = Date.now();

  if (req.method !== 'GET') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'audit-list',
      principal.tenantId,
    );

    const url = new URL(req.url);
    const queryObj: Record<string, string> = {};
    for (const [k, v] of url.searchParams.entries()) queryObj[k] = v;
    const parsed = AuditListQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid query', parsed.error.flatten());
    }
    const q = parsed.data;

    let query = client
      .from('audit_events')
      .select(
        'id, actor_type, actor_id, action, resource_type, resource_id, diff_json, client_ip, created_at',
      )
      .eq('tenant_id', principal.tenantId)
      .order('id', { ascending: false })
      .limit(q.limit + 1);

    if (q.action) query = query.eq('action', q.action);
    if (q.resource_type) query = query.eq('resource_type', q.resource_type);
    if (q.actor_type) query = query.eq('actor_type', q.actor_type);
    if (q.from) query = query.gte('created_at', q.from);
    if (q.to) query = query.lte('created_at', q.to);
    if (q.cursor) query = query.lt('id', q.cursor);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      actor_type: string;
      actor_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      diff_json: Record<string, unknown>;
      client_ip: string | null;
      created_at: string;
    }>;

    let items = rows;
    let hasMore = false;
    if (items.length > q.limit) {
      hasMore = true;
      items = items.slice(0, q.limit);
    }

    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    log.info('audit_listed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
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
