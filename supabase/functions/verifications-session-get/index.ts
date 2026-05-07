// GET /v1/verifications/session/:id — read-only detail view.
// Returns the panel-facing detail (no PII, no proofs).
//
// Shape expanded in Slice 2 (PR #15) to include application info, policy
// version/jurisdiction/name, assurance_level, jti and token revocation
// state. The minimal shape used by widgets/SDK is still available via
// `verifications-session-create` response — this endpoint is for the panel.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { InvalidRequestError, NotFoundError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

const FN = 'verifications-session-get';

function extractSessionId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

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
    const url = new URL(req.url);
    const sessionId = extractSessionId(url);
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new InvalidRequestError('Invalid session id');
    }

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await checkRateLimit(client, principal.apiKeyHash, 'session-get', principal.tenantId);

    const { data: session, error: sessionErr } = await client
      .from('verification_sessions')
      .select('id, status, method, created_at, expires_at, completed_at, policy_id, application_id')
      .eq('id', sessionId)
      .eq('tenant_id', principal.tenantId)
      .maybeSingle();

    if (sessionErr) throw sessionErr;
    if (!session) throw new NotFoundError('Session not found');

    const { data: policy, error: policyErr } = await client
      .from('policies')
      .select('id, slug, name, age_threshold, jurisdiction_code, current_version')
      .eq('id', session.policy_id)
      .single();
    if (policyErr) throw policyErr;

    const { data: application, error: appErr } = await client
      .from('applications')
      .select('id, slug, name')
      .eq('id', session.application_id)
      .single();
    if (appErr) throw appErr;

    const { data: result } = await client
      .from('verification_results')
      .select('decision, reason_code, assurance_level, signed_token_jti')
      .eq('session_id', session.id)
      .maybeSingle();

    let tokenRevoked = false;
    let tokenExpiresAt: string | null = null;
    if (result?.signed_token_jti) {
      const { data: token } = await client
        .from('result_tokens')
        .select('revoked_at, expires_at')
        .eq('jti', result.signed_token_jti)
        .maybeSingle();
      tokenRevoked = Boolean(token?.revoked_at);
      tokenExpiresAt = token?.expires_at ?? null;
    }

    const response = {
      session_id: session.id,
      status: session.status,
      method: session.method,
      created_at: session.created_at,
      expires_at: session.expires_at,
      completed_at: session.completed_at,
      decision: result?.decision ?? null,
      reason_code: result?.reason_code ?? null,
      assurance_level: result?.assurance_level ?? null,
      jti: result?.signed_token_jti ?? null,
      token_revoked: tokenRevoked,
      token_expires_at: tokenExpiresAt,
      policy: {
        id: policy.id,
        slug: policy.slug,
        name: policy.name,
        age_threshold: policy.age_threshold,
        jurisdiction_code: policy.jurisdiction_code,
        version: policy.current_version,
      },
      application: {
        id: application.id,
        slug: application.slug,
        name: application.name,
      },
    };

    log.info('session_read', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      session_id: session.id,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
