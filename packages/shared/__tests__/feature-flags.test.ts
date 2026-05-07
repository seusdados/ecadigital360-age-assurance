import { describe, expect, it } from 'vitest';
import { CANONICAL_REASON_CODES } from '../src/taxonomy/index.ts';

/**
 * Fase 12 — testes mínimos de honestidade dos modos avançados.
 *
 * Estes testes verificam que o catálogo canônico de reason codes
 * carrega os códigos honestos para indicar feature flags desligadas
 * em modos credential/ZKP.
 *
 * O contrato é: enquanto não houver biblioteca real, issuer real,
 * test vectors e revisão criptográfica externa, qualquer caminho
 * de credential/ZKP DEVE retornar um destes códigos — nunca uma
 * decisão `approved` simulada.
 */
describe('Feature flags honestas — credential/ZKP/gateway', () => {
  it('SD-JWT VC tem reason code de feature_disabled disponível', () => {
    expect(CANONICAL_REASON_CODES.CREDENTIAL_FEATURE_DISABLED).toBe(
      'CREDENTIAL_FEATURE_DISABLED',
    );
    expect(CANONICAL_REASON_CODES.CREDENTIAL_TEST_VECTORS_REQUIRED).toBe(
      'CREDENTIAL_TEST_VECTORS_REQUIRED',
    );
  });

  it('ZKP/BBS+ tem reason code de feature_disabled disponível', () => {
    expect(CANONICAL_REASON_CODES.ZKP_FEATURE_DISABLED).toBe(
      'ZKP_FEATURE_DISABLED',
    );
    expect(CANONICAL_REASON_CODES.ZKP_LIBRARY_NOT_AVAILABLE).toBe(
      'ZKP_LIBRARY_NOT_AVAILABLE',
    );
  });

  it('gateway sem configuração tem reason code explícito', () => {
    expect(CANONICAL_REASON_CODES.GATEWAY_PROVIDER_NOT_CONFIGURED).toBe(
      'GATEWAY_PROVIDER_NOT_CONFIGURED',
    );
    expect(CANONICAL_REASON_CODES.GATEWAY_PROVIDER_UNSUPPORTED).toBe(
      'GATEWAY_PROVIDER_UNSUPPORTED',
    );
  });
});
