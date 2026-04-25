// VC adapter — stub honoring the contract. Validates issuer trust + format
// in advance of a full SD-JWT/W3C VC verification (planned for Fase 2.b).

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';
import { db } from '../db.ts';
import { findTrustedIssuer } from '../trust-registry.ts';

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

    // TODO: parse credential header → kid → match issuer.public_keys_json,
    // verify signature, check exp/nbf, selective disclosure for age_at_least.
    return denied(REASON_CODES.VC_SIGNATURE_INVALID, input.issuer_did, 'stub_pending');
  },
};

function denied(reason: string, issuerDid: string, detail: string): AdapterResult {
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
      extra: { stub: true, detail },
    },
  };
}
