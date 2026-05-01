// POST /v1/verifications/session — create a verification session.
//
// Auth: X-AgeKey-API-Key. Resolves policy, allocates session + challenge,
// returns the SessionCreateResponse with the available methods and the
// preferred method (first one capability-matched).
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import { ExternalUserRefPiiError, InvalidRequestError } from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { resolvePolicy, selectAvailableMethods } from '../_shared/policy-engine.ts';
import { newNonce } from '../_shared/sessions.ts';
import { SessionCreateRequestSchema } from '../../../packages/shared/src/schemas/sessions.ts';
import {
  detectPiiInRef,
  explainPiiRejection,
} from '../../../packages/shared/src/external-user-ref.ts';

const FN = 'verifications-session-create';

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
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(client, principal.apiKeyHash, 'session-create', principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }

    // Boundary check: reject obvious PII in `external_user_ref` before
    // even parsing the rest of the body, so the rejection carries the
    // dedicated reason_code (EXTERNAL_USER_REF_PII_DETECTED) rather than
    // the generic INVALID_REQUEST. The Zod schema also enforces this
    // (defense in depth) but the Zod path collapses to INVALID_REQUEST.
    if (
      typeof body === 'object' &&
      body !== null &&
      'external_user_ref' in body &&
      (body as { external_user_ref?: unknown }).external_user_ref !== undefined
    ) {
      const detection = detectPiiInRef(
        (body as { external_user_ref?: unknown }).external_user_ref,
      );
      if (!detection.ok) {
        throw new ExternalUserRefPiiError(explainPiiRejection(detection), {
          field: 'external_user_ref',
          detection_code: detection.code,
        });
      }
    }

    const parsed = SessionCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid request body', parsed.error.flatten());
    }
    const input = parsed.data;

    const { snapshot: policy, policy_version_id } = await resolvePolicy(
      client,
      principal.tenantId,
      input.policy_slug,
    );

    const capabilities = input.client_capabilities ?? {};
    const availableMethods = selectAvailableMethods(policy, capabilities);
    const preferredMethod = availableMethods[0] ?? 'fallback';

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = req.headers.get('user-agent');

    const sessionInsert = await client
      .from('verification_sessions')
      .insert({
        tenant_id: principal.tenantId,
        application_id: principal.applicationId,
        policy_id: policy.id,
        policy_version_id,
        external_user_ref: input.external_user_ref ?? null,
        locale: input.locale ?? 'pt-BR',
        client_capabilities_json: capabilities,
        redirect_url: input.redirect_url ?? null,
        cancel_url: input.cancel_url ?? null,
        client_ip: clientIp,
        user_agent: userAgent,
      })
      .select(
        'id, status, expires_at',
      )
      .single();

    if (sessionInsert.error || !sessionInsert.data) {
      throw sessionInsert.error ?? new Error('Failed to create session');
    }
    const session = sessionInsert.data;

    const nonce = newNonce();
    const challengeInsert = await client
      .from('verification_challenges')
      .insert({
        session_id: session.id,
        nonce,
      })
      .select('nonce, expires_at')
      .single();

    if (challengeInsert.error || !challengeInsert.data) {
      throw challengeInsert.error ?? new Error('Failed to create challenge');
    }

    const response = {
      session_id: session.id,
      status: session.status,
      expires_at: session.expires_at,
      challenge: {
        nonce: challengeInsert.data.nonce,
        expires_at: challengeInsert.data.expires_at,
      },
      available_methods: availableMethods,
      preferred_method: preferredMethod,
      policy: {
        id: policy.id,
        slug: policy.slug,
        age_threshold: policy.age_threshold,
        required_assurance_level: policy.required_assurance_level,
      },
    };

    log.info('session_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      session_id: session.id,
      duration_ms: Date.now() - t0,
      status: 201,
      policy_slug: policy.slug,
      preferred_method: preferredMethod,
    });

    return jsonResponse(response, { status: 201, origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
