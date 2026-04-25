// GET /v1/verifications-list — paginated session listing for the panel.
//
// Auth: X-AgeKey-API-Key. RLS via service_role + tenant_id filter.
// Cursor pagination via session id (UUID v7 = time-ordered).
//
// Filters: status, decision, method, application_id, policy_id, from, to.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { VerificationsListQuerySchema } from '../../../packages/shared/src/schemas/admin.ts';

const FN = 'verifications-list';

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
      'verifications-list',
      principal.tenantId,
    );

    const url = new URL(req.url);
    const queryObj: Record<string, string> = {};
    for (const [k, v] of url.searchParams.entries()) queryObj[k] = v;

    const parsed = VerificationsListQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid query', parsed.error.flatten());
    }
    const q = parsed.data;

    let query = client
      .from('verification_sessions')
      .select(
        `id, status, method, created_at, completed_at, application_id, policy_id, policy_version_id,
         applications!inner ( id, slug ),
         policies!inner ( id, slug, age_threshold, current_version ),
         verification_results ( decision, reason_code, assurance_level, signed_token_jti )`,
      )
      .eq('tenant_id', principal.tenantId)
      .order('id', { ascending: false })
      .limit(q.limit + 1); // +1 to detect has_more

    if (q.status) query = query.eq('status', q.status);
    if (q.method) query = query.eq('method', q.method);
    if (q.application_id) query = query.eq('application_id', q.application_id);
    if (q.policy_id) query = query.eq('policy_id', q.policy_id);
    if (q.from) query = query.gte('created_at', q.from);
    if (q.to) query = query.lte('created_at', q.to);
    if (q.cursor) query = query.lt('id', q.cursor); // cursor is the last seen id

    const { data, error } = await query;
    if (error) throw error;

    interface JoinedRow {
      id: string;
      status: string;
      method: string | null;
      created_at: string;
      completed_at: string | null;
      applications: { id: string; slug: string } | null;
      policies: {
        id: string;
        slug: string;
        age_threshold: number;
        current_version: number;
      } | null;
      verification_results:
        | Array<{
            decision: string;
            reason_code: string;
            assurance_level: string;
            signed_token_jti: string | null;
          }>
        | null;
    }

    const rows = (data ?? []) as unknown as JoinedRow[];

    let items = rows;
    let hasMore = false;
    if (items.length > q.limit) {
      hasMore = true;
      items = items.slice(0, q.limit);
    }

    // Filter by decision in-memory because PostgREST `.eq` on a 1:1 join
    // cousin (`verification_results`) is awkward; the cardinality is small
    // and the index `idx_vresults_session` keeps the round-trip cheap.
    if (q.decision) {
      items = items.filter(
        (r) => r.verification_results?.[0]?.decision === q.decision,
      );
    }

    const responseItems = items.map((r) => ({
      session_id: r.id,
      status: r.status,
      method: r.method,
      policy: r.policies
        ? {
            id: r.policies.id,
            slug: r.policies.slug,
            age_threshold: r.policies.age_threshold,
            version: r.policies.current_version,
          }
        : null,
      application: r.applications
        ? { id: r.applications.id, slug: r.applications.slug }
        : null,
      decision: r.verification_results?.[0]?.decision ?? null,
      reason_code: r.verification_results?.[0]?.reason_code ?? null,
      assurance_level: r.verification_results?.[0]?.assurance_level ?? null,
      jti: r.verification_results?.[0]?.signed_token_jti ?? null,
      created_at: r.created_at,
      completed_at: r.completed_at,
    }));

    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    log.info('verifications_listed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      count: responseItems.length,
      has_more: hasMore,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      { items: responseItems, next_cursor: nextCursor, has_more: hasMore },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
