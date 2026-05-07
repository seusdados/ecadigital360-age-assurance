// POST /v1/parental-consent/:consent_token_id/revoke — revoke an active consent.
//
// Auth: X-AgeKey-API-Key. Marks the parental_consents row revoked, marks the
// parental_consent_tokens row revoked, inserts a parental_consent_revocations
// audit row. The SQL trigger fires `parental_consent.revoked` webhook.
//
// Reference: docs/modules/parental-consent/api.md §POST /:consent_token_id/revoke

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ConsentRevokeRequestSchema,
  ConsentRevokeResponseSchema,
  CONSENT_FEATURE_FLAGS,
  REASON_CODES,
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

const FN = 'parental-consent-revoke';

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
  const consentTokenId = url.pathname.split('/').filter(Boolean).pop();
  if (!consentTokenId || !/^[0-9a-f-]{36}$/.test(consentTokenId)) {
    return respondError(
      fnCtx,
      new InvalidRequestError('Invalid consent_token_id in path'),
    );
  }

  try {
    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ConsentRevokeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    // Privacy guard on the inbound reason_text — if a tenant smuggles PII
    // into the free-text field we reject the request rather than persist it.
    if (input.reason_text != null) {
      try {
        assertPublicPayloadHasNoPii({ reason_text: input.reason_text });
      } catch {
        throw new InvalidRequestError(
          'reason_text contains forbidden PII keys',
        );
      }
    }

    const tokenRow = await client
      .from('parental_consent_tokens')
      .select('jti, tenant_id, parental_consent_id, status, audience')
      .eq('jti', consentTokenId)
      .maybeSingle();
    if (tokenRow.error) throw tokenRow.error;
    if (!tokenRow.data) throw new NotFoundError('Consent token not found');
    if (tokenRow.data.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Token belongs to another tenant');
    }

    const now = new Date().toISOString();
    if (tokenRow.data.status !== 'revoked') {
      const u1 = await client
        .from('parental_consent_tokens')
        .update({ status: 'revoked', revoked_at: now })
        .eq('jti', tokenRow.data.jti);
      if (u1.error) throw u1.error;
    }

    const u2 = await client
      .from('parental_consents')
      .update({
        status: 'revoked',
        revoked_at: now,
        revocation_reason: input.reason_code ?? REASON_CODES.CONSENT_REVOKED,
      })
      .eq('id', tokenRow.data.parental_consent_id)
      .neq('status', 'revoked');
    if (u2.error) throw u2.error;

    const ins = await client.from('parental_consent_revocations').insert({
      tenant_id: principal.tenantId,
      parental_consent_id: tokenRow.data.parental_consent_id,
      consent_token_id: tokenRow.data.jti,
      actor_type: input.actor_type,
      reason_code: input.reason_code ?? REASON_CODES.CONSENT_REVOKED,
      reason_text: input.reason_text ?? null,
      effective_at: now,
    });
    if (ins.error) throw ins.error;

    const responseBody = {
      parental_consent_id: tokenRow.data.parental_consent_id,
      consent_token_id: tokenRow.data.jti,
      status: 'revoked' as const,
      reason_code: input.reason_code ?? REASON_CODES.CONSENT_REVOKED,
      revoked_at: now,
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);
    const validated = ConsentRevokeResponseSchema.parse(responseBody);

    log.info('parental_consent_revoked', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      consent_token_id: tokenRow.data.jti,
      reason_code: validated.reason_code,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
