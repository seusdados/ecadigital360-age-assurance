// POST /v1/verifications/token/revoke — explicitly revoke a result_token.
// Writes revoked_at + reason and appends a row in revocations (append-only).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { TokenRevokeRequestSchema } from '../../../packages/shared/src/schemas/tokens.ts';

const FN = 'verifications-token-revoke';

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
    await checkRateLimit(client, principal.apiKeyHash, 'token-revoke', principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = TokenRevokeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid request body', parsed.error.flatten());
    }
    const { jti, reason } = parsed.data;

    const { data: tokenRow, error: fetchErr } = await client
      .from('result_tokens')
      .select('jti, tenant_id, revoked_at')
      .eq('jti', jti)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!tokenRow) throw new NotFoundError('Token not found');
    if (tokenRow.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Token belongs to another tenant');
    }
    if (tokenRow.revoked_at) {
      // Idempotent: already revoked
      return jsonResponse({ jti, status: 'already_revoked' }, { origin });
    }

    const now = new Date().toISOString();

    const upd = await client
      .from('result_tokens')
      .update({ revoked_at: now, revoked_reason: reason })
      .eq('jti', jti);
    if (upd.error) throw upd.error;

    const ins = await client.from('revocations').insert({
      tenant_id: principal.tenantId,
      jti,
      reason,
    });
    if (ins.error) throw ins.error;

    log.info('token_revoked', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      jti,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse({ jti, status: 'revoked', revoked_at: now }, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
