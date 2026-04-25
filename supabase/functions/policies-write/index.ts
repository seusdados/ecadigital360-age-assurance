// POST /v1/policies — create or update a tenant-scoped policy.
// To clone a template, set `cloned_from_id` and the engine resolves the rest.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'policies-write';

const Body = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(64),
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    age_threshold: z.number().int().min(1).max(120),
    age_band_min: z.number().int().positive().nullable().optional(),
    age_band_max: z.number().int().positive().nullable().optional(),
    jurisdiction_code: z.string().nullable().optional(),
    method_priority_json: z
      .array(z.enum(['zkp', 'vc', 'gateway', 'fallback']))
      .min(1)
      .default(['zkp', 'vc', 'gateway', 'fallback']),
    required_assurance_level: z.enum(['low', 'substantial', 'high']).default('substantial'),
    token_ttl_seconds: z.number().int().positive().max(86400 * 30).default(86400),
    cloned_from_id: z.string().uuid().nullable().optional(),
  })
  .strict();

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(client, principal.apiKeyHash, 'policies-write', principal.tenantId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const p = parsed.data;

    const row = {
      tenant_id: principal.tenantId,
      slug: p.slug,
      name: p.name,
      description: p.description ?? null,
      age_threshold: p.age_threshold,
      age_band_min: p.age_band_min ?? null,
      age_band_max: p.age_band_max ?? null,
      jurisdiction_code: p.jurisdiction_code ?? null,
      method_priority_json: p.method_priority_json,
      required_assurance_level: p.required_assurance_level,
      token_ttl_seconds: p.token_ttl_seconds,
      cloned_from_id: p.cloned_from_id ?? null,
      is_template: false,
    };

    if (p.id) {
      const upd = await client
        .from('policies')
        .update(row)
        .eq('id', p.id)
        .eq('tenant_id', principal.tenantId)
        .is('deleted_at', null)
        .select('id, current_version')
        .single();
      if (upd.error || !upd.data) {
        throw upd.error ?? new InvalidRequestError('Policy not found');
      }
      log.info('policy_updated', {
        fn: FN,
        trace_id,
        tenant_id: principal.tenantId,
        policy_id: upd.data.id,
        version: upd.data.current_version,
      });
      return jsonResponse(
        { id: upd.data.id, version: upd.data.current_version, status: 'updated' },
        { origin },
      );
    }

    const ins = await client.from('policies').insert(row).select('id, current_version').single();
    if (ins.error || !ins.data) throw ins.error ?? new Error('insert failed');

    log.info('policy_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      policy_id: ins.data.id,
    });

    return jsonResponse(
      { id: ins.data.id, version: ins.data.current_version, status: 'created' },
      { origin, status: 201 },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
