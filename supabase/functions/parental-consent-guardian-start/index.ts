// POST /v1/parental-consent/:id/guardian/start — start guardian channel.
//
// Auth: X-AgeKey-API-Key. Hashes the contact (per-tenant HMAC), upserts a
// guardian_contacts row, generates an OTP digest, and inserts a
// guardian_verifications row with status='sent' (the actual dispatch is
// gated behind AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED — when off, the
// function persists everything but logs a stub). The response NEVER echoes
// the contact.
//
// Reference: docs/modules/parental-consent/api.md §POST /:id/guardian/start

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ConsentGuardianStartRequestSchema,
  ConsentGuardianStartResponseSchema,
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
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { consentHmacHex } from '../_shared/consent-hmac.ts';

const FN = 'parental-consent-guardian-start';

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

function generateOtpDigit(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let digits = '';
  for (const b of buf) digits += (b % 10).toString();
  return digits; // 6-digit numeric OTP
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function methodForContactType(
  contactType: 'email' | 'phone' | 'school_account' | 'federated_account',
): 'otp_email' | 'otp_phone' | 'school_sso' | 'federated_sso' {
  switch (contactType) {
    case 'email':
      return 'otp_email';
    case 'phone':
      return 'otp_phone';
    case 'school_account':
      return 'school_sso';
    case 'federated_account':
      return 'federated_sso';
  }
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
  // expected path: /functions/v1/parental-consent-guardian-start/<id> or
  // /v1/parental-consent/<id>/guardian/start (handled by an upstream router)
  const consentRequestId = url.pathname
    .split('/')
    .filter(Boolean)
    .pop();
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
      'parental-consent-guardian-start',
      principal.tenantId,
    );

    const reqRow = await client
      .from('parental_consent_requests')
      .select(
        'id, tenant_id, application_id, status, expires_at, decision, reason_code',
      )
      .eq('id', consentRequestId)
      .maybeSingle();
    if (reqRow.error) throw reqRow.error;
    if (!reqRow.data) throw new NotFoundError('Consent request not found');
    if (reqRow.data.tenant_id !== principal.tenantId) {
      throw new ForbiddenError('Consent request belongs to another tenant');
    }
    if (
      reqRow.data.status !== 'pending_guardian' &&
      reqRow.data.status !== 'pending_verification' &&
      reqRow.data.status !== 'created'
    ) {
      throw new InvalidRequestError(
        `Cannot start guardian flow when status='${reqRow.data.status}'`,
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ConsentGuardianStartRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const method = input.preferred_method ?? methodForContactType(input.contact_type);

    const guardianRefHmac = await consentHmacHex(
      client,
      principal.tenantId,
      'guardian_ref',
      input.contact,
    );
    const contactHash = await consentHmacHex(
      client,
      principal.tenantId,
      'contact',
      input.contact,
    );

    // Upsert guardian_contacts (one active per (tenant, request, hash)).
    const existing = await client
      .from('guardian_contacts')
      .select('id, verification_status')
      .eq('tenant_id', principal.tenantId)
      .eq('consent_request_id', consentRequestId)
      .eq('contact_hash', contactHash)
      .maybeSingle();
    if (existing.error) throw existing.error;

    let guardianContactId: string;
    if (existing.data) {
      guardianContactId = existing.data.id;
      const upd = await client
        .from('guardian_contacts')
        .update({ last_otp_sent_at: new Date().toISOString() })
        .eq('id', guardianContactId);
      if (upd.error) throw upd.error;
    } else {
      const ins = await client
        .from('guardian_contacts')
        .insert({
          tenant_id: principal.tenantId,
          consent_request_id: consentRequestId,
          guardian_ref_hmac: guardianRefHmac,
          contact_type: input.contact_type,
          contact_hash: contactHash,
          last_otp_sent_at: new Date().toISOString(),
          verification_status: 'sent',
        })
        .select('id')
        .single();
      if (ins.error) throw ins.error;
      guardianContactId = ins.data.id;
    }

    const otpEnabled = readConsentFeatureFlag(
      {
        AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED: Deno.env.get(
          CONSENT_FEATURE_FLAGS.GUARDIAN_OTP_ENABLED,
        ),
      },
      CONSENT_FEATURE_FLAGS.GUARDIAN_OTP_ENABLED,
    );

    const otp = generateOtpDigit();
    const otpDigest = await sha256Hex(`${guardianRefHmac}|${otp}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10min

    const ins = await client
      .from('guardian_verifications')
      .insert({
        tenant_id: principal.tenantId,
        consent_request_id: consentRequestId,
        guardian_contact_id: guardianContactId,
        method,
        assurance_level: 'low',
        decision: 'pending',
        reason_code: 'CONSENT_GUARDIAN_NOT_VERIFIED',
        otp_digest: otpDigest,
        otp_attempts: 0,
        otp_expires_at: expiresAt.toISOString(),
        evidence_json: { channel: input.contact_type },
      })
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    await client
      .from('parental_consent_requests')
      .update({ status: 'pending_verification' })
      .eq('id', consentRequestId);

    if (!otpEnabled) {
      log.warn('parental_consent_otp_dispatch_stub', {
        fn: FN,
        trace_id,
        consent_request_id: consentRequestId,
        method,
        note: 'OTP dispatch is gated by AGEKEY_CONSENT_GUARDIAN_OTP_ENABLED',
      });
    } else {
      // STUB: real OTP dispatch (email/SMS provider) ships in a follow-up
      // round. The honest behaviour is to record the attempt and fail the
      // verification at confirm time if no provider is bound. We deliberately
      // do NOT log the OTP value.
      log.info('parental_consent_otp_dispatch_pending', {
        fn: FN,
        trace_id,
        consent_request_id: consentRequestId,
        method,
        note: 'Provider integration pending — OTP digest persisted',
      });
    }

    const responseBody = {
      consent_request_id: consentRequestId,
      decision: 'pending' as const,
      status: 'pending_verification' as const,
      reason_code: 'CONSENT_GUARDIAN_NOT_VERIFIED',
      method,
      verification_status: 'sent' as const,
      expires_at: expiresAt.toISOString(),
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(responseBody);
    const validated = ConsentGuardianStartResponseSchema.parse(responseBody);

    log.info('parental_consent_guardian_started', {
      fn: FN,
      trace_id,
      tenant_id: principal.tenantId,
      consent_request_id: consentRequestId,
      method,
      duration_ms: Date.now() - t0,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
