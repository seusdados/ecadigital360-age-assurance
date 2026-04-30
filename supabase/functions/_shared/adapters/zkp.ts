// ZKP adapter — predicate attestation verification.
//
// Architecture decision (Fase 2.d): the MVP accepts BBS+/BLS12-381 ZKPs
// only when the BBS+ verifier is plugged in via crypto-core (M9+). Until
// then, the adapter implements a functionally-equivalent "predicate
// attestation" path that any ZKP-capable issuer can produce:
//
//   The issuer publishes a JWS (ES256/ES384/EdDSA) whose payload contains
//   a `predicate` claim asserting the predicate result without revealing
//   the witness. This is the same shape EUDI Wallet ARF describes for
//   `age_over_18` attestations in the Reference Implementation profile.
//
// Verification:
//   1. Parse JWS
//   2. Issuer in trust registry (`issuers.trust_status = trusted`)
//   3. Signature verifies against `issuers.public_keys_json` (JWKS)
//   4. `predicate.type === 'age_at_least'`
//   5. `predicate.threshold >= policy.age_threshold`
//   6. `predicate.satisfied === true`
//   7. `nonce === ctx.nonce` (session binding)
//   8. exp/nbf within tolerance
//
// When a real BBS+ unlinkable ZKP is presented, the adapter recognizes
// the format via `proof_format === 'bls12381-bbs+'` and returns
// ZKP_CURVE_UNSUPPORTED until crypto-core ships.

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';
import { verifyJws } from '../../../../packages/shared/src/jws-generic.ts';
import { db } from '../db.ts';
import { findTrustedIssuer } from '../trust-registry.ts';

// Formats that would dispatch to crypto-core (NOT YET IMPLEMENTED).
const BBS_FORMATS = new Set(['bls12381-bbs+', 'bls12381-bbs+-2024']);
// Formats handled directly by this adapter (predicate attestation as JWS).
const ATTESTATION_FORMATS = new Set([
  'predicate-attestation-v1',
  'predicate-attestation-jws',
]);

interface PredicateAttestationPayload {
  iss?: string;
  jti?: string;
  exp?: number;
  nbf?: number;
  nonce?: string;
  predicate?: {
    type: 'age_at_least';
    threshold: number;
    satisfied: boolean;
  };
}

export const zkpAdapter: VerificationAdapter = {
  method: 'zkp',

  async prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload> {
    return {
      method: 'zkp',
      client_payload: {
        challenge_nonce: ctx.nonce,
        predicate: {
          type: 'age_at_least',
          threshold: ctx.policy.age_threshold,
        },
        accepted_formats: [
          'predicate-attestation-v1',
          'bls12381-bbs+',
          'bls12381-bbs+-2024',
        ],
        dcapi: { protocol: 'openid4vp', client_id: 'agekey-verifier' },
      },
    };
  },

  async completeSession(
    ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult> {
    if (input.method !== 'zkp') {
      throw new AdapterDenied(REASON_CODES.INVALID_REQUEST, 'method mismatch');
    }

    if (BBS_FORMATS.has(input.proof_format)) {
      return denied(
        REASON_CODES.ZKP_CURVE_UNSUPPORTED,
        input.issuer_did,
        'bbs+_verifier_not_loaded',
      );
    }

    if (!ATTESTATION_FORMATS.has(input.proof_format)) {
      return denied(
        REASON_CODES.ZKP_CURVE_UNSUPPORTED,
        input.issuer_did,
        `format=${input.proof_format}`,
      );
    }

    const issuer = await findTrustedIssuer(db(), ctx.tenantId, input.issuer_did);
    if (!issuer) {
      return denied(
        REASON_CODES.VC_ISSUER_UNTRUSTED,
        input.issuer_did,
        'issuer_unknown_or_untrusted',
      );
    }

    const jwksKeys = extractKeys(issuer.public_keys_json);
    if (jwksKeys.length === 0) {
      return denied(
        REASON_CODES.ZKP_PROOF_INVALID,
        input.issuer_did,
        'no_issuer_keys',
      );
    }

    const verify = await verifyJws(input.proof, {
      jwksKeys,
      expectedIssuer: input.issuer_did,
    });
    if (!verify.valid) {
      return denied(
        REASON_CODES.ZKP_PROOF_INVALID,
        input.issuer_did,
        verify.reason ?? 'verify_failed',
      );
    }

    const payload = (verify.parsed?.payload ?? {}) as PredicateAttestationPayload;

    if (payload.nonce !== ctx.nonce) {
      return denied(
        REASON_CODES.ZKP_NONCE_MISMATCH,
        input.issuer_did,
        'nonce_mismatch',
      );
    }

    const predicate = payload.predicate;
    if (
      !predicate ||
      predicate.type !== 'age_at_least' ||
      typeof predicate.threshold !== 'number' ||
      typeof predicate.satisfied !== 'boolean'
    ) {
      return denied(
        REASON_CODES.ZKP_PROOF_INVALID,
        input.issuer_did,
        'malformed_predicate_claim',
      );
    }

    if (predicate.threshold < ctx.policy.age_threshold) {
      return denied(
        REASON_CODES.ZKP_PREDICATE_FAILED,
        input.issuer_did,
        `predicate_threshold=${predicate.threshold} < policy=${ctx.policy.age_threshold}`,
      );
    }

    if (!predicate.satisfied) {
      return {
        decision: 'denied',
        threshold_satisfied: false,
        assurance_level: 'high',
        method: 'zkp',
        reason_code: REASON_CODES.ZKP_PREDICATE_FAILED,
        issuer_did: input.issuer_did,
        evidence: {
          format: input.proof_format,
          issuer_did: input.issuer_did,
          proof_kind: 'predicate_attestation',
          extra: { threshold: predicate.threshold, satisfied: false },
        },
      };
    }

    const artifactHash = await sha256Hex(input.proof);

    return {
      decision: 'approved',
      threshold_satisfied: true,
      assurance_level: 'high',
      method: 'zkp',
      reason_code: REASON_CODES.THRESHOLD_SATISFIED,
      issuer_did: input.issuer_did,
      evidence: {
        format: input.proof_format,
        issuer_did: input.issuer_did,
        nonce_match: true,
        proof_kind: 'predicate_attestation',
        extra: { threshold: predicate.threshold },
      },
      artifact: {
        hash_hex: artifactHash,
        mime_type: 'application/jwt',
        size_bytes: new TextEncoder().encode(input.proof).byteLength,
      },
    };
  },
};

interface KeyEntry {
  kid?: string;
  alg?: string;
  [k: string]: unknown;
}

function extractKeys(json: Record<string, unknown>): Array<JsonWebKey & KeyEntry> {
  if (Array.isArray(json.keys)) return json.keys as Array<JsonWebKey & KeyEntry>;
  if ('kty' in json) return [json as JsonWebKey & KeyEntry];
  return [];
}

function denied(
  reason: keyof typeof REASON_CODES | string,
  issuerDid: string,
  detail: string,
): AdapterResult {
  return {
    decision: 'denied',
    threshold_satisfied: false,
    assurance_level: 'high',
    method: 'zkp',
    // deno-lint-ignore no-explicit-any
    reason_code: reason as any,
    issuer_did: issuerDid,
    evidence: {
      proof_kind: 'predicate_attestation',
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
