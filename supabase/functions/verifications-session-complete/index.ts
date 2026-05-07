// POST /v1/verifications/session/:id/complete
//
// Dispatches to the chosen adapter, persists the verification_result,
// records billing, and (when approved) signs and stores the result_token.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import { jsonResponse, respondError } from '../_shared/errors.ts';
import {
  InvalidRequestError,
  InternalError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  assertSessionWritable,
  loadAndConsumeChallenge,
  loadSession,
} from '../_shared/sessions.ts';
import { resolvePolicy, meetsAssurance } from '../_shared/policy-engine.ts';
import { recordBillingEvent } from '../_shared/billing.ts';
import { loadActiveSigningKey } from '../_shared/keys.ts';
import { signResultToken } from '../_shared/tokens.ts';
import { getAdapter, AdapterDenied } from '../_shared/adapters/index.ts';
import { config } from '../_shared/env.ts';
import { SessionCompleteRequestSchema } from '../../../packages/shared/src/schemas/sessions.ts';
import { REASON_CODES } from '../../../packages/shared/src/reason-codes.ts';
import {
  assertPayloadSafe,
  PrivacyGuardForbiddenClaimError,
} from '../../../packages/shared/src/privacy/index.ts';

const FN = 'verifications-session-complete';

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

  if (req.method !== 'POST') {
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
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(client, principal.apiKeyHash, 'session-complete', principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = SessionCompleteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid request body', parsed.error.flatten());
    }
    const input = parsed.data;

    const session = await loadSession(client, sessionId, principal.tenantId);
    if (session.application_id !== principal.applicationId) {
      throw new InvalidRequestError('Session does not belong to this application');
    }
    assertSessionWritable(session);

    const challenge = await loadAndConsumeChallenge(client, session.id);

    // Reload current policy snapshot (the version at session creation is preserved
    // via session.policy_version_id, but the engine evaluates by id+slug for now).
    const { snapshot: policy } = await resolvePolicy(
      client,
      principal.tenantId,
      (
        await client.from('policies').select('slug').eq('id', session.policy_id).single()
      ).data!.slug,
    );

    // Mark session as in_progress + record method
    await client
      .from('verification_sessions')
      .update({ status: 'in_progress', method: input.method })
      .eq('id', session.id);

    const ctx = {
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      sessionId: session.id,
      policy,
      nonce: challenge.nonce,
      nonceExpiresAt: challenge.expires_at,
      capabilities: session.client_capabilities_json,
      clientIp: session.client_ip,
      userAgent: session.user_agent,
      locale: session.locale,
    };

    const adapter = getAdapter(input.method);

    let adapterResult;
    try {
      adapterResult = await adapter.completeSession(ctx, input);
    } catch (err) {
      if (err instanceof AdapterDenied) {
        adapterResult = {
          decision: 'denied' as const,
          threshold_satisfied: false,
          assurance_level: 'low' as const,
          method: input.method,
          reason_code: err.reason_code,
          evidence: { proof_kind: 'adapter_error', extra: { message: err.message } },
        };
      } else {
        throw err;
      }
    }

    // Enforce policy assurance
    let finalDecision = adapterResult.decision;
    let finalReason = adapterResult.reason_code;
    if (
      adapterResult.decision === 'approved' &&
      !meetsAssurance(adapterResult.assurance_level, policy.required_assurance_level)
    ) {
      finalDecision = 'denied';
      finalReason = REASON_CODES.POLICY_ASSURANCE_UNMET;
    }

    // Persist artifact when present
    let issuerRowId: string | null = null;
    if (adapterResult.issuer_did) {
      const { data: issuerRow } = await client
        .from('issuers')
        .select('id')
        .eq('issuer_did', adapterResult.issuer_did)
        .maybeSingle();
      issuerRowId = issuerRow?.id ?? null;
    }

    if (adapterResult.artifact) {
      await client.from('proof_artifacts').insert({
        session_id: session.id,
        tenant_id: principal.tenantId,
        adapter_method: adapterResult.method,
        artifact_hash: adapterResult.artifact.hash_hex,
        storage_path: adapterResult.artifact.storage_path ?? null,
        mime_type: adapterResult.artifact.mime_type ?? null,
        size_bytes: adapterResult.artifact.size_bytes ?? null,
        issuer_id: issuerRowId,
      });
    }

    // result_tokens row (jti) — created upfront so we have the FK target
    let signedToken: { jwt: string; jti: string; expires_at: string; kid: string } | null =
      null;
    let signedTokenJti: string | null = null;
    if (finalDecision === 'approved') {
      const signingKey = await loadActiveSigningKey(client);
      const now = Math.floor(Date.now() / 1000);
      const exp = now + policy.token_ttl_seconds;
      const expIso = new Date(exp * 1000).toISOString();

      const { data: tokenRow, error: tokenErr } = await client
        .from('result_tokens')
        .insert({
          session_id: session.id,
          tenant_id: principal.tenantId,
          application_id: principal.applicationId,
          kid: signingKey.kid,
          expires_at: expIso,
        })
        .select('jti')
        .single();
      if (tokenErr || !tokenRow) {
        throw tokenErr ?? new InternalError('Failed to create result_token');
      }
      signedTokenJti = tokenRow.jti;

      const claims = {
        iss: config.issuer(),
        aud: principal.applicationSlug,
        ...(session.external_user_ref ? { sub: session.external_user_ref } : {}),
        jti: tokenRow.jti,
        iat: now,
        nbf: now,
        exp,
        agekey: {
          decision: finalDecision,
          threshold_satisfied: adapterResult.threshold_satisfied,
          age_threshold: policy.age_threshold,
          method: adapterResult.method,
          assurance_level: adapterResult.assurance_level,
          reason_code: finalReason,
          policy: {
            id: policy.id,
            slug: policy.slug,
            version: policy.current_version,
          },
          tenant_id: principal.tenantId,
          application_id: principal.applicationId,
        },
      };

      // Defesa canônica: rejeita assinatura se as claims contiverem PII
      // ou conteúdo bruto. Em condições normais isso nunca dispara
      // (o token só carrega `agekey.*` controlado), mas garante que um
      // adapter futuro defeituoso não consiga emitir token público com
      // documento, e-mail, idade exata etc.
      try {
        assertPayloadSafe(claims, 'public_token');
      } catch (err) {
        if (err instanceof PrivacyGuardForbiddenClaimError) {
          log.error('privacy_guard_blocked_token', {
            fn: FN,
            trace_id,
            tenant_id: principal.tenantId,
            session_id: session.id,
            violations: err.violations.map((v) => v.path),
            reason_code: err.reasonCode,
          });
          throw new InternalError('Token rejected by privacy guard');
        }
        throw err;
      }

      const jwt = await signResultToken(claims, signingKey);
      signedToken = { jwt, jti: tokenRow.jti, expires_at: expIso, kid: signingKey.kid };
    }

    // Insert verification_results (append-only, unique per session)
    await client.from('verification_results').insert({
      session_id: session.id,
      tenant_id: principal.tenantId,
      decision: finalDecision,
      threshold_satisfied: adapterResult.threshold_satisfied,
      assurance_level: adapterResult.assurance_level,
      method: adapterResult.method,
      issuer_id: issuerRowId,
      signed_token_jti: signedTokenJti,
      reason_code: finalReason,
      evidence_json: adapterResult.evidence,
    });

    // Move session to completed
    await client
      .from('verification_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', session.id);

    // Billing
    await recordBillingEvent(client, {
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      sessionId: session.id,
      method: adapterResult.method,
      decision: finalDecision,
    });

    log.info('session_completed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      session_id: session.id,
      method: adapterResult.method,
      decision: finalDecision,
      reason_code: finalReason,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(
      {
        session_id: session.id,
        status: 'completed',
        decision: finalDecision,
        reason_code: finalReason,
        method: adapterResult.method,
        assurance_level: adapterResult.assurance_level,
        token: signedToken,
      },
      { origin },
    );
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
