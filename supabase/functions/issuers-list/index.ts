// GET /v1/issuers — list global issuers + tenant overrides.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'issuers-list';

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
    await checkRateLimit(client, principal.apiKeyHash, 'issuers-list', principal.tenantId);

    const { data, error } = await client
      .from('issuers')
      .select('id, issuer_did, name, trust_status, supports_formats, jwks_uri, tenant_id')
      .or(`tenant_id.is.null,tenant_id.eq.${principal.tenantId}`)
      .is('deleted_at', null);
    if (error) throw error;

    const items = (data ?? []).map((r) => ({
      id: r.id,
      issuer_did: r.issuer_did,
      name: r.name,
      trust_status: r.trust_status,
      supports_formats: r.supports_formats ?? [],
      jwks_uri: r.jwks_uri,
      scope: r.tenant_id === null ? 'global' : 'tenant',
    }));

    log.info('issuers_listed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      count: items.length,
    });

    return jsonResponse({ items }, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
