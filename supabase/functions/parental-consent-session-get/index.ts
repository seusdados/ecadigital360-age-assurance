// GET /v1/parental-consent/session/:consent_request_id
//
// Auth: dois modos — X-AgeKey-API-Key (integrador) ou
// guardian_panel_token via query string (responsável anônimo).
// Resposta: visão pública sem PII.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  InternalError,
  ForbiddenError,
  NotFoundError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import {
  hashPanelToken,
  constantTimeEqualString,
} from '../_shared/parental-consent/panel-token.ts';
import { readParentalConsentFlags } from '../_shared/parental-consent/feature-flags.ts';
import {
  type ParentalConsentSessionGetResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'parental-consent-session-get';

function extractRequestId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i] ?? '';
    if (/^[0-9a-f-]{36}$/i.test(seg)) return seg;
  }
  return null;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const trace_id = newTraceId();
  const origin = req.headers.get('origin');
  const fnCtx = { fn: FN, trace_id, origin };

  if (req.method !== 'GET') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const flags = readParentalConsentFlags();
    if (!flags.enabled) {
      throw new ForbiddenError('AgeKey Consent module is disabled.');
    }

    const url = new URL(req.url);
    const requestId = extractRequestId(url);
    if (!requestId) throw new InvalidRequestError('Invalid consent_request_id');

    const client = db();
    const apiKey = req.headers.get('x-agekey-api-key');
    const panelToken = url.searchParams.get('token');

    let tenantIdForRls: string | null = null;
    if (apiKey) {
      const principal = await authenticateApiKey(client, req);
      tenantIdForRls = principal.tenantId;
      await setTenantContext(client, principal.tenantId);
    } else if (!panelToken) {
      throw new ForbiddenError(
        'Either X-AgeKey-API-Key or ?token=<guardian_panel_token> is required',
      );
    }

    // Carrega request.
    const { data: reqRow, error: reqErr } = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, application_id, status, resource, purpose_codes, data_categories, policy_id, policy_version_id, consent_text_version_id, expires_at, decided_at, reason_code, guardian_panel_token_hash',
      )
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr || !reqRow) throw new NotFoundError('consent_request not found');

    if (panelToken) {
      const expectedHash = await hashPanelToken(panelToken);
      if (
        !constantTimeEqualString(
          expectedHash,
          reqRow.guardian_panel_token_hash as string,
        )
      ) {
        throw new ForbiddenError('Invalid guardian_panel_token');
      }
    } else if (tenantIdForRls && reqRow.tenant_id !== tenantIdForRls) {
      throw new ForbiddenError('cross-tenant access denied');
    }

    // Resolve policy / consent_text_version.
    const { data: policyRow } = await client
      .from('policies')
      .select('id, slug, age_threshold, current_version')
      .eq('id', reqRow.policy_id)
      .single();
    const { data: ctvRow } = await client
      .from('consent_text_versions')
      .select('id, locale, text_hash')
      .eq('id', reqRow.consent_text_version_id)
      .single();

    if (!policyRow || !ctvRow) {
      throw new InternalError('Failed to load policy/consent_text_version');
    }

    const response: ParentalConsentSessionGetResponse = {
      consent_request_id: reqRow.id as string,
      status:
        reqRow.status as ParentalConsentSessionGetResponse['status'],
      resource: reqRow.resource as string,
      purpose_codes: (reqRow.purpose_codes as string[]) ?? [],
      data_categories: (reqRow.data_categories as string[]) ?? [],
      policy: {
        id: policyRow.id as string,
        slug: policyRow.slug as string,
        version: policyRow.current_version as number,
        age_threshold: policyRow.age_threshold as number,
      },
      consent_text: {
        id: ctvRow.id as string,
        locale: ctvRow.locale as string,
        text_hash: ctvRow.text_hash as string,
      },
      expires_at: reqRow.expires_at as string,
      decided_at: (reqRow.decided_at as string | null) ?? null,
      reason_code: (reqRow.reason_code as string | null) ?? null,
    };

    assertPayloadSafe(response, 'public_api_response');

    log.info('parental_consent_session_fetched', {
      fn: FN,
      trace_id,
      tenant_id: reqRow.tenant_id,
      consent_request_id: reqRow.id,
      mode: apiKey ? 'api_key' : 'panel_token',
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
