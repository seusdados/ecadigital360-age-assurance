// Selector do proof verifier.

import { disabledProofVerifier } from './disabled-verifier.ts';
import type { ProofEnv, ProofVerifier } from './types.ts';

function isFlagOn(value: string | boolean | undefined): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'on' || v === 'yes';
}

export class ProofModeNotImplementedError extends Error {
  constructor() {
    super(
      'AGEKEY_ZKP_BBS_ENABLED=true but no BBS+ library is bound. ' +
        'Refusing to fabricate verification. See docs/specs/agekey-proof-mode.md ' +
        'for the prerequisites checklist (library, test vectors, issuer, external crypto review) ' +
        'before enabling in production.',
    );
    this.name = 'ProofModeNotImplementedError';
  }
}

export function selectProofVerifier(env: ProofEnv): ProofVerifier {
  const proofMode = isFlagOn(env.AGEKEY_PROOF_MODE_ENABLED);
  const zkpBbs = isFlagOn(env.AGEKEY_ZKP_BBS_ENABLED);

  if (!proofMode && !zkpBbs) {
    return disabledProofVerifier;
  }

  throw new ProofModeNotImplementedError();
}

const SUPPORTED_SCHEMES = new Set<string>([
  'bls12381-bbs+',
  'bbs-2023',
  'bls12-381-g1',
]);

/**
 * Indica se um scheme é reconhecido pelo contrato canônico (mesmo que
 * não implementado em runtime). Útil para validação de input.
 */
export function isSupportedScheme(scheme: string): boolean {
  return SUPPORTED_SCHEMES.has(scheme);
}
