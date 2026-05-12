// Garante que o OneClick proof adapter contract-ready NUNCA aprova BBS+
// nem tenta produzir prova quando recebe uma curva BBS+. Comportamento
// espelha `supabase/functions/_shared/adapters/zkp.ts`.

import { describe, expect, it } from 'vitest';
import {
  ONECLICK_BBS_FORMATS,
  disabledOneclickProofAdapter,
  isBbsLikeScheme,
} from '../src/oneclick/index.ts';

describe('OneClick proof adapter — rejects BBS+ (no fake crypto)', () => {
  it.each([...ONECLICK_BBS_FORMATS])(
    'verify(%s) retorna curve_unsupported (não aprovado)',
    async (scheme) => {
      const result = await disabledOneclickProofAdapter.verify({
        scheme,
        issuerDid: 'did:web:issuer.example.com',
        proof: 'aGVsbG8',
        nonce: 'nonce-1',
        predicates: [
          { path: '$.age', comparator: 'gte' as const, value: 18 },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('curve_unsupported');
    },
  );

  it.each([...ONECLICK_BBS_FORMATS])(
    'prove(%s) nunca produz prova quando crypto-core não está plugado',
    async (scheme) => {
      const result = await disabledOneclickProofAdapter.prove({
        credentialRef: 'cred_ref_opaque',
        predicate: 'OVER_18',
        nonce: 'nonce-1',
        scheme,
      });
      expect(result.produced).toBe(false);
      expect(result.reason).toBe('curve_unsupported');
      expect(result.proofRef).toBeUndefined();
    },
  );

  it('schemes não-BBS+ caem para feature_disabled em vez de aprovar', async () => {
    const result = await disabledOneclickProofAdapter.verify({
      // scheme arbitrário não-BBS+ — adapter ainda assim DEVE negar.
      // (cast porque ProofScheme é union strict, mas o teste valida
      //  o comportamento defensivo do adapter contra schemes não reconhecidos)
      scheme: 'ecdsa-p256' as unknown as 'bls12381-bbs+',
      issuerDid: 'did:web:issuer.example.com',
      proof: 'aGVsbG8',
      nonce: 'nonce-1',
      predicates: [],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('feature_disabled');
  });

  it('isBbsLikeScheme reconhece todos os formatos BBS+ listados', () => {
    for (const scheme of ONECLICK_BBS_FORMATS) {
      expect(isBbsLikeScheme(scheme)).toBe(true);
    }
    expect(isBbsLikeScheme('predicate-attestation-v1')).toBe(false);
    expect(isBbsLikeScheme('ecdsa-p256')).toBe(false);
  });

  it('ONECLICK_BBS_FORMATS está congelado (imutável)', () => {
    expect(Object.isFrozen(ONECLICK_BBS_FORMATS)).toBe(true);
  });
});
