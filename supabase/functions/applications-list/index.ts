// GET /v1/applications-list — list applications for the tenant.
// api_key_hash and webhook_secret_hash are NEVER returned; only the prefix
// (api_key_prefix) for visual identification.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'applications-list';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

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
      'applications-list',
      principal.tenantId,
    );

    const { data, error } = await client
      .from('applications')
      .select(
        'id, slug, name, description, status, api_key_prefix, callback_url, webhook_url, allowed_origins, metadata_json, created_at, updated_at',
      )
      .eq('tenant_id', principal.tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    log.info('applications_listed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      count: data?.length ?? 0,
    });

    return jsonResponse({ items: data ?? [] }, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
