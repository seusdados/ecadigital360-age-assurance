// POST /v1/parental-consent/:consent_request_id/confirm
//
// Body: { guardian_panel_token, otp, decision: 'approve'|'deny',
//         consent_text_version_id }.
// Ação: valida OTP, cria parental_consents, emite parental_consent_token
// se aprovado, dispara webhook via trigger fan_out_parental_consent_webhooks.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
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
  hashOtp,
  constantTimeEqual,
} from '../_shared/parental-consent/otp.ts';
import { readParentalConsentFlags } from '../_shared/parental-consent/feature-flags.ts';
import { issueParentalConsentToken } from '../_shared/parental-consent/consent-token.ts';
import { loadActiveSigningKey } from '../_shared/keys.ts';
import { config } from '../_shared/env.ts';
import {
  ParentalConsentConfirmRequestSchema,
  type ParentalConsentConfirmResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { CANONICAL_REASON_CODES } from '../../../packages/shared/src/taxonomy/reason-codes.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'parental-consent-confirm';

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
  const t0 = Date.now();

  if (req.method !== 'POST') {
    return respondError(fnCtx, new InvalidRequestError('Method not allowed'));
  }

  try {
    const flags = readParentalConsentFlags();
    if (!flags.enabled) {
      throw new ForbiddenError(
        'AgeKey Consent module is disabled (AGEKEY_PARENTAL_CONSENT_ENABLED=false).',
      );
    }

    const url = new URL(req.url);
    const requestId = extractRequestId(url);
    if (!requestId) {
      throw new InvalidRequestError('Invalid consent_request_id');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ParentalConsentConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    const client = db();

    // Valida panel token.
    const expectedHash = await hashPanelToken(input.guardian_panel_token);
    const { data: reqRow, error: reqErr } = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, application_id, status, policy_id, policy_version_id, consent_text_version_id, purpose_codes, data_categories, guardian_panel_token_hash, guardian_panel_token_expires_at, expires_at',
      )
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr || !reqRow) throw new NotFoundError('consent_request not found');
    if (
      !constantTimeEqualString(
        expectedHash,
        reqRow.guardian_panel_token_hash as string,
      )
    ) {
      throw new ForbiddenError('Invalid guardian_panel_token');
    }
    if (
      reqRow.status === 'approved' ||
      reqRow.status === 'denied' ||
      reqRow.status === 'revoked' ||
      reqRow.status === 'expired'
    ) {
      throw new ForbiddenError(
        `consent_request already in terminal state: ${reqRow.status}`,
      );
    }
    if ((reqRow.consent_text_version_id as string) !== input.consent_text_version_id) {
      throw new InvalidRequestError(
        'consent_text_version_id mismatch — guardian must confirm the version that was displayed',
      );
    }

    // Carrega guardian_verification ativo + guardian_contact.
    const { data: gvRow, error: gvErr } = await client
      .from('guardian_verifications')
      .select(
        'id, otp_hash, attempts, max_attempts, expires_at, consumed_at, guardian_contact_id',
      )
      .eq('consent_request_id', reqRow.id)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gvErr || !gvRow) {
      throw new ForbiddenError('No active guardian verification — start one first');
    }
    if (new Date(gvRow.expires_at as string).getTime() < Date.now()) {
      throw new ForbiddenError('OTP expired');
    }
    if ((gvRow.attempts as number) >= (gvRow.max_attempts as number)) {
      throw new ForbiddenError('Max OTP attempts exceeded');
    }

    // Verifica OTP.
    const otpHash = await hashOtp(input.otp, reqRow.id as string);
    const ok = constantTimeEqual(otpHash, gvRow.otp_hash as string);
    if (!ok) {
      await client
        .from('guardian_verifications')
        .update({ attempts: (gvRow.attempts as number) + 1 })
        .eq('id', gvRow.id);
      throw new ForbiddenError('Invalid OTP');
    }

    // OTP consumido.
    await client
      .from('guardian_verifications')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', gvRow.id);

    // Carrega contact_hmac.
    const { data: gcRow, error: gcErr } = await client
      .from('guardian_contacts')
      .select('id, contact_hmac')
      .eq('id', gvRow.guardian_contact_id)
      .single();
    if (gcErr || !gcRow) throw new InternalError('guardian_contact missing');

    // Resolve policy version atual.
    const { data: policyRow } = await client
      .from('policies')
      .select('id, slug, age_threshold, current_version')
      .eq('id', reqRow.policy_id)
      .single();
    const { data: appRow } = await client
      .from('applications')
      .select('id, slug')
      .eq('id', reqRow.application_id)
      .single();

    if (!policyRow || !appRow) {
      throw new InternalError('Failed to load policy/application');
    }

    // Decide reason_code.
    const decisionStr =
      input.decision === 'approve' ? ('granted' as const) : ('denied' as const);
    const reasonCode =
      decisionStr === 'granted'
        ? CANONICAL_REASON_CODES.CONSENT_APPROVED
        : CANONICAL_REASON_CODES.CONSENT_DENIED;

    // Insere parental_consent (append-only).
    const expiresAt = new Date(
      Date.now() + flags.consentDefaultExpiryDays * 86_400_000,
    ).toISOString();
    const grantedAt = decisionStr === 'granted' ? new Date().toISOString() : null;

    const { data: pcRow, error: pcErr } = await client
      .from('parental_consents')
      .insert({
        tenant_id: reqRow.tenant_id,
        application_id: reqRow.application_id,
        consent_request_id: reqRow.id,
        policy_id: reqRow.policy_id,
        policy_version_id: reqRow.policy_version_id,
        consent_text_version_id: reqRow.consent_text_version_id,
        decision: decisionStr,
        reason_code: reasonCode,
        consent_assurance_level: 'AAL-C1',
        purpose_codes: reqRow.purpose_codes,
        data_categories: reqRow.data_categories,
        guardian_contact_hmac: gcRow.contact_hmac,
        granted_at: grantedAt,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (pcErr || !pcRow) {
      throw pcErr ?? new InternalError('Failed to insert parental_consent');
    }

    // Atualiza request status.
    await client
      .from('parental_consent_requests')
      .update({
        status: decisionStr === 'granted' ? 'approved' : 'denied',
        decided_at: new Date().toISOString(),
        reason_code: reasonCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reqRow.id);

    // Emite token quando aprovado.
    let tokenOut: ParentalConsentConfirmResponse['token'] = null;
    if (decisionStr === 'granted') {
      const signingKey = await loadActiveSigningKey(client);
      // Cria parental_consent_token row para FK do JTI.
      const tokenExpIso = new Date(
        Date.now() + flags.consentTokenTtlSeconds * 1000,
      ).toISOString();
      const { data: pctRow, error: pctErr } = await client
        .from('parental_consent_tokens')
        .insert({
          tenant_id: reqRow.tenant_id,
          application_id: reqRow.application_id,
          parental_consent_id: pcRow.id,
          kid: signingKey.kid,
          expires_at: tokenExpIso,
        })
        .select('jti')
        .single();
      if (pctErr || !pctRow) {
        throw pctErr ?? new InternalError('Failed to insert parental_consent_token');
      }
      const issued = await issueParentalConsentToken({
        tenantId: reqRow.tenant_id as string,
        applicationId: reqRow.application_id as string,
        applicationSlug: appRow.slug as string,
        parentalConsentId: pcRow.id as string,
        policyId: policyRow.id as string,
        policySlug: policyRow.slug as string,
        policyVersion: policyRow.current_version as number,
        consentTextVersionId: reqRow.consent_text_version_id as string,
        purposeCodes: reqRow.purpose_codes as string[],
        dataCategories: reqRow.data_categories as string[],
        consentAssuranceLevel: 'AAL-C1',
        signingKey,
        issuer: config.issuer(),
        jti: pctRow.jti as string,
        ttlSeconds: flags.consentTokenTtlSeconds,
        reasonCode,
        decisionId: pcRow.id as string,
      });
      tokenOut = {
        jwt: issued.jwt,
        jti: issued.jti,
        expires_at: issued.expiresAt,
        kid: issued.kid,
      };
    }

    const response: ParentalConsentConfirmResponse = {
      consent_request_id: reqRow.id as string,
      parental_consent_id: pcRow.id as string,
      status: decisionStr === 'granted' ? 'approved' : 'denied',
      decision: decisionStr === 'granted' ? 'approved' : 'denied',
      reason_code: reasonCode,
      token: tokenOut,
    };

    assertPayloadSafe(response, 'public_api_response');

    log.info('parental_consent_confirmed', {
      fn: FN,
      trace_id,
      tenant_id: reqRow.tenant_id,
      consent_request_id: reqRow.id,
      decision: decisionStr,
      reason_code: reasonCode,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
