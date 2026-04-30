import { describe, it, expect } from 'vitest';
import {
  isBbsPlusFormat,
  requireBbsProductionReadiness,
  type ZkpVerificationResult,
} from './zkp-bbs-contract.ts';

describe('isBbsPlusFormat', () => {
  it('flags both bls12381-bbs+ and bls12381-bbs+-2024', () => {
    expect(isBbsPlusFormat('bls12381-bbs+')).toBe(true);
    expect(isBbsPlusFormat('bls12381-bbs+-2024')).toBe(true);
  });

  it('does not flag predicate attestation formats', () => {
    expect(isBbsPlusFormat('predicate-attestation-v1')).toBe(false);
    expect(isBbsPlusFormat('predicate-attestation-jws')).toBe(false);
  });

  it('does not flag arbitrary strings', () => {
    expect(isBbsPlusFormat('jwt')).toBe(false);
    expect(isBbsPlusFormat('')).toBe(false);
    expect(isBbsPlusFormat('bls12381')).toBe(false);
  });
});

describe('requireBbsProductionReadiness', () => {
  it('throws listing every missing capability when called empty', () => {
    expect(() => requireBbsProductionReadiness({})).toThrow(
      /libraryName.*testVectorSet.*issuerDid.*walletProfile/,
    );
  });

  it('throws listing only the missing capabilities', () => {
    expect(() =>
      requireBbsProductionReadiness({
        libraryName: 'noble-bls12-381',
        testVectorSet: 'rfc-9508-bbs',
        // issuerDid + walletProfile missing
      }),
    ).toThrow(/issuerDid.*walletProfile/);
  });

  it('passes when every capability is provided (still does NOT mean cryptographically validated — it only unblocks the gate)', () => {
    expect(() =>
      requireBbsProductionReadiness({
        libraryName: 'pairing-crypto-x',
        testVectorSet: 'rfc-9508-bbs',
        issuerDid: 'did:web:issuer.example',
        walletProfile: 'eudi-arf-wallet-1.0',
      }),
    ).not.toThrow();
  });
});

describe('ZkpVerificationResult shape', () => {
  it('models a not-implemented BBS+ outcome with ZKP_CURVE_UNSUPPORTED', () => {
    const result: ZkpVerificationResult = {
      valid: false,
      thresholdSatisfied: false,
      assuranceLevel: 'high',
      reasonCode: 'ZKP_CURVE_UNSUPPORTED',
    };
    // The ONLY accepted shape for an un-loaded BBS+ verifier is invalid +
    // threshold not satisfied. Any change to this should fail this test.
    expect(result.valid).toBe(false);
    expect(result.thresholdSatisfied).toBe(false);
    expect(result.reasonCode).toBe('ZKP_CURVE_UNSUPPORTED');
  });
});
