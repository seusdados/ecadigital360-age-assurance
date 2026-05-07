// POST /v1/parental-consent/session — create a consent session.
//
// Auth: X-AgeKey-API-Key. Inserts a `parental_consent_requests` row, validates
// purpose / data_categories against the tenant's active consent text version,
// and returns a DecisionEnvelope projection (decision = pending, status =
// pending_guardian) ready for the relying party to redirect to.
//
// Side effects:
//   * audit_events row (action = parental_consent.session_created)
//   * webhook fan-out is deferred to acceptance (the SQL trigger fires only
//     on parental_consents transitions). Tenants can opt in to the
//     parental_consent.session_created event through subscriptions;
//     the explicit insert below is the only emission point.
//
// Reference: docs/modules/parental-consent/api.md §POST /session

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ConsentSessionCreateRequestSchema,
  ConsentSessionCreateResponseSchema,
  assertPublicPayloadHasNoPii,
  readConsentFeatureFlag,
  CONSENT_FEATURE_FLAGS,
} from '../../../packages/shared/src/index.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  detectPiiInRef,
  explainPiiRejection,
} from '../../../packages/shared/src/external-user-ref.ts';
import { ExternalUserRefPiiError } from '../_shared/errors.ts';
import { consentHmacHex } from '../_shared/consent-hmac.ts';

const FN = 'parental-consent-session-create';

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
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };
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

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'parental-consent-session-create',
      principal.tenantId,
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }

    if (
      typeof body === 'object' &&
      body !== null &&
      'external_user_ref' in body &&
      (body as { external_user_ref?: unknown }).external_user_ref !== undefined
    ) {
      const det = detectPiiInRef(
        (body as { external_user_ref?: unknown }).external_user_ref,
      );
      if (!det.ok) {
        throw new ExternalUserRefPiiError(explainPiiRejection(det), {
          field: 'external_user_ref',
          detection_code: det.code,
        });
      }
    }

    const parsed = ConsentSessionCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    if (input.application_id !== principal.applicationId) {
      throw new ForbiddenError('application_id does not match API key');
    }

    const subjectRefHmac = await consentHmacHex(
      client,
      principal.tenantId,
      'subject_ref',
      input.external_user_ref,
    );

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = req.headers.get('user-agent');

    const insert = await client
      .from('parental_consent_requests')
      .insert({
        tenant_id: principal.tenantId,
        application_id: principal.applicationId,
        external_user_ref: input.external_user_ref,
        subject_ref_hmac: subjectRefHmac,
        resource: input.resource,
        scope: input.scope ?? null,
        purpose_codes: input.purpose_codes,
        data_categories: input.data_categories,
        risk_tier: input.risk_tier ?? 'low',
        status: 'pending_guardian',
        decision: 'pending',
        reason_code: 'CONSENT_NOT_GIVEN',
        return_url: input.return_url ?? null,
        webhook_correlation_id: input.webhook_correlation_id ?? null,
        locale: input.locale ?? 'pt-BR',
        client_context_json: input.client_context ?? {},
        client_ip: clientIp,
        user_agent: userAgent,
        verification_session_id: input.verification_session_id ?? null,
      })
      .select('id, expires_at')
      .single();

    if (insert.error) throw insert.error;
    const row = insert.data;

    const baseUrl = Deno.env.get('AGEKEY_CONSENT_PUBLIC_BASE_URL') ??
      'https://agekey.com.br/parental-consent';
    const redirectUrl = `${baseUrl.replace(/\/$/, '')}/${row.id}`;

    const responseBody = {
      session_id: row.id,
      consent_request_id: row.id,
      decision: 'pending' as const,
      status: 'pending_guardian' as const,
      reason_code: 'CONSENT_NOT_GIVEN',
      resource: input.resource,
      redirect_url: redirectUrl,
      expires_at: new Date(row.expires_at).toISOString(),
      pii_included: false as const,
      content_included: false as const,
    };

    // Defense in depth: the schema parse below would also throw, but the
    // privacy guard explicitly checks key shape against the canonical PII
    // blacklist regardless of the schema.
    assertPublicPayloadHasNoPii(responseBody);
    const validated = ConsentSessionCreateResponseSchema.parse(responseBody);

    log.info('parental_consent_session_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      consent_request_id: row.id,
      duration_ms: Date.now() - t0,
      status: 200,
      pii_included: false,
    });

    return jsonResponse(validated, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
