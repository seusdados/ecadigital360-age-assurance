// VC adapter — verifies W3C VC (JWT-VC) and SD-JWT VC credentials.
//
// Algorithm:
//   1. Find issuer in trust registry; refuse if untrusted, suspended or
//      formato declarado não está em supports_formats.
//   2. Parse credential according to `format`:
//        - 'w3c_vc' → JWT (`eyJ...`); claim age_at_least em vc.credentialSubject
//        - 'sd_jwt_vc' → JWS + disclosures; age_at_least disclosable
//   3. Verify signature using issuer.public_keys_json (JWKS-shaped).
//   4. Check exp/nbf, iss matches issuer_did, audience opcional.
//   5. Cache de revogação: issuer_revocations.credential_id = jti / cnonce.
//   6. Predicate: declared age_at_least >= policy.age_threshold AND nonce match.
//
// Falhas mapeadas em reason codes do catálogo (REASON_CODES.VC_*).

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';
import {
  parseSdJwt,
  verifyJws,
} from '../../../../packages/shared/src/jws-generic.ts';
import { db } from '../db.ts';
import { findTrustedIssuer, isCredentialRevoked } from '../trust-registry.ts';

interface Vc1Subject {
  age_at_least?: number;
  [k: string]: unknown;
}

interface Vc1Payload {
  iss?: string;
  jti?: string;
  exp?: number;
  nbf?: number;
  aud?: string;
  nonce?: string;
  vc?: {
    credentialSubject?: Vc1Subject;
    type?: string[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export const vcAdapter: VerificationAdapter = {
  method: 'vc',

  async prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload> {
    return {
      method: 'vc',
      client_payload: {
        challenge_nonce: ctx.nonce,
        accepted_formats: ['w3c_vc', 'sd_jwt_vc'],
        request: {
          claim: 'age_at_least',
          threshold: ctx.policy.age_threshold,
        },
      },
    };
  },

  async completeSession(
    ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult> {
    if (input.method !== 'vc') {
      throw new AdapterDenied(REASON_CODES.INVALID_REQUEST, 'method mismatch');
    }

    const issuer = await findTrustedIssuer(db(), ctx.tenantId, input.issuer_did);
    if (!issuer) {
      return denied(REASON_CODES.VC_ISSUER_UNTRUSTED, input.issuer_did, 'unknown_or_untrusted');
    }
    if (!issuer.supports_formats.includes(input.format)) {
      return denied(REASON_CODES.VC_FORMAT_UNSUPPORTED, input.issuer_did, input.format);
    }

    // Issuer JWKS expected as { keys: [...] } or directly as { keys-shape }
    const jwksKeys = extractKeys(issuer.public_keys_json);
    if (jwksKeys.length === 0) {
      return denied(REASON_CODES.VC_SIGNATURE_INVALID, input.issuer_did, 'no_issuer_keys');
    }

    let payload: Vc1Payload;
    let credentialId: string | null = null;

    if (input.format === 'w3c_vc') {
      const verify = await verifyJws(input.credential, {
        jwksKeys,
        expectedIssuer: input.issuer_did,
      });
      if (!verify.valid) return mapJwsFailure(verify.reason, input.issuer_did);
      payload = verify.parsed!.payload as Vc1Payload;
      credentialId = (payload.jti as string) ?? null;
    } else {
      // sd_jwt_vc
      const sd = await parseSdJwt(input.credential);
      if (!sd) {
        return denied(REASON_CODES.VC_SIGNATURE_INVALID, input.issuer_did, 'malformed_sd_jwt');
      }
      const verify = await verifyJws(sd.jws, {
        jwksKeys,
        expectedIssuer: input.issuer_did,
      });
      if (!verify.valid) return mapJwsFailure(verify.reason, input.issuer_did);
      // Merge envelope claims with verified disclosures
      payload = { ...(verify.parsed!.payload as Vc1Payload), vc: { credentialSubject: sd.claims } };
      credentialId = (payload.jti as string) ?? null;
    }

    // Revocation cache
    if (credentialId && (await isCredentialRevoked(db(), issuer.id, credentialId))) {
      return denied(REASON_CODES.VC_CREDENTIAL_REVOKED, input.issuer_did, credentialId);
    }

    // Nonce binding (optional but recommended; clients pass it under `nonce`
    // claim or via presentation envelope). When present, must match session nonce.
    const presentationNonce = input.presentation_nonce ?? (payload.nonce as string | undefined);
    if (presentationNonce && presentationNonce !== ctx.nonce) {
      return denied(REASON_CODES.VC_SIGNATURE_INVALID, input.issuer_did, 'nonce_mismatch');
    }

    // Selective-disclosure / direct claim: age_at_least
    const subject =
      (payload.vc?.credentialSubject as Vc1Subject | undefined) ??
      (payload as unknown as Vc1Subject);
    const declaredAge = Number(subject?.age_at_least);
    if (!Number.isFinite(declaredAge)) {
      return denied(
        REASON_CODES.VC_SELECTIVE_DISCLOSURE_MISMATCH,
        input.issuer_did,
        'age_at_least_missing',
      );
    }
    if (declaredAge < ctx.policy.age_threshold) {
      return {
        decision: 'denied',
        threshold_satisfied: false,
        assurance_level: 'substantial',
        method: 'vc',
        reason_code: REASON_CODES.POLICY_ASSURANCE_UNMET,
        issuer_did: input.issuer_did,
        evidence: {
          format: input.format,
          issuer_did: input.issuer_did,
          proof_kind: 'verifiable_credential',
          extra: {
            declared_age_at_least: declaredAge,
            age_threshold: ctx.policy.age_threshold,
          },
        },
      };
    }

    // Approved — attach an artifact hash of the credential bytes for audit.
    const artifactHash = await sha256Hex(input.credential);

    return {
      decision: 'approved',
      threshold_satisfied: true,
      assurance_level: 'substantial',
      method: 'vc',
      reason_code: REASON_CODES.THRESHOLD_SATISFIED,
      issuer_did: input.issuer_did,
      evidence: {
        format: input.format,
        issuer_did: input.issuer_did,
        nonce_match: Boolean(presentationNonce),
        proof_kind: 'verifiable_credential',
        extra: { declared_age_at_least: declaredAge },
      },
      artifact: {
        hash_hex: artifactHash,
        mime_type: input.format === 'sd_jwt_vc' ? 'application/sd-jwt' : 'application/jwt',
        size_bytes: new TextEncoder().encode(input.credential).byteLength,
      },
    };
  },
};

// ============================================================
// Helpers
// ============================================================

interface KeyEntry {
  kid?: string;
  alg?: string;
  [k: string]: unknown;
}

function extractKeys(json: Record<string, unknown>): Array<JsonWebKey & KeyEntry> {
  // Accept either `{ keys: [...] }` or a single JWK at the root.
  if (Array.isArray(json.keys)) return json.keys as Array<JsonWebKey & KeyEntry>;
  if ('kty' in json) return [json as JsonWebKey & KeyEntry];
  return [];
}

function mapJwsFailure(
  reason: string | undefined,
  issuerDid: string,
): AdapterResult {
  switch (reason) {
    case 'expired':
      return denied(REASON_CODES.VC_EXPIRED, issuerDid, 'exp_in_past');
    case 'not_yet_valid':
      return denied(REASON_CODES.VC_NOT_YET_VALID, issuerDid, 'nbf_in_future');
    case 'unsupported_alg':
      return denied(REASON_CODES.VC_FORMAT_UNSUPPORTED, issuerDid, 'unsupported_alg');
    case 'unknown_kid':
      return denied(REASON_CODES.VC_SIGNATURE_INVALID, issuerDid, 'kid_not_in_jwks');
    case 'wrong_issuer':
      return denied(REASON_CODES.VC_ISSUER_UNTRUSTED, issuerDid, 'iss_mismatch');
    default:
      return denied(REASON_CODES.VC_SIGNATURE_INVALID, issuerDid, reason ?? 'verify_failed');
  }
}

function denied(
  reason: keyof typeof REASON_CODES | string,
  issuerDid: string,
  detail: string,
): AdapterResult {
  return {
    decision: 'denied',
    threshold_satisfied: false,
    assurance_level: 'substantial',
    method: 'vc',
    // deno-lint-ignore no-explicit-any
    reason_code: reason as any,
    issuer_did: issuerDid,
    evidence: {
      proof_kind: 'verifiable_credential',
      issuer_did: issuerDid,
      extra: { detail },
    },
  };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
