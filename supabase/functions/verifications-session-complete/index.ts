// POST /v1/verifications/session/:id/complete
//
// Dispatches to the chosen adapter, persists the verification_result,
// records billing, and (when approved) signs and stores the result_token.
//
// Single source of truth: every public exit (response body, JWT claims,
// webhook trigger inputs, audit diff, structured logs) is derived from a
// canonical Decision Envelope built by `_shared/decision-envelope.ts`.
// Reference: docs/audit/agekey-core-runtime-decision-envelope-report.md.

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
import { resolvePolicy } from '../_shared/policy-engine.ts';
import { recordBillingEvent } from '../_shared/billing.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { loadActiveSigningKey } from '../_shared/keys.ts';
import { signResultToken } from '../_shared/tokens.ts';
import { getAdapter, AdapterDenied } from '../_shared/adapters/index.ts';
import { config } from '../_shared/env.ts';
import { SessionCompleteRequestSchema } from '../../../packages/shared/src/schemas/sessions.ts';
import { assertPublicPayloadHasNoPii } from '../../../packages/shared/src/privacy-guard.ts';
import {
  buildVerificationDecisionEnvelope,
  computeEnvelopePayloadHash,
  envelopeAuditDiff,
  envelopeLogFields,
  envelopeToCompleteResponse,
  envelopeToSignableClaims,
} from '../_shared/decision-envelope.ts';

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

    // Build the canonical Decision Envelope. The envelope re-evaluates the
    // policy → assurance ladder, so its `decision`/`reason_code`/
    // `threshold_satisfied` are authoritative — the runtime no longer keeps
    // a parallel local copy. The envelope also runs the privacy guard, so any
    // adapter that smuggled a PII-shaped key into `evidence` is rejected
    // here, before signing or persisting.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const envelope = buildVerificationDecisionEnvelope({
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      sessionId: session.id,
      policy,
      adapterResult,
      externalUserRef: session.external_user_ref,
      nowSeconds,
    });
    const finalDecision = envelope.decision;

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

    // result_tokens row (jti) — created upfront so we have the FK target.
    // When the decision is approved, we project the envelope into JWT claims
    // via `envelopeToSignableClaims` (which runs the privacy guard one extra
    // time at the signing boundary).
    let signedToken: { jwt: string; jti: string; expires_at: string; kid: string } | null =
      null;
    let signedTokenJti: string | null = null;
    if (finalDecision === 'approved') {
      const signingKey = await loadActiveSigningKey(client);
      const expIso = new Date(envelope.expires_at * 1000).toISOString();

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

      const claims = envelopeToSignableClaims(envelope, {
        iss: config.issuer(),
        aud: principal.applicationSlug,
        jti: tokenRow.jti,
      });

      const jwt = await signResultToken(claims, signingKey);
      signedToken = { jwt, jti: tokenRow.jti, expires_at: expIso, kid: signingKey.kid };
    }

    // Compute a stable hash of the canonical envelope. The hash is opaque,
    // PII-free and small enough to ship to audit + (later) webhook headers.
    const payloadHash = await computeEnvelopePayloadHash(envelope);

    // Insert verification_results (append-only, unique per session). The
    // decision/threshold/assurance/reason fields all come from the envelope
    // — guaranteeing the SQL trigger that fans webhooks out reads canonical
    // values. `evidence_json` is augmented with `_envelope` metadata so the
    // hash is recoverable post-hoc without touching audit storage.
    await client.from('verification_results').insert({
      session_id: session.id,
      tenant_id: principal.tenantId,
      decision: envelope.decision,
      threshold_satisfied: envelope.threshold_satisfied,
      assurance_level: envelope.assurance_level,
      method: envelope.method,
      issuer_id: issuerRowId,
      signed_token_jti: signedTokenJti,
      reason_code: envelope.reason_code,
      evidence_json: {
        ...adapterResult.evidence,
        _envelope: {
          version: envelope.envelope_version,
          payload_hash: payloadHash,
          policy_version: envelope.policy.version,
        },
      },
    });

    // Move session to completed
    await client
      .from('verification_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', session.id);

    // Audit event — built by whitelisting envelope fields (no PII, no
    // free-form payload). The DB triggers in 009_triggers.sql still fire on
    // `verification_results`; this row records the canonical decision-domain
    // metadata that the trigger does not see.
    await writeAuditEvent(client, {
      tenantId: principal.tenantId,
      actorType: 'api_key',
      action: 'verification.completed',
      resourceType: 'verification_session',
      resourceId: session.id,
      diff: envelopeAuditDiff(envelope, payloadHash, signedTokenJti),
      clientIp: session.client_ip,
      userAgent: session.user_agent,
    });

    // Billing
    await recordBillingEvent(client, {
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      sessionId: session.id,
      method: envelope.method,
      decision: envelope.decision,
    });

    log.info('session_completed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      ...envelopeLogFields(envelope, payloadHash),
      result_token_id: signedTokenJti,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    const responseBody = envelopeToCompleteResponse(envelope, signedToken);
    // Defense in depth: even though the envelope already passed the privacy
    // guard, run the guard one more time on the exit shape. Catches any
    // accidental future addition to `envelopeToCompleteResponse` that could
    // smuggle PII into the public response.
    assertPublicPayloadHasNoPii(responseBody);
    return jsonResponse(responseBody, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
