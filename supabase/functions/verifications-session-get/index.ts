// GET /v1/verifications/session/:id — read-only session view.
// Returns the public-facing summary (no PII, no proofs, no tokens).

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
  // Path: /functions/v1/verifications-session-get/<id>
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
      .select('id, status, method, expires_at, completed_at, policy_id')
      .eq('id', sessionId)
      .eq('tenant_id', principal.tenantId)
      .maybeSingle();

    if (sessionErr) throw sessionErr;
    if (!session) throw new NotFoundError('Session not found');

    const { data: policy, error: policyErr } = await client
      .from('policies')
      .select('id, slug, age_threshold')
      .eq('id', session.policy_id)
      .single();
    if (policyErr) throw policyErr;

    const { data: result } = await client
      .from('verification_results')
      .select('decision, reason_code')
      .eq('session_id', session.id)
      .maybeSingle();

    const response = {
      session_id: session.id,
      status: session.status,
      method: session.method,
      expires_at: session.expires_at,
      completed_at: session.completed_at,
      decision: result?.decision ?? null,
      reason_code: result?.reason_code ?? null,
      policy: {
        id: policy.id,
        slug: policy.slug,
        age_threshold: policy.age_threshold,
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
