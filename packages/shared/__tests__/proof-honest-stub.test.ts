import { describe, expect, it } from 'vitest';
import {
  ProofModeNotImplementedError,
  disabledProofVerifier,
  isSupportedScheme,
  selectProofVerifier,
} from '../src/proof/index.ts';

const SAMPLE_PRESENTATION = {
  scheme: 'bls12381-bbs+' as const,
  issuerDid: 'did:web:issuer.example.com',
  proof: 'aGVsbG8',
  nonce: 'nonce-1',
  predicates: [
    { path: '$.age', comparator: 'gte' as const, value: 18 },
  ],
};

describe('Proof mode — honest stub', () => {
  it('disabledProofVerifier sempre nega', async () => {
    const r = await disabledProofVerifier.verify(SAMPLE_PRESENTATION);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('feature_disabled');
  });

  it('selectProofVerifier retorna disabled quando flags off', () => {
    expect(selectProofVerifier({})).toBe(disabledProofVerifier);
    expect(
      selectProofVerifier({
        AGEKEY_PROOF_MODE_ENABLED: 'false',
        AGEKEY_ZKP_BBS_ENABLED: 'false',
      }),
    ).toBe(disabledProofVerifier);
  });

  it('selectProofVerifier LANÇA quando flag ON sem provider', () => {
    expect(() =>
      selectProofVerifier({ AGEKEY_ZKP_BBS_ENABLED: 'true' }),
    ).toThrow(ProofModeNotImplementedError);
    expect(() =>
      selectProofVerifier({ AGEKEY_PROOF_MODE_ENABLED: true }),
    ).toThrow(/Refusing to fabricate verification/);
  });

  it('ProofModeNotImplementedError tem mensagem orientadora', () => {
    const err = new ProofModeNotImplementedError();
    expect(err.message).toContain('AGEKEY_ZKP_BBS_ENABLED');
    expect(err.message).toContain('docs/specs/agekey-proof-mode.md');
    expect(err.message).toContain('library, test vectors');
  });
});

describe('Proof mode — schemes', () => {
  it('aceita schemes canônicos', () => {
    expect(isSupportedScheme('bls12381-bbs+')).toBe(true);
    expect(isSupportedScheme('bbs-2023')).toBe(true);
    expect(isSupportedScheme('bls12-381-g1')).toBe(true);
  });

  it('rejeita schemes não suportados', () => {
    expect(isSupportedScheme('rsa-pss-2017')).toBe(false);
    expect(isSupportedScheme('ecdsa-p256')).toBe(false);
    expect(isSupportedScheme('ed25519')).toBe(false);
  });
});
