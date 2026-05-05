import { describe, expect, it } from 'vitest';
import {
  CredentialModeNotImplementedError,
  disabledCredentialVerifier,
  selectCredentialVerifier,
} from '../src/credential/index.ts';
import { isPayloadSafe } from '../src/privacy/index.ts';

const SAMPLE_PRESENTATION = {
  format: 'sd_jwt_vc' as const,
  issuerDid: 'did:web:issuer.example.com',
  disclosures: [{ path: '$.age_over_18', value: true }],
  nonce: 'nonce-123',
};

const SAMPLE_PREDICATES = {
  required: [
    { path: '$.age_over_18', comparator: 'eq' as const, value: true },
  ],
};

describe('Credential mode — honest stub', () => {
  it('disabledCredentialVerifier sempre nega com feature_disabled', async () => {
    const r = await disabledCredentialVerifier.verify(
      SAMPLE_PRESENTATION,
      SAMPLE_PREDICATES,
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('feature_disabled');
  });

  it('selectCredentialVerifier retorna disabled quando flags off', () => {
    const v = selectCredentialVerifier({});
    expect(v).toBe(disabledCredentialVerifier);
  });

  it('selectCredentialVerifier respeita string "false"', () => {
    const v = selectCredentialVerifier({
      AGEKEY_CREDENTIAL_MODE_ENABLED: 'false',
      AGEKEY_SD_JWT_VC_ENABLED: 'false',
    });
    expect(v).toBe(disabledCredentialVerifier);
  });

  it('selectCredentialVerifier LANÇA quando flag ON sem provider', () => {
    expect(() =>
      selectCredentialVerifier({ AGEKEY_SD_JWT_VC_ENABLED: 'true' }),
    ).toThrow(CredentialModeNotImplementedError);
    expect(() =>
      selectCredentialVerifier({ AGEKEY_CREDENTIAL_MODE_ENABLED: true }),
    ).toThrow(/Refusing to fabricate verification/);
  });

  it('CredentialModeNotImplementedError tem mensagem orientadora', () => {
    const err = new CredentialModeNotImplementedError();
    expect(err.message).toContain('AGEKEY_SD_JWT_VC_ENABLED');
    expect(err.message).toContain('docs/specs/agekey-credential-mode.md');
  });
});

describe('Credential mode — privacy guard', () => {
  it('disclosure com chave PII é rejeitada por privacy guard', () => {
    const malicious = {
      format: 'sd_jwt_vc',
      issuerDid: 'did:x',
      disclosures: [{ path: '$.name', value: 'João' }],
      birthdate: '2010-01-01',
      nonce: 'n',
    };
    expect(isPayloadSafe(malicious, 'public_api_response')).toBe(false);
  });

  it('presentation canônica passa pelo privacy guard', () => {
    expect(isPayloadSafe(SAMPLE_PRESENTATION, 'public_api_response')).toBe(true);
  });
});
