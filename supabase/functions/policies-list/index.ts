// GET /v1/policies — list policies for the current tenant + global templates.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'policies-list';

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
    await checkRateLimit(client, principal.apiKeyHash, 'policies-list', principal.tenantId);

    const url = new URL(req.url);
    const includeTemplates = url.searchParams.get('include_templates') !== 'false';

    let q = client
      .from('policies')
      .select(
        'id, tenant_id, slug, name, description, age_threshold, age_band_min, age_band_max, jurisdiction_code, method_priority_json, required_assurance_level, token_ttl_seconds, legal_reference_url, current_version, is_template, status, created_at, updated_at',
      )
      .is('deleted_at', null)
      .eq('status', 'active');

    if (includeTemplates) {
      q = q.or(`tenant_id.eq.${principal.tenantId},is_template.eq.true`);
    } else {
      q = q.eq('tenant_id', principal.tenantId);
    }

    const { data, error } = await q;
    if (error) throw error;

    log.info('policies_listed', {
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
