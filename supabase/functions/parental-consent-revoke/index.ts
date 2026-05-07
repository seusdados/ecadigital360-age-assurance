// POST /v1/parental-consent/:parental_consent_id/revoke
//
// Auth: X-AgeKey-API-Key (tenant) OU guardian_panel_token (responsável).
// Body: { reason }.
// Ação: insere parental_consent_revocations (trigger dispara webhook),
// marca parental_consents.revoked_at e parental_consent_tokens.revoked_at.

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
import {
  readParentalConsentFlags,
  featureDisabledResponse,
} from '../_shared/parental-consent/feature-flags.ts';
import { buildConsentDecisionEnvelope } from '../_shared/parental-consent/decision-envelope.ts';
import { CANONICAL_REASON_CODES } from '../../../packages/shared/src/taxonomy/reason-codes.ts';
import {
  ParentalConsentRevokeRequestSchema,
  type ParentalConsentRevokeResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'parental-consent-revoke';

function extractParentalConsentId(url: URL): string | null {
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

  if (req.method !== 'POST') {
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
    const consentId = extractParentalConsentId(url);
    if (!consentId) {
      throw new InvalidRequestError('Invalid parental_consent_id');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ParentalConsentRevokeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    const client = db();
    const apiKey = req.headers.get('x-agekey-api-key');
    const panelToken = url.searchParams.get('token');

    let source: 'tenant_admin' | 'guardian' = 'guardian';
    let tenantId: string | null = null;
    if (apiKey) {
      const principal = await authenticateApiKey(client, req);
      tenantId = principal.tenantId;
      source = 'tenant_admin';
      await setTenantContext(client, principal.tenantId);
    } else if (!panelToken) {
      throw new ForbiddenError(
        'Either X-AgeKey-API-Key or ?token=<guardian_panel_token> is required',
      );
    }

    // Carrega consent.
    const { data: pc, error: pcErr } = await client
      .from('parental_consents')
      .select(
        'id, tenant_id, application_id, consent_request_id, revoked_at',
      )
      .eq('id', consentId)
      .maybeSingle();
    if (pcErr || !pc) throw new NotFoundError('parental_consent not found');
    if (pc.revoked_at) {
      throw new InvalidRequestError('parental_consent already revoked');
    }
    if (tenantId && pc.tenant_id !== tenantId) {
      throw new ForbiddenError('cross-tenant access denied');
    }

    // Se panel token, valida via consent_request.
    if (panelToken) {
      const expectedHash = await hashPanelToken(panelToken);
      const { data: reqRow } = await client
        .from('parental_consent_requests')
        .select('guardian_panel_token_hash')
        .eq('id', pc.consent_request_id)
        .single();
      if (
        !reqRow ||
        !constantTimeEqualString(
          expectedHash,
          reqRow.guardian_panel_token_hash as string,
        )
      ) {
        throw new ForbiddenError('Invalid guardian_panel_token');
      }
    }

    // Carrega JTI ativo (se houver).
    const { data: tokenRow } = await client
      .from('parental_consent_tokens')
      .select('jti, revoked_at')
      .eq('parental_consent_id', pc.id)
      .maybeSingle();

    const revokedAt = new Date().toISOString();

    // Append revocation row (trigger gera webhook).
    const { error: revInsErr } = await client
      .from('parental_consent_revocations')
      .insert({
        tenant_id: pc.tenant_id,
        parental_consent_id: pc.id,
        jti: tokenRow?.jti ?? '00000000-0000-0000-0000-000000000000',
        source,
        reason: input.reason,
      });
    if (revInsErr) throw revInsErr;

    // Atualiza parental_consents.revoked_at (permitido pelo trigger).
    await client
      .from('parental_consents')
      .update({ revoked_at: revokedAt })
      .eq('id', pc.id);

    // Atualiza parental_consent_tokens.revoked_at (se token existe).
    if (tokenRow?.jti) {
      await client
        .from('parental_consent_tokens')
        .update({ revoked_at: revokedAt, revoked_reason: input.reason })
        .eq('jti', tokenRow.jti);
    }

    // Marca request como revoked.
    await client
      .from('parental_consent_requests')
      .update({
        status: 'revoked',
        decided_at: revokedAt,
        reason_code: 'CONSENT_REVOKED',
      })
      .eq('id', pc.consent_request_id);

    const decisionEnvelope = buildConsentDecisionEnvelope({
      decisionId: pc.id as string,
      decision: 'revoked',
      reasonCode: CANONICAL_REASON_CODES.CONSENT_REVOKED,
      tenantId: pc.tenant_id as string,
      applicationId: pc.application_id as string,
      consentTokenId: tokenRow?.jti ?? undefined,
      expiresAt: revokedAt,
    });

    const response: ParentalConsentRevokeResponse = {
      parental_consent_id: pc.id as string,
      revoked_at: revokedAt,
      reason_code: 'CONSENT_REVOKED',
      decision_envelope: decisionEnvelope,
    };
    assertPayloadSafe(response, 'public_api_response');

    log.info('parental_consent_revoked', {
      fn: FN,
      trace_id,
      tenant_id: pc.tenant_id,
      parental_consent_id: pc.id,
      source,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
