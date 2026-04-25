// POST /v1/issuers — register a tenant-scoped issuer (or update if existing).
// Global issuers (tenant_id IS NULL) cannot be created via this endpoint
// — they are managed only by the AgeKey ops team via direct SQL.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'issuers-register';

const Body = z
  .object({
    issuer_did: z.string().min(8).max(512),
    name: z.string().min(1).max(255),
    supports_formats: z.array(z.string()).default([]),
    jwks_uri: z.string().url().optional(),
    public_keys_json: z.record(z.unknown()).default({}),
    metadata_json: z.record(z.unknown()).default({}),
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
    await checkRateLimit(client, principal.apiKeyHash, 'issuers-register', principal.tenantId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    // Conflict resolution: if an issuer with this DID exists globally, refuse.
    // If it exists under another tenant, refuse.  Otherwise upsert into our tenant.
    const { data: existing } = await client
      .from('issuers')
      .select('id, tenant_id')
      .eq('issuer_did', input.issuer_did)
      .maybeSingle();

    if (existing && existing.tenant_id !== principal.tenantId) {
      throw new InvalidRequestError('issuer_did already registered globally or by another tenant');
    }

    const row = {
      tenant_id: principal.tenantId,
      issuer_did: input.issuer_did,
      name: input.name,
      supports_formats: input.supports_formats,
      public_keys_json: input.public_keys_json,
      metadata_json: input.metadata_json,
      jwks_uri: input.jwks_uri ?? null,
    };

    let issuerId: string;
    if (existing) {
      const upd = await client
        .from('issuers')
        .update(row)
        .eq('id', existing.id)
        .select('id')
        .single();
      if (upd.error || !upd.data) throw upd.error ?? new Error('update failed');
      issuerId = upd.data.id;
    } else {
      const ins = await client.from('issuers').insert(row).select('id').single();
      if (ins.error || !ins.data) throw ins.error ?? new Error('insert failed');
      issuerId = ins.data.id;
    }

    log.info('issuer_registered', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      issuer_id: issuerId,
    });

    return jsonResponse({ id: issuerId, status: existing ? 'updated' : 'created' }, { origin, status: existing ? 200 : 201 });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
