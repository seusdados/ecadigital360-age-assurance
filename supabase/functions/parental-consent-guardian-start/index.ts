// POST /v1/parental-consent/:consent_request_id/guardian/start
//
// Body: { guardian_panel_token, contact_channel, contact_value }.
// Ação: cifra contato em Vault, gera OTP, faz delivery (stub),
// devolve dev_otp em ambiente de desenvolvimento.

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
  generateOtp,
  hashOtp,
  hmacContact,
  maskContact,
  deliverOtp,
} from '../_shared/parental-consent/otp.ts';
import { readParentalConsentFlags } from '../_shared/parental-consent/feature-flags.ts';
import {
  ParentalGuardianStartRequestSchema,
  type ParentalGuardianStartResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { assertPayloadSafe } from '../../../packages/shared/src/privacy/index.ts';

const FN = 'parental-consent-guardian-start';

function extractRequestId(url: URL): string | null {
  // path: /functions/v1/parental-consent-guardian-start/<id>/guardian/start
  // ou simplesmente /<id> ao final.
  const parts = url.pathname.split('/').filter(Boolean);
  // Acha o último UUID no path.
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i] ?? '';
    if (/^[0-9a-f-]{36}$/i.test(segment)) return segment;
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
      throw new InvalidRequestError('Invalid consent_request_id in path');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ParentalGuardianStartRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    const client = db();

    // Guardian panel token validation.
    const expectedHash = await hashPanelToken(input.guardian_panel_token);

    const { data: reqRow, error: reqErr } = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, application_id, status, guardian_panel_token_hash, guardian_panel_token_expires_at, expires_at',
      )
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr || !reqRow) {
      throw new NotFoundError('consent_request not found');
    }
    if (
      !constantTimeEqualString(
        expectedHash,
        reqRow.guardian_panel_token_hash as string,
      )
    ) {
      throw new ForbiddenError('Invalid guardian_panel_token');
    }
    const panelExpires = new Date(reqRow.guardian_panel_token_expires_at as string);
    if (panelExpires.getTime() < Date.now()) {
      throw new ForbiddenError('guardian_panel_token expired');
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

    // HMAC do contato (sal por tenant) + display mascarado.
    const contactHmac = await hmacContact(
      reqRow.tenant_id as string,
      input.contact_channel,
      input.contact_value,
    );
    const masked = maskContact(input.contact_channel, input.contact_value);

    // Insere guardian_contacts com vault_secret_id NULL (preenchido na RPC).
    const { data: gcRow, error: gcErr } = await client
      .from('guardian_contacts')
      .insert({
        tenant_id: reqRow.tenant_id,
        consent_request_id: reqRow.id,
        contact_channel: input.contact_channel,
        contact_hmac: contactHmac,
        contact_masked: masked,
      })
      .select('id')
      .single();
    if (gcErr || !gcRow) {
      throw gcErr ?? new InternalError('Failed to create guardian_contacts');
    }

    // Cifra o contato em Vault via RPC (service_role).
    const { error: storeErr } = await client.rpc('guardian_contacts_store', {
      p_consent_request_id: reqRow.id,
      p_contact_value: input.contact_value,
    });
    if (storeErr) {
      throw new InternalError('Vault store failed', { cause: storeErr.message });
    }

    // OTP geração + hash + persistência.
    const otp = generateOtp();
    const otpHash = await hashOtp(otp, reqRow.id as string);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: gvRow, error: gvErr } = await client
      .from('guardian_verifications')
      .insert({
        tenant_id: reqRow.tenant_id,
        consent_request_id: reqRow.id,
        guardian_contact_id: gcRow.id,
        otp_hash: otpHash,
        expires_at: otpExpiresAt,
      })
      .select('id')
      .single();
    if (gvErr || !gvRow) {
      throw gvErr ?? new InternalError('Failed to create guardian_verification');
    }

    // Delivery (stub). Em prod, exige provider configurado.
    const delivery = await deliverOtp(
      {
        channel: input.contact_channel,
        contactCleartext: input.contact_value,
        otp,
        locale: 'pt-BR',
      },
      {
        devReturnOtp: flags.devReturnOtp,
        parentalConsentEnabled: flags.enabled,
        deliveryProvider: flags.deliveryProvider,
      },
    );

    await client
      .from('parental_consent_requests')
      .update({
        status: 'awaiting_verification',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reqRow.id);

    const response: ParentalGuardianStartResponse = {
      consent_request_id: reqRow.id as string,
      guardian_verification_id: gvRow.id as string,
      contact_channel: input.contact_channel,
      contact_masked: masked,
      otp_expires_at: otpExpiresAt,
      dev_otp: delivery.devOtp,
      status: 'awaiting_verification',
    };

    assertPayloadSafe(response, 'public_api_response');

    log.info('parental_consent_guardian_started', {
      fn: FN,
      trace_id,
      tenant_id: reqRow.tenant_id,
      consent_request_id: reqRow.id,
      provider: delivery.provider,
      delivered: delivery.delivered,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(response, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
