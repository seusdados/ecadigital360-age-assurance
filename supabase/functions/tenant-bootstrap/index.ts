// POST /v1/tenant-bootstrap — onboarding endpoint for new users.
//
// Auth: Authorization: Bearer <Supabase Auth JWT>. NOT X-AgeKey-API-Key,
// because at this point the user has no tenant yet.
//
// Atomically creates: tenants → tenant_users(role=owner) → applications.
// Returns raw api_key + raw webhook_secret (one-time exposure).
//
// The transaction is implemented via the `tenant_bootstrap` RPC (migration
// 013_tenant_bootstrap.sql) so failure rolls back all three rows together.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateUser } from '../_shared/auth-jwt.ts';
import { db, sha256Hex } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  ForbiddenError,
  InvalidRequestError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { newApiKey, newWebhookSecret } from '../_shared/credentials.ts';
import { TenantBootstrapRequestSchema } from '../../../packages/shared/src/schemas/admin.ts';
import { config } from '../_shared/env.ts';

const FN = 'tenant-bootstrap';

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
    const user = await authenticateUser(req);

    const parsed = TenantBootstrapRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    const client = db();

    // Refuse if user is already a member of any tenant — they should switch
    // via the tenant switcher instead of bootstrapping a new one. (Multi-tenant
    // membership for the same user is allowed in the schema but not via this
    // endpoint.)
    const { data: existing } = await client
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      throw new ForbiddenError('User already belongs to a tenant');
    }

    const env = config.environment();
    const envLabel: 'live' | 'test' | 'dev' =
      env === 'production' ? 'live' : env === 'development' ? 'dev' : 'test';
    const apiKey = newApiKey(envLabel);
    const webhookSecret = newWebhookSecret();

    const { data, error } = await client.rpc('tenant_bootstrap', {
      p_user_id: user.id,
      p_tenant_name: input.tenant.name,
      p_tenant_slug: input.tenant.slug,
      p_application_name: input.application.name,
      p_application_slug: input.application.slug,
      p_application_description: input.application.description ?? null,
      p_api_key_hash: await sha256Hex(apiKey.raw),
      p_api_key_prefix: apiKey.prefix,
      p_webhook_secret_hash: await sha256Hex(webhookSecret),
    });

    if (error) {
      // Map common conflicts to friendly errors.
      if (/duplicate key value/i.test(error.message)) {
        throw new InvalidRequestError(
          'Slug do tenant ou da aplicação já existe.',
          { hint: error.message },
        );
      }
      throw error;
    }

    interface BootstrapResult {
      tenant_id: string;
      application_id: string;
    }
    const result = data as BootstrapResult;
    if (!result?.tenant_id || !result?.application_id) {
      throw new Error('tenant_bootstrap RPC returned invalid payload');
    }

    log.info('tenant_bootstrapped', {
      fn: FN,
      trace_id,
      tenant_id: result.tenant_id,
      application_id: result.application_id,
      user_id: user.id,
      duration_ms: Date.now() - t0,
    });

    return jsonResponse(
      {
        tenant_id: result.tenant_id,
        tenant_slug: input.tenant.slug,
        application_id: result.application_id,
        application_slug: input.application.slug,
        api_key: apiKey.raw,
        api_key_prefix: apiKey.prefix,
        webhook_secret: webhookSecret,
      },
      { origin, status: 201 },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
