// Gateway adapter — stub honoring the contract. Production wires up
// providers like Yoti, Veriff, Onfido, ClearSale, iDwall, Serpro ID.

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';

const SUPPORTED_PROVIDERS = ['mock_gateway'];

export const gatewayAdapter: VerificationAdapter = {
  method: 'gateway',

  async prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload> {
    return {
      method: 'gateway',
      client_payload: {
        challenge_nonce: ctx.nonce,
        provider_options: SUPPORTED_PROVIDERS,
        // The frontend will choose a provider, init the SDK, and POST back
        // the attestation to /verifications/session/:id/complete.
      },
    };
  },

  async completeSession(
    _ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult> {
    if (input.method !== 'gateway') {
      throw new AdapterDenied(REASON_CODES.INVALID_REQUEST, 'method mismatch');
    }

    if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
      return denied(REASON_CODES.GATEWAY_CONFIG_MISSING, input.provider, 'unknown_provider');
    }

    // TODO: dispatch to provider-specific verifier; verify attestation signature.
    return denied(REASON_CODES.GATEWAY_ATTESTATION_INVALID, input.provider, 'stub_pending');
  },
};

function denied(reason: string, provider: string, detail: string): AdapterResult {
  return {
    decision: 'denied',
    threshold_satisfied: false,
    assurance_level: 'substantial',
    method: 'gateway',
    // deno-lint-ignore no-explicit-any
    reason_code: reason as any,
    evidence: {
      proof_kind: 'gateway_attestation',
      extra: { stub: true, provider, detail },
    },
  };
}
