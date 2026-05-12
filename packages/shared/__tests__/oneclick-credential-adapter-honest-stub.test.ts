// Garante que o OneClick credential adapter contract-ready NUNCA emite
// nem aprova credencial. Espelha o teste `credential-honest-stub.test.ts`.

import { describe, expect, it } from 'vitest';
import { disabledOneclickCredentialAdapter } from '../src/oneclick/index.ts';

const SAMPLE_PRESENTATION = {
  format: 'sd_jwt_vc' as const,
  issuerDid: 'did:web:issuer.example.com',
  disclosures: [{ path: '$.age_over_18', value: true }],
  nonce: 'nonce-1',
};

const SAMPLE_PREDICATES = {
  required: [
    { path: '$.age_over_18', comparator: 'eq' as const, value: true },
  ],
};

describe('OneClick credential adapter — honest stub (no fake crypto)', () => {
  it('issue() nunca emite quando feature desabilitada', async () => {
    const result = await disabledOneclickCredentialAdapter.issue({
      agePredicate: 'OVER_18',
      expiresAt: '2027-12-31T23:59:59Z',
      subjectRef: 'subject_ref_opaque',
    });
    expect(result.issued).toBe(false);
    expect(result.reason).toBe('feature_disabled');
    expect(result.credentialRef).toBeUndefined();
  });

  it('verify() nunca aprova quando feature desabilitada', async () => {
    const result = await disabledOneclickCredentialAdapter.verify(
      SAMPLE_PRESENTATION,
      SAMPLE_PREDICATES,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('feature_disabled');
  });

  it('adapter desabilitado expõe contrato completo (sem TODOs)', () => {
    expect(typeof disabledOneclickCredentialAdapter.issue).toBe('function');
    expect(typeof disabledOneclickCredentialAdapter.verify).toBe('function');
  });
});
