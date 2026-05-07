// POST /v1/parental-consent/:id/confirm — finalise the consent flow.
//
// Validates OTP, computes the canonical envelope, persists parental_consents,
// mints a result_token (consent claim shape), inserts the parental_consent_token
// row and (via the SQL trigger) enqueues the matching webhook.
//
// Reference: docs/modules/parental-consent/api.md §POST /:id/confirm

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ConsentConfirmRequestSchema,
  ConsentConfirmResponseSchema,
  CONSENT_FEATURE_FLAGS,
  REASON_CODES,
  assertPublicPayloadHasNoPii,
  envelopeToConsentTokenClaims,
  readConsentFeatureFlag,
} from '../../../packages/shared/src/index.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  NotFoundError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { loadActiveSigningKey } from '../_shared/keys.ts';
import { signJwsClaims } from '../../../packages/shared/src/jws.ts';
import {
  buildConsentEnvelopeFromRows,
  computeConsentEnvelopePayloadHash,
  consentEnvelopeAuditDiff,
} from '../_shared/consent-envelope.ts';
import { config } from '../_shared/env.ts';

const FN = 'parental-consent-confirm';

function moduleEnabled(): boolean {
  return readConsentFeatureFlag(
    {
      AGEKEY_PARENTAL_CONSENT_ENABLED: Deno.env.get(
        CONSENT_FEATURE_FLAGS.ENABLED,
      ),
    },
    CONSENT_FEATURE_FLAGS.ENABLED,
  );
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  let hex = '';
  for (const b of new Uint8Array(buf)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  const t0 = Date.now();

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }
  if (!moduleEnabled()) {
    return respondError(
      fnCtx,
      new ForbiddenError('Parental consent module is disabled'),
    );
  }

  const url = new URL(req.url);
  const consentRequestId = url.pathname.split('/').filter(Boolean).pop();
  if (!consentRequestId || !/^[0-9a-f-]{36}$/.test(consentRequestId)) {
    return respondError(
      fnCtx,
      new InvalidRequestError('Invalid consent_request_id in path'),
    );
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'parental-consent-confirm',
      principal.tenantId,
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ConsentConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    const reqRow = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, application_id, status, expires_at, resource, scope, purpose_codes, data_categories, risk_tier, subject_ref_hmac, verification_session_id, policy_id, policy_version',
      )
      .eq('id', consentRequestId)
      .maybeSingle();
    if (reqRow.error) throw reqRow.error;
    if (!reqRow.data) throw new NotFoundError('Consent request not found');
    if (reqRow.data.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Consent request belongs to another tenant');
    }
    if (new Date(reqRow.data.expires_at).getTime() < Date.now()) {
      throw new InvalidRequestError('Consent request has expired');
    }

    // Most recent guardian verification for this request.
    const gvRow = await client
      .from('guardian_verifications')
      .select(
        'id, guardian_contact_id, method, assurance_level, otp_digest, otp_attempts, otp_expires_at, decision',
      )
      .eq('consent_request_id', consentRequestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gvRow.error) throw gvRow.error;
    if (!gvRow.data)
      throw new InvalidRequestError(
        'Guardian channel has not been started for this request',
      );

    const gcRow = await client
      .from('guardian_contacts')
      .select('id, guardian_ref_hmac, contact_type')
      .eq('id', gvRow.data.guardian_contact_id)
      .maybeSingle();
    if (gcRow.error) throw gcRow.error;
    if (!gcRow.data)
      throw new InvalidRequestError(
        'Guardian contact for this verification was not found',
      );

    if (
      gvRow.data.otp_expires_at == null ||
      new Date(gvRow.data.otp_expires_at).getTime() < Date.now()
    ) {
      await client
        .from('guardian_verifications')
        .update({
          decision: 'denied',
          reason_code: REASON_CODES.CONSENT_OTP_EXPIRED,
        })
        .eq('id', gvRow.data.id);
      throw new InvalidRequestError('OTP expired');
    }

    const expectedDigest = await sha256Hex(
      `${gcRow.data.guardian_ref_hmac}|${input.otp}`,
    );
    const otpOk =
      typeof gvRow.data.otp_digest === 'string' &&
      expectedDigest === gvRow.data.otp_digest;

    if (!otpOk) {
      await client
        .from('guardian_verifications')
        .update({
          otp_attempts: (gvRow.data.otp_attempts ?? 0) + 1,
          decision: 'denied',
          reason_code: REASON_CODES.CONSENT_OTP_INVALID,
        })
        .eq('id', gvRow.data.id);
      throw new InvalidRequestError('OTP invalid');
    }

    // Resolve the consent text version.
    const ctv = await client
      .from('consent_text_versions')
      .select(
        'id, tenant_id, version, body_hash, status, purpose_codes, data_categories',
      )
      .eq('id', input.consent_text_version_id)
      .maybeSingle();
    if (ctv.error) throw ctv.error;
    if (!ctv.data || ctv.data.tenant_id !== principal.tenantId) {
      throw new InvalidRequestError(
        'Consent text version not found for this tenant',
      );
    }
    if (ctv.data.status !== 'published') {
      throw new InvalidRequestError(
        `Consent text version is ${ctv.data.status}`,
      );
    }

    const consentTextHash = ctv.data.body_hash as string;
    const proofHash = await sha256Hex(
      [
        reqRow.data.subject_ref_hmac,
        gcRow.data.guardian_ref_hmac,
        reqRow.data.resource,
        consentTextHash,
        Math.floor(Date.now() / 1000).toString(),
      ].join('|'),
    );

    const acceptanceComplete =
      input.accepted &&
      input.declaration.guardian_responsibility_confirmed &&
      input.declaration.understands_scope &&
      input.declaration.understands_revocation;

    // Build envelope first to get the deterministic decision.
    const tokenTtl =
      Number(Deno.env.get('AGEKEY_CONSENT_TOKEN_TTL_SECONDS') ?? '604800') ||
      604800; // 7 days default

    const provisionalEnvelope = buildConsentEnvelopeFromRows({
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      consent_request_id: reqRow.data.id,
      parental_consent_id: null,
      consent_token_id: null,
      verification_session_id: reqRow.data.verification_session_id,
      policy:
        reqRow.data.policy_id != null && reqRow.data.policy_version != null
          ? {
              id: reqRow.data.policy_id,
              slug: 'parental-consent',
              version: reqRow.data.policy_version,
            }
          : null,
      resource: reqRow.data.resource,
      scope: reqRow.data.scope,
      purpose_codes: reqRow.data.purpose_codes,
      data_categories: reqRow.data.data_categories,
      risk_tier: reqRow.data.risk_tier,
      subject_ref_hmac: reqRow.data.subject_ref_hmac,
      guardian_ref_hmac: gcRow.data.guardian_ref_hmac,
      guardian_method: gvRow.data.method,
      guardian_assurance: gvRow.data.assurance_level ?? 'low',
      guardian_verified: true,
      consent_text_hash: acceptanceComplete ? consentTextHash : null,
      proof_hash: acceptanceComplete ? proofHash : null,
      acceptance_complete: acceptanceComplete,
      token_ttl_seconds: tokenTtl,
    });

    let parentalConsentId: string | null = null;
    let consentTokenId: string | null = null;
    let signedJwt: string | null = null;
    let kid: string | null = null;

    if (provisionalEnvelope.decision === 'approved') {
      const insertConsent = await client
        .from('parental_consents')
        .insert({
          tenant_id: principal.tenantId,
          consent_request_id: reqRow.data.id,
          verification_session_id: reqRow.data.verification_session_id,
          guardian_verification_id: gvRow.data.id,
          consent_text_version_id: ctv.data.id,
          application_id: principal.applicationId,
          policy_id: reqRow.data.policy_id,
          policy_version: reqRow.data.policy_version,
          subject_ref_hmac: reqRow.data.subject_ref_hmac,
          guardian_ref_hmac: gcRow.data.guardian_ref_hmac,
          resource: reqRow.data.resource,
          scope: reqRow.data.scope,
          purpose_codes: reqRow.data.purpose_codes,
          data_categories: reqRow.data.data_categories,
          risk_tier: reqRow.data.risk_tier,
          method: gvRow.data.method,
          assurance_level: gvRow.data.assurance_level ?? 'low',
          status: 'active',
          consent_text_hash: consentTextHash,
          proof_hash: proofHash,
          issued_at: new Date(provisionalEnvelope.issued_at * 1000).toISOString(),
          expires_at: new Date(
            provisionalEnvelope.expires_at * 1000,
          ).toISOString(),
        })
        .select('id')
        .single();
      if (insertConsent.error) throw insertConsent.error;
      parentalConsentId = insertConsent.data.id;

      // Sign the consent token.
      const signing = await loadActiveSigningKey(client);
      kid = signing.kid;
      const tokenJti = crypto.randomUUID();
      consentTokenId = tokenJti;
      const finalEnvelope = buildConsentEnvelopeFromRows({
        ...provisionalEnvelope,
        // re-cast subset that buildConsentEnvelopeFromRows expects
        tenant_id: provisionalEnvelope.tenant_id,
        application_id: provisionalEnvelope.application_id,
        consent_request_id: provisionalEnvelope.consent_request_id,
        parental_consent_id: parentalConsentId,
        consent_token_id: tokenJti,
        verification_session_id: provisionalEnvelope.verification_session_id,
        policy: provisionalEnvelope.policy,
        resource: provisionalEnvelope.resource,
        scope: provisionalEnvelope.scope,
        purpose_codes: provisionalEnvelope.purpose_codes,
        data_categories: provisionalEnvelope.data_categories,
        risk_tier: provisionalEnvelope.risk_tier,
        subject_ref_hmac: provisionalEnvelope.subject_ref_hmac,
        guardian_ref_hmac: provisionalEnvelope.guardian_ref_hmac,
        guardian_method: provisionalEnvelope.guardian_verification_method,
        guardian_assurance: provisionalEnvelope.assurance_level,
        guardian_verified: true,
        consent_text_hash: consentTextHash,
        proof_hash: proofHash,
        acceptance_complete: true,
        token_ttl_seconds: tokenTtl,
        now_seconds: provisionalEnvelope.issued_at,
      });
      const claims = envelopeToConsentTokenClaims(finalEnvelope, {
        iss: config.issuer(),
        aud: principal.applicationSlug,
        jti: tokenJti,
      });
      signedJwt = await signJwsClaims(
        claims as unknown as Record<string, unknown>,
        signing,
        'agekey-parental-consent+jwt',
      );

      const tokenHash = await sha256Hex(signedJwt);
      const insTok = await client.from('parental_consent_tokens').insert({
        jti: tokenJti,
        tenant_id: principal.tenantId,
        parental_consent_id: parentalConsentId,
        token_type: 'agekey_jws',
        token_hash: tokenHash,
        audience: principal.applicationSlug,
        kid,
        issued_at: new Date(finalEnvelope.issued_at * 1000).toISOString(),
        expires_at: new Date(finalEnvelope.expires_at * 1000).toISOString(),
        status: 'active',
      });
      if (insTok.error) throw insTok.error;

      await client
        .from('guardian_verifications')
        .update({
          decision: 'approved',
          reason_code: REASON_CODES.CONSENT_GRANTED,
          verified_at: new Date().toISOString(),
        })
        .eq('id', gvRow.data.id);

      await client
        .from('parental_consent_requests')
        .update({
          status: 'approved',
          decision: 'approved',
          reason_code: REASON_CODES.CONSENT_GRANTED,
        })
        .eq('id', reqRow.data.id);

      const payloadHash = await computeConsentEnvelopePayloadHash(finalEnvelope);
      const auditDiff = consentEnvelopeAuditDiff(finalEnvelope, payloadHash);
      await client.from('audit_events').insert({
        tenant_id: principal.tenantId,
        actor_type: 'system',
        action: 'parental_consent.completed',
        resource_type: 'parental_consent',
        resource_id: parentalConsentId,
        diff_json: auditDiff,
      });
    } else {
      // Denied / needs_review / blocked_by_policy / pending — transition the
      // request row but do not mint a token.
      const newStatus = (() => {
        switch (provisionalEnvelope.decision) {
          case 'denied':
            return 'denied';
          case 'needs_review':
            return 'under_review';
          case 'blocked_by_policy':
            return 'blocked_by_policy';
          default:
            return 'pending_verification';
        }
      })();
      await client
        .from('parental_consent_requests')
        .update({
          status: newStatus,
          decision: provisionalEnvelope.decision,
          reason_code: provisionalEnvelope.reason_code,
        })
        .eq('id', reqRow.data.id);
    }

    const responseBody = {
      consent_request_id: reqRow.data.id,
      decision: provisionalEnvelope.decision,
      status:
        provisionalEnvelope.decision === 'approved'
          ? ('approved' as const)
          : provisionalEnvelope.decision === 'denied'
            ? ('denied' as const)
            : provisionalEnvelope.decision === 'needs_review'
              ? ('under_review' as const)
              : provisionalEnvelope.decision === 'blocked_by_policy'
                ? ('blocked_by_policy' as const)
                : ('pending_verification' as const),
      reason_code: provisionalEnvelope.reason_code,
      consent_token_id: consentTokenId,
      parental_consent_id: parentalConsentId,
      verification_session_id: reqRow.data.verification_session_id,
      token:
        signedJwt && consentTokenId && kid
          ? {
              jwt: signedJwt,
              jti: consentTokenId,
              issued_at: new Date(
                provisionalEnvelope.issued_at * 1000,
              ).toISOString(),
              expires_at: new Date(
                provisionalEnvelope.expires_at * 1000,
              ).toISOString(),
              kid,
              token_type: 'agekey_jws' as const,
            }
          : null,
      method: gvRow.data.method,
      assurance_level: gvRow.data.assurance_level ?? 'low',
      expires_at: new Date(provisionalEnvelope.expires_at * 1000).toISOString(),
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);
    const validated = ConsentConfirmResponseSchema.parse(responseBody);

    log.info('parental_consent_confirmed', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      consent_request_id: reqRow.data.id,
      decision: provisionalEnvelope.decision,
      reason_code: provisionalEnvelope.reason_code,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
