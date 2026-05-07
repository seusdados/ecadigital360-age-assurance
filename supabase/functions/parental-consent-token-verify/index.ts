// POST /v1/parental-consent/token/verify — verify a consent token.
//
// Public endpoint (no API key required) — exactly like /verifications/token/verify.
// Verifies the JWS signature against the published JWKS, checks audience,
// resource, expiry and revocation, and returns a minimised response.
//
// Reference: docs/modules/parental-consent/api.md §POST /token/verify

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  ConsentTokenVerifyRequestSchema,
  ConsentTokenVerifyResponseSchema,
  CONSENT_FEATURE_FLAGS,
  REASON_CODES,
  ParentalConsentTokenClaimsSchema,
  assertPublicPayloadHasNoPii,
  readConsentFeatureFlag,
} from '../../../packages/shared/src/index.ts';
import { db } from '../_shared/db.ts';
import {
  ForbiddenError,
  InvalidRequestError,
  jsonResponse,
  respondError,
} from '../_shared/errors.ts';
import { log, newTraceId } from '../_shared/logger.ts';
import { preflight } from '../_shared/cors.ts';
import { loadJwksPublicKeys } from '../_shared/keys.ts';
import { verifyJws } from '../../../packages/shared/src/jws-generic.ts';

const FN = 'parental-consent-token-verify';

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

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new InvalidRequestError('Invalid JSON body');
    }
    const parsed = ConsentTokenVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidRequestError(
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;

    const client = db();
    const jwksKeys = (await loadJwksPublicKeys(client)).map((k) => ({
      ...k.publicJwk,
      kid: k.kid,
    }));

    const verifyOpts = input.expected_audience
      ? { jwksKeys, expectedAudience: input.expected_audience }
      : { jwksKeys };
    const verification = await verifyJws(input.token, verifyOpts);

    if (!verification.valid || !verification.parsed) {
      const respInvalid = {
        valid: false,
        revoked: false,
        reason_code: mapVerifyReason(verification.reason),
        parental_consent_id: null,
        resource: null,
        pii_included: false as const,
        content_included: false as const,
      };
      assertPublicPayloadHasNoPii(respInvalid);
      return jsonResponse(
        ConsentTokenVerifyResponseSchema.parse(respInvalid),
        { origin: fnCtx.origin },
      );
    }

    const claimsParsed = ParentalConsentTokenClaimsSchema.safeParse(
      verification.parsed.payload,
    );
    if (!claimsParsed.success) {
      const respMalformed = {
        valid: false,
        revoked: false,
        reason_code: REASON_CODES.INVALID_REQUEST,
        parental_consent_id: null,
        resource: null,
        pii_included: false as const,
        content_included: false as const,
      };
      return jsonResponse(
        ConsentTokenVerifyResponseSchema.parse(respMalformed),
        { origin: fnCtx.origin },
      );
    }
    const claims = claimsParsed.data;

    if (
      input.expected_resource &&
      claims.agekey.resource !== input.expected_resource
    ) {
      const resp = {
        valid: false,
        revoked: false,
        reason_code: REASON_CODES.CONSENT_RESOURCE_NOT_AUTHORIZED,
        parental_consent_id: claims.agekey.parental_consent_id,
        resource: claims.agekey.resource,
        pii_included: false as const,
        content_included: false as const,
      };
      return jsonResponse(ConsentTokenVerifyResponseSchema.parse(resp), {
        origin: fnCtx.origin,
      });
    }

    const tokRow = await client
      .from('parental_consent_tokens')
      .select('jti, status, expires_at, revoked_at, parental_consent_id')
      .eq('jti', claims.jti)
      .maybeSingle();
    if (tokRow.error) throw tokRow.error;
    const revoked = tokRow.data?.status === 'revoked';
    if (!tokRow.data) {
      const resp = {
        valid: false,
        revoked: false,
        reason_code: REASON_CODES.CONSENT_PROOF_MISSING,
        parental_consent_id: claims.agekey.parental_consent_id,
        resource: claims.agekey.resource,
        pii_included: false as const,
        content_included: false as const,
      };
      return jsonResponse(ConsentTokenVerifyResponseSchema.parse(resp), {
        origin: fnCtx.origin,
      });
    }

    const respBody = {
      valid: !revoked,
      revoked,
      reason_code: revoked
        ? REASON_CODES.CONSENT_REVOKED
        : REASON_CODES.CONSENT_GRANTED,
      parental_consent_id: claims.agekey.parental_consent_id,
      resource: claims.agekey.resource,
      claims: {
        decision: claims.agekey.decision,
        decision_domain: claims.agekey.decision_domain,
        resource: claims.agekey.resource,
        scope: claims.agekey.scope,
        purpose_codes: claims.agekey.purpose_codes,
        data_categories: claims.agekey.data_categories,
        method: claims.agekey.method,
        assurance_level: claims.agekey.assurance_level,
        risk_tier: claims.agekey.risk_tier,
        consent_token_id: claims.agekey.consent_token_id,
        parental_consent_id: claims.agekey.parental_consent_id,
        tenant_id: claims.agekey.tenant_id,
        application_id: claims.agekey.application_id,
        iat: claims.iat,
        exp: claims.exp,
      },
      pii_included: false as const,
      content_included: false as const,
    };
    assertPublicPayloadHasNoPii(respBody);
    const validated = ConsentTokenVerifyResponseSchema.parse(respBody);

    log.info('parental_consent_token_verified', {
      fn: FN,
      trace_id,
      jti: claims.jti,
      valid: validated.valid,
      revoked,
      status: 200,
    });

    return jsonResponse(validated, { origin: fnCtx.origin });
  } catch (err) {
    return respondError(fnCtx, err);
  }
});

function mapVerifyReason(reason: string | undefined): string {
  switch (reason) {
    case 'expired':
      return REASON_CODES.CONSENT_EXPIRED;
    case 'wrong_audience':
      return REASON_CODES.CONSENT_RESOURCE_NOT_AUTHORIZED;
    case 'wrong_issuer':
    case 'unknown_kid':
    case 'bad_signature':
    case 'malformed':
    case 'unsupported_alg':
      return REASON_CODES.INVALID_REQUEST;
    default:
      return REASON_CODES.CONSENT_PROOF_MISSING;
  }
}
