// Emissão e verificação do `parental_consent_token`.
//
// Forma: JWT ES256 idêntico em estrutura ao `result_token` do Core,
// com `agekey.decision_domain = 'parental_consent'`. Reusa as
// `crypto_keys` do Core (mesmo JWKS público).

import { signResultToken, verifyResultToken } from '../tokens.ts';
import type { ParentalConsentTokenClaims } from '../../../../packages/shared/src/schemas/parental-consent.ts';
import { ParentalConsentTokenClaimsSchema } from '../../../../packages/shared/src/schemas/parental-consent.ts';
import { assertPayloadSafe } from '../../../../packages/shared/src/privacy/index.ts';
import type { JwsSigningKey } from '../tokens.ts';

export interface ParentalConsentTokenIssueParams {
  tenantId: string;
  applicationId: string;
  applicationSlug: string;
  parentalConsentId: string;
  policyId: string;
  policySlug: string;
  policyVersion: number;
  consentTextVersionId: string;
  purposeCodes: string[];
  dataCategories: string[];
  consentAssuranceLevel: 'AAL-C0' | 'AAL-C1' | 'AAL-C2' | 'AAL-C3' | 'AAL-C4';
  signingKey: JwsSigningKey;
  issuer: string;
  jti: string;
  ttlSeconds: number;
  reasonCode: string;
  decisionId: string;
}

export interface ParentalConsentTokenIssueResult {
  jwt: string;
  jti: string;
  expiresAt: string;
  kid: string;
  claims: ParentalConsentTokenClaims;
}

export async function issueParentalConsentToken(
  p: ParentalConsentTokenIssueParams,
): Promise<ParentalConsentTokenIssueResult> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + p.ttlSeconds;
  const expIso = new Date(exp * 1000).toISOString();

  const claims: ParentalConsentTokenClaims = {
    iss: p.issuer,
    aud: p.applicationSlug,
    jti: p.jti,
    iat: now,
    nbf: now,
    exp,
    agekey: {
      decision: 'approved',
      decision_domain: 'parental_consent',
      decision_id: p.decisionId,
      reason_code: p.reasonCode,
      policy: {
        id: p.policyId,
        slug: p.policySlug,
        version: p.policyVersion,
      },
      tenant_id: p.tenantId,
      application_id: p.applicationId,
      purpose_codes: p.purposeCodes,
      data_categories: p.dataCategories,
      consent_text_version_id: p.consentTextVersionId,
      consent_assurance_level: p.consentAssuranceLevel,
    },
  };

  // Validação Zod + privacy guard antes de assinar.
  ParentalConsentTokenClaimsSchema.parse(claims);
  assertPayloadSafe(claims, 'public_token');

  // signResultToken aceita qualquer estrutura via tipo amplo;
  // nosso claim tem o mesmo formato base do result_token.
  const jwt = await signResultToken(
    claims as unknown as Parameters<typeof signResultToken>[0],
    p.signingKey,
  );
  return {
    jwt,
    jti: p.jti,
    expiresAt: expIso,
    kid: p.signingKey.kid,
    claims,
  };
}

export type ParentalConsentTokenVerifyOk = {
  valid: true;
  claims: ParentalConsentTokenClaims;
  kid: string;
};
export type ParentalConsentTokenVerifyFail = {
  valid: false;
  reason:
    | 'malformed'
    | 'unknown_kid'
    | 'bad_signature'
    | 'expired'
    | 'not_yet_valid'
    | 'wrong_issuer'
    | 'wrong_audience'
    | 'wrong_decision_domain';
};

export async function verifyParentalConsentToken(
  jwt: string,
  opts: {
    jwksKeys: Array<{ kid: string; publicJwk: JsonWebKey }>;
    expectedIssuer?: string;
    expectedAudience?: string;
    clockSkewSeconds?: number;
    now?: number;
  },
): Promise<ParentalConsentTokenVerifyOk | ParentalConsentTokenVerifyFail> {
  const verifyOptsRaw: {
    jwksKeys: typeof opts.jwksKeys;
    expectedIssuer?: string;
    expectedAudience?: string;
    clockSkewSeconds?: number;
    now?: number;
  } = { jwksKeys: opts.jwksKeys };
  if (opts.expectedIssuer !== undefined) verifyOptsRaw.expectedIssuer = opts.expectedIssuer;
  if (opts.expectedAudience !== undefined) verifyOptsRaw.expectedAudience = opts.expectedAudience;
  if (opts.clockSkewSeconds !== undefined) verifyOptsRaw.clockSkewSeconds = opts.clockSkewSeconds;
  if (opts.now !== undefined) verifyOptsRaw.now = opts.now;
  const result = await verifyResultToken(jwt, verifyOptsRaw as Parameters<typeof verifyResultToken>[1]);
  if (!result.valid || !result.claims) {
    return {
      valid: false,
      reason: (result.reason ?? 'malformed') as ParentalConsentTokenVerifyFail['reason'],
    };
  }
  // Verifica que é um parental_consent_token e não um result_token do Core.
  const agekey = (result.claims as { agekey?: { decision_domain?: unknown } }).agekey;
  if (!agekey || agekey.decision_domain !== 'parental_consent') {
    return { valid: false, reason: 'wrong_decision_domain' };
  }
  // Valida estrutura completa do consent token.
  const parsed = ParentalConsentTokenClaimsSchema.safeParse(result.claims);
  if (!parsed.success) {
    return { valid: false, reason: 'malformed' };
  }
  return { valid: true, claims: parsed.data, kid: result.kid! };
}
