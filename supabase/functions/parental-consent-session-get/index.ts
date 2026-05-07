// GET /v1/parental-consent/session/:session_id — read minimised status.
//
// Auth: X-AgeKey-API-Key. Returns the public-safe status for a consent
// request, plus (when applicable) the parental_consent and consent_token
// references. Never echoes contact, never returns the OTP digest.
//
// Reference: docs/modules/parental-consent/api.md §GET /session/:id

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ConsentSessionStatusResponseSchema,
  CONSENT_FEATURE_FLAGS,
  assertPublicPayloadHasNoPii,
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

const FN = 'parental-consent-session-get';

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

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const trace_id = newTraceId();
  const fnCtx = { fn: FN, trace_id, origin: req.headers.get('origin') };
  if (req.method !== 'GET') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }
  if (!moduleEnabled()) {
    return respondError(
      fnCtx,
      new ForbiddenError('Parental consent module is disabled'),
    );
  }

  const url = new URL(req.url);
  const sessionId = url.pathname.split('/').filter(Boolean).pop();
  if (!sessionId || !/^[0-9a-f-]{36}$/.test(sessionId)) {
    return respondError(
      fnCtx,
      new InvalidRequestError('Invalid session_id in path'),
    );
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    const reqRow = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, application_id, resource, status, decision, reason_code, expires_at, requested_at',
      )
      .eq('id', sessionId)
      .maybeSingle();
    if (reqRow.error) throw reqRow.error;
    if (!reqRow.data) throw new NotFoundError('Consent request not found');
    if (reqRow.data.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Consent request belongs to another tenant');
    }

    let parentalConsentId: string | null = null;
    let parentalConsentStatus: string | null = null;
    let consentTokenId: string | null = null;
    {
      const pcRow = await client
        .from('parental_consents')
        .select('id, status')
        .eq('consent_request_id', reqRow.data.id)
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pcRow.error) throw pcRow.error;
      if (pcRow.data) {
        parentalConsentId = pcRow.data.id;
        parentalConsentStatus = pcRow.data.status;
        const tokRow = await client
          .from('parental_consent_tokens')
          .select('jti')
          .eq('parental_consent_id', pcRow.data.id)
          .order('issued_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tokRow.error) throw tokRow.error;
        consentTokenId = tokRow.data?.jti ?? null;
      }
    }

    const responseBody = {
      consent_request_id: reqRow.data.id,
      application_id: reqRow.data.application_id,
      resource: reqRow.data.resource,
      decision: reqRow.data.decision,
      status: reqRow.data.status,
      reason_code: reqRow.data.reason_code,
      parental_consent_id: parentalConsentId,
      parental_consent_status: parentalConsentStatus,
      consent_token_id: consentTokenId,
      expires_at: reqRow.data.expires_at
        ? new Date(reqRow.data.expires_at).toISOString()
        : null,
      requested_at: new Date(reqRow.data.requested_at).toISOString(),
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);
    const validated = ConsentSessionStatusResponseSchema.parse(responseBody);

    log.info('parental_consent_status_read', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      consent_request_id: reqRow.data.id,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
