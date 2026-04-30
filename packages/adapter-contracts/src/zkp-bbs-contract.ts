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

/**
 * Production-readiness gate for BBS+ verifiers. Every capability listed
 * here MUST be provided before any BBS+ proof is allowed to short-circuit
 * to `decision=approved`. Missing any one of these = throw, no exceptions.
 *
 * The check is exhaustive against the documented checklist
 * (docs/architecture/open-source-foundation.md), not just against keys
 * the caller happened to pass.
 */
export const BBS_PRODUCTION_REQUIREMENTS = [
  'libraryName',
  'testVectorSet',
  'issuerDid',
  'walletProfile',
] as const;

export type BbsProductionReadinessParams = {
  readonly [K in (typeof BBS_PRODUCTION_REQUIREMENTS)[number]]?: string;
};

export function requireBbsProductionReadiness(
  params: BbsProductionReadinessParams,
): void {
  const missing: string[] = [];
  for (const key of BBS_PRODUCTION_REQUIREMENTS) {
    if (!params[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `BBS+ verifier is not production-ready. Missing: ${missing.join(', ')}`,
    );
  }
}
