// Proof verifier honesto que sempre nega.
//
// Usado quando `AGEKEY_ZKP_BBS_ENABLED=false` (default). NUNCA aprova.

import type {
  ProofPresentation,
  ProofVerificationResult,
  ProofVerifier,
} from './types.ts';

export const disabledProofVerifier: ProofVerifier = {
  async verify(
    _presentation: ProofPresentation,
  ): Promise<ProofVerificationResult> {
    return { valid: false, reason: 'feature_disabled' };
  },
};
