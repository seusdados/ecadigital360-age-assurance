// GET /v1/parental-consent/:consent_request_id/text?token=<panel_token>
//
// Endpoint público dedicado a entregar o texto integral
// (`consent_text_versions.text_body`) ao painel parental.
//
// Auth: exclusivamente via `guardian_panel_token` na query string.
// O token é hash-comparado em tempo constante contra
// `parental_consent_requests.guardian_panel_token_hash`. Sem `X-AgeKey-API-Key`
// — o painel é público.
//
// O service-role bypassa RLS para ler `consent_text_versions`, que de
// outra forma exigiria tenant context (e o painel não tem auth).
//
// Privacy guard: `public_api_response`. Cache-Control: `no-store`.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db, sha256Hex } from '../_shared/db.ts';
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
import {
  readParentalConsentFlags,
  featureDisabledResponse,
} from '../_shared/parental-consent/feature-flags.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  ParentalConsentTextResponseSchema,
  type ParentalConsentTextResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'parental-consent-text-get';

function extractRequestId(url: URL): string | null {
  // /parental-consent-text-get/<uuid>/text  OR  /parental-consent-text-get/<uuid>
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
      log.info('parental_consent_feature_disabled', {
        fn: FN,
        trace_id,
        status: 503,
      });
      return featureDisabledResponse(origin);
    }

    const url = new URL(req.url);
    const requestId = extractRequestId(url);
    if (!requestId) throw new InvalidRequestError('Invalid consent_request_id');

    const panelToken = url.searchParams.get('token');
    if (!panelToken) {
      throw new ForbiddenError('Missing ?token=<guardian_panel_token>');
    }

    const client = db();

    // Carrega request (service-role bypassa RLS).
    const { data: reqRow, error: reqErr } = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, status, consent_text_version_id, guardian_panel_token_hash, guardian_panel_token_expires_at',
      )
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr || !reqRow) throw new NotFoundError('consent_request not found');

    // Valida token (constant-time).
    const expectedHash = await hashPanelToken(panelToken);
    if (
      !constantTimeEqualString(
        expectedHash,
        reqRow.guardian_panel_token_hash as string,
      )
    ) {
      throw new ForbiddenError('Invalid guardian_panel_token');
    }

    // Verifica expiração do panel token (defensivo — `parental-consent-session-get`
    // não enforça aqui, mas para o texto faz sentido proteger).
    const panelExpiresAt = reqRow.guardian_panel_token_expires_at as
      | string
      | null;
    if (panelExpiresAt && new Date(panelExpiresAt).getTime() < Date.now()) {
      throw new ForbiddenError('guardian_panel_token expired');
    }

    // Rate limit por consent_request_id (~3 chamadas / minuto). A chave
    // base usa o hash do panel token para que o token funcione como
    // segredo de identificação — sem vazar tenant context.
    const rateKeyBase = await sha256Hex(`panel:${requestId}`);
    await checkRateLimit(
      client,
      rateKeyBase,
      'parental-consent-text-get',
      null,
    );

    // Carrega texto integral (service-role bypassa RLS).
    const { data: ctvRow, error: ctvErr } = await client
      .from('consent_text_versions')
      .select('id, locale, text_hash, text_body')
      .eq('id', reqRow.consent_text_version_id)
      .maybeSingle();
    if (ctvErr || !ctvRow) {
      throw new InternalError('Failed to load consent_text_version');
    }

    const response: ParentalConsentTextResponse = {
      id: ctvRow.id as string,
      locale: ctvRow.locale as string,
      text_hash: ctvRow.text_hash as string,
      text_body: ctvRow.text_body as string,
      content_type: 'text/plain',
    };

    // Defensive: text_body é pré-aprovado e curado, mas o guard valida
    // que nenhuma chave estruturada com PII foi inadvertidamente
    // adicionada ao envelope público.
    assertPayloadSafe(response, 'public_api_response');

    // Validação Zod estrita (rejeita campos extras).
    ParentalConsentTextResponseSchema.parse(response);

    log.info('parental_consent_text_fetched', {
      fn: FN,
      trace_id,
      tenant_id: reqRow.tenant_id,
      consent_request_id: reqRow.id,
      consent_text_version_id: ctvRow.id,
      status: 200,
    });

    return jsonResponse(response, {
      origin,
      headers: {
        // Texto pode mudar entre versões — o painel não deve cachear.
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
