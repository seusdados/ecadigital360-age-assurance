// POST /v1/parental-consent/token/verify
//
// Body: { token, expected_audience? }.
// Verifica assinatura ES256 + JWKS comum + checagem online de revogação.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { db } from '../_shared/db.ts';
import {
  jsonResponse,
  respondError,
  InvalidRequestError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { config } from '../_shared/env.ts';
import { verifyParentalConsentToken } from '../_shared/parental-consent/consent-token.ts';
import {
  readParentalConsentFlags,
  featureDisabledResponse,
} from '../_shared/parental-consent/feature-flags.ts';
import { buildConsentDecisionEnvelope } from '../_shared/parental-consent/decision-envelope.ts';
import {
  ParentalConsentTokenVerifyRequestSchema,
  type ParentalConsentTokenVerifyResponse,
} from '../../../packages/shared/src/schemas/parental-consent.ts';
import { CANONICAL_REASON_CODES } from '../../../packages/shared/src/taxonomy/reason-codes.ts';

const FN = 'parental-consent-token-verify';

async function loadJwksPublic(client: ReturnType<typeof db>): Promise<
  Array<{ kid: string; publicJwk: JsonWebKey }>
> {
  const { data, error } = await client
    .from('crypto_keys')
    .select('kid, public_jwk_json')
    .eq('status', 'active')
    .order('rotated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    kid: row.kid as string,
    publicJwk: row.public_jwk_json as JsonWebKey,
  }));
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ParentalConsentTokenVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError('Invalid body', parsed.error.flatten());
    }
    const input = parsed.data;

    const client = db();
    const jwks = await loadJwksPublic(client);

    const verifyOpts: Parameters<typeof verifyParentalConsentToken>[1] = {
      jwksKeys: jwks,
      expectedIssuer: config.issuer(),
    };
    if (input.expected_audience !== undefined) {
      verifyOpts.expectedAudience = input.expected_audience;
    }

    const result = await verifyParentalConsentToken(input.token, verifyOpts);

    if (!result.valid) {
      const reasonMap: Record<string, string> = {
        malformed: CANONICAL_REASON_CODES.TOKEN_INVALID,
        unknown_kid: CANONICAL_REASON_CODES.TOKEN_INVALID,
        bad_signature: CANONICAL_REASON_CODES.TOKEN_INVALID,
        expired: CANONICAL_REASON_CODES.TOKEN_EXPIRED,
        not_yet_valid: CANONICAL_REASON_CODES.TOKEN_INVALID,
        wrong_issuer: CANONICAL_REASON_CODES.TOKEN_INVALID,
        wrong_audience: CANONICAL_REASON_CODES.TOKEN_AUDIENCE_MISMATCH,
        wrong_decision_domain: CANONICAL_REASON_CODES.TOKEN_INVALID,
      };
      const out: ParentalConsentTokenVerifyResponse = {
        valid: false,
        reason_code: reasonMap[result.reason] ?? CANONICAL_REASON_CODES.TOKEN_INVALID,
        revoked: false,
      };
      // Evento de auditoria distinto para rejeição.
      log.info('parental_consent_token_rejected', {
        fn: FN,
        trace_id,
        valid: false,
        reason: result.reason,
        reason_code: out.reason_code,
        status: 200,
      });
      return jsonResponse(out, { origin });
    }

    // Checagem online de revogação.
    const { data: tokenRow } = await client
      .from('parental_consent_tokens')
      .select('revoked_at')
      .eq('jti', result.claims.jti)
      .maybeSingle();
    const revoked = Boolean(tokenRow?.revoked_at);

    const reasonCode = revoked
      ? CANONICAL_REASON_CODES.TOKEN_REVOKED
      : CANONICAL_REASON_CODES.CONSENT_APPROVED;

    const decisionEnvelope = buildConsentDecisionEnvelope({
      decisionId: result.claims.agekey.decision_id,
      decision: revoked ? 'revoked' : 'approved',
      reasonCode,
      tenantId: result.claims.agekey.tenant_id,
      applicationId: result.claims.agekey.application_id,
      policyId: result.claims.agekey.policy.id,
      policyVersion: String(result.claims.agekey.policy.version),
      consentTokenId: result.claims.jti,
      expiresAt: new Date(result.claims.exp * 1000).toISOString(),
      assuranceLevel: result.claims.agekey.consent_assurance_level,
    });

    const out: ParentalConsentTokenVerifyResponse = {
      valid: !revoked,
      revoked,
      reason_code: reasonCode,
      claims: result.claims,
      decision_envelope: decisionEnvelope,
    };

    // Evento de auditoria distinto para verificação bem-sucedida.
    log.info(
      revoked ? 'parental_consent_token_rejected' : 'parental_consent_token_verified',
      {
        fn: FN,
        trace_id,
        valid: out.valid,
        revoked,
        reason_code: reasonCode,
        status: 200,
      },
    );
    return jsonResponse(out, { origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});
