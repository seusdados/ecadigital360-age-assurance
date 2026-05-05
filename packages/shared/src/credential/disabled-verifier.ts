// Verifier honesto que sempre nega.
//
// Usado quando `AGEKEY_SD_JWT_VC_ENABLED=false` (default). NUNCA aprova.

import type {
  CredentialPresentation,
  CredentialPredicates,
  CredentialVerificationResult,
  CredentialVerifier,
} from './types.ts';

export const disabledCredentialVerifier: CredentialVerifier = {
  async verify(
    _presentation: CredentialPresentation,
    _expected: CredentialPredicates,
  ): Promise<CredentialVerificationResult> {
    return { valid: false, reason: 'feature_disabled' };
  },
};
