// ZKP adapter — stub implementation honoring the contract.
// TODO (Fase 2.b): integrate BBS+ verification (BLS12-381) via crypto-core.
// Until then this adapter accepts only the curve advertised by the policy
// and denies with a typed reason code.

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';

const SUPPORTED_PROOF_FORMATS = ['bls12381-bbs+', 'bls12381-bbs+-2024'];

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
        accepted_formats: SUPPORTED_PROOF_FORMATS,
        // Digital Credentials API params
        dcapi: {
          protocol: 'openid4vp',
          client_id: 'agekey-verifier',
        },
      },
    };
  },

  async completeSession(
    _ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult> {
    if (input.method !== 'zkp') {
      throw new AdapterDenied(REASON_CODES.INVALID_REQUEST, 'method mismatch');
    }

    if (!SUPPORTED_PROOF_FORMATS.includes(input.proof_format)) {
      return denied(REASON_CODES.ZKP_CURVE_UNSUPPORTED);
    }

    // TODO: parse + verify proof against issuer JWKS, check predicate.
    // For now we deny so the verifier-core falls back to the next method.
    return denied(REASON_CODES.ZKP_PROOF_INVALID);
  },
};

function denied(reason: string): AdapterResult {
  return {
    decision: 'denied',
    threshold_satisfied: false,
    assurance_level: 'high',
    method: 'zkp',
    // deno-lint-ignore no-explicit-any
    reason_code: reason as any,
    evidence: { proof_kind: 'zkp_predicate', extra: { stub: true } },
  };
}
