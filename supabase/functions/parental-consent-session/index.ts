// POST /v1/parental-consent/session
//
// Auth: X-AgeKey-API-Key (do tenant que está integrando AgeKey Consent).
// Cria parental_consent_request + retorna URL pública + token do painel.
// Não envia OTP — isso acontece em /guardian/start.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { authenticateApiKey } from '../_shared/auth.ts';
import { db, setTenantContext } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
  InternalError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { resolvePolicy } from '../_shared/policy-engine.ts';
import {
  generatePanelToken,
  hashPanelToken,
} from '../_shared/parental-consent/panel-token.ts';
import {
  readParentalConsentFlags,
  featureDisabledResponse,
} from '../_shared/parental-consent/feature-flags.ts';
import { buildConsentDecisionEnvelope } from '../_shared/parental-consent/decision-envelope.ts';
import {
  ParentalConsentSessionCreateRequestSchema,
  type ParentalConsentSessionCreateResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';
import { CANONICAL_REASON_CODES } from '../../../packages/shared/src/taxonomy/reason-codes.ts';

const FN = 'parental-consent-session';

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
    const flags = readParentalConsentFlags();
    if (!flags.enabled) {
      // 503 — não tocar DB. Sem leitura/escrita.
      log.info('parental_consent_feature_disabled', {
        fn: FN,
        trace_id,
        status: 503,
      });
      return featureDisabledResponse(origin);
    }

    const client = db();
    const principal = await authenticateApiKey(client, req);
    await setTenantContext(client, principal.tenantId);
    await checkRateLimit(
      client,
      principal.apiKeyHash,
      'parental-consent-session',
      principal.tenantId,
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ParentalConsentSessionCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    // Privacy guard defensivo no input — bloqueia child_ref_hmac que
    // contenha PII direta (e-mail, CPF etc.) embora o schema aceite.
    assertPayloadSafe(
      { child_ref_hmac: input.child_ref_hmac },
      'public_api_response',
    );

    // Resolve policy + version snapshot.
    const { snapshot: policy, policy_version_id: policyVersionId } = await resolvePolicy(
      client,
      principal.tenantId,
      input.policy_slug,
    );

    // Resolve consent_text_version.
    let consentTextVersionId = input.consent_text_version_id ?? null;
    if (!consentTextVersionId) {
      const { data: ctv, error: ctvErr } = await client
        .from('consent_text_versions')
        .select('id, locale, text_hash')
        .eq('tenant_id', principal.tenantId)
        .eq('policy_id', policy.id)
        .eq('policy_version', policy.current_version)
        .eq('locale', input.locale)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ctvErr || !ctv) {
        throw new InvalidRequestError(
          `No active consent_text_version for policy=${input.policy_slug} locale=${input.locale}.`,
        );
      }
      consentTextVersionId = ctv.id as string;
    }

    const { data: ctvRow, error: ctvLoadErr } = await client
      .from('consent_text_versions')
      .select('id, locale, text_hash')
      .eq('id', consentTextVersionId)
      .single();
    if (ctvLoadErr || !ctvRow) {
      throw new InvalidRequestError('Invalid consent_text_version_id.');
    }

    // Panel token (raw + hash).
    const panelTokenRaw = generatePanelToken();
    const panelTokenHash = await hashPanelToken(panelTokenRaw);
    const panelExpires = new Date(
      Date.now() + flags.guardianPanelTtlSeconds * 1000,
    ).toISOString();

    const insertPayload = {
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      policy_id: policy.id,
      policy_version_id: policyVersionId,
      consent_text_version_id: consentTextVersionId,
      resource: input.resource,
      purpose_codes: input.purpose_codes,
      data_categories: input.data_categories,
      locale: input.locale,
      child_ref_hmac: input.child_ref_hmac,
      status: 'awaiting_guardian',
      guardian_panel_token_hash: panelTokenHash,
      guardian_panel_token_expires_at: panelExpires,
      redirect_url: input.redirect_url ?? null,
      expires_at: panelExpires,
    };

    const { data: req_, error: insertErr } = await client
      .from('parental_consent_requests')
      .insert(insertPayload)
      .select('id, status, expires_at')
      .single();
    if (insertErr || !req_) {
      throw insertErr ?? new InternalError('Failed to create consent request');
    }

    const panelUrl = `${flags.panelBaseUrl.replace(/\/+$/, '')}/${
      req_.id
    }?token=${encodeURIComponent(panelTokenRaw)}`;

    const decisionEnvelope = buildConsentDecisionEnvelope({
      decisionId: req_.id as string,
      decision: 'pending_guardian',
      reasonCode: CANONICAL_REASON_CODES.CONSENT_REQUIRED,
      tenantId: principal.tenantId,
      applicationId: principal.applicationId,
      policyId: policy.id,
      policyVersion: String(policy.current_version),
      resource: input.resource,
      expiresAt: req_.expires_at as string,
    });

    const response: ParentalConsentSessionCreateResponse = {
      consent_request_id: req_.id as string,
      status: req_.status as ParentalConsentSessionCreateResponse['status'],
      expires_at: req_.expires_at as string,
      guardian_panel_url: panelUrl,
      guardian_panel_token: panelTokenRaw,
      policy: {
        id: policy.id,
        slug: policy.slug,
        version: policy.current_version,
        age_threshold: policy.age_threshold,
      },
      consent_text: {
        id: ctvRow.id as string,
        locale: ctvRow.locale as string,
        text_hash: ctvRow.text_hash as string,
      },
      decision_envelope: decisionEnvelope,
    };

    // Defesa final — resposta pública não pode vazar PII.
    assertPayloadSafe(response, 'public_api_response');

    log.info('parental_consent_session_created', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      application_id: principal.applicationId,
      consent_request_id: req_.id,
      reason_code: CANONICAL_REASON_CODES.CONSENT_REQUIRED,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
