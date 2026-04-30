import type { AssuranceLevel } from '@agekey/shared';

export type ZkpProofFormat =
  | 'predicate-attestation-v1'
  | 'predicate-attestation-jws'
  | 'bls12381-bbs+'
  | 'bls12381-bbs+-2024';

export type ZkpPredicate =
  | {
      readonly type: 'age_at_least';
      readonly threshold: number;
    }
  | {
      readonly type: 'age_band';
      readonly min: number;
      readonly max: number;
    };

export interface ZkpVerificationInput {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly nonce: string;
  readonly issuerDid: string;
  readonly proofFormat: ZkpProofFormat | string;
  readonly proof: string;
  readonly expectedPredicate: ZkpPredicate;
}

export interface ZkpVerificationResult {
  readonly valid: boolean;
  readonly thresholdSatisfied: boolean;
  readonly assuranceLevel: AssuranceLevel;
  readonly proofHashHex?: string;
  readonly issuerDid?: string;
  readonly reasonCode?:
    | 'THRESHOLD_SATISFIED'
    | 'ZKP_PROOF_INVALID'
    | 'ZKP_NONCE_MISMATCH'
    | 'ZKP_PREDICATE_FAILED'
    | 'ZKP_CURVE_UNSUPPORTED'
    | 'VC_ISSUER_UNTRUSTED';
  readonly evidence?: Record<string, string | number | boolean>;
}

export interface ZkpVerifierAdapter {
  readonly id: string;
  readonly supportedFormats: readonly string[];
  verify(input: ZkpVerificationInput): Promise<ZkpVerificationResult>;
}

export function isBbsPlusFormat(format: string): boolean {
  return format === 'bls12381-bbs+' || format === 'bls12381-bbs+-2024';
}

export function requireBbsProductionReadiness(params: {
  readonly libraryName?: string;
  readonly testVectorSet?: string;
  readonly issuerDid?: string;
  readonly walletProfile?: string;
}): void {
  const missing = Object.entries(params)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `BBS+ verifier is not production-ready. Missing: ${missing.join(', ')}`,
    );
  }
}
