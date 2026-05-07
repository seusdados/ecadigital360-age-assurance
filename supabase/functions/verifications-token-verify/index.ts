// POST /v1/verifications/token/verify
//
// Validates a result JWT: signature against published JWKS, expiration,
// issuer, optional audience, and the `result_tokens.revoked_at` flag.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { loadJwksPublicKeys } from '../_shared/keys.ts';
import { verifyResultToken } from '../_shared/tokens.ts';
import { config } from '../_shared/env.ts';
import { TokenVerifyRequestSchema } from '../../../packages/shared/src/schemas/tokens.ts';

const FN = 'verifications-token-verify';

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
    await checkRateLimit(client, principal.apiKeyHash, 'token-verify', principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = TokenVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid request body', parsed.error.flatten());
    }
    const { token, expected_audience } = parsed.data;

    const keys = await loadJwksPublicKeys(client);
    const verifyResult = await verifyResultToken(token, {
      jwksKeys: keys,
      expectedIssuer: config.issuer(),
      ...(expected_audience ? { expectedAudience: expected_audience } : {}),
    });

    let revoked = false;
    if (verifyResult.valid && verifyResult.claims) {
      const { data: tokenRow } = await client
        .from('result_tokens')
        .select('jti, revoked_at, tenant_id')
        .eq('jti', verifyResult.claims.jti)
        .maybeSingle();
      if (!tokenRow) {
        // unknown jti — treat as invalid
        log.info('token_verify', {
          fn: FN,
          trace_id,
          tenant_id: principal.tenantId,
          duration_ms: Date.now() - t0,
          status: 200,
          valid: false,
          reason: 'unknown_jti',
        });
        return jsonResponse(
          { valid: false, reason_code: 'INVALID_REQUEST', revoked: false },
          { origin },
        );
      }
      if (tokenRow.tenant_id !== principal.tenantId) {
        // The verifier belongs to another tenant — refuse.
        return jsonResponse(
          { valid: false, reason_code: 'INVALID_REQUEST', revoked: false },
          { origin },
        );
      }
      revoked = tokenRow.revoked_at !== null;
    }

    log.info('token_verify', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      duration_ms: Date.now() - t0,
      status: 200,
      valid: verifyResult.valid && !revoked,
    });

    return jsonResponse(
      {
        valid: verifyResult.valid && !revoked,
        reason_code: verifyResult.valid
          ? revoked
            ? 'INVALID_REQUEST'
            : undefined
          : verifyResult.reason ?? 'INVALID_REQUEST',
        claims: verifyResult.valid ? verifyResult.claims : undefined,
        revoked,
      },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
