import { describe, it, expect } from 'vitest';
import {
  ContractOnlyGatewayProvider,
  GatewayProviderNotConfiguredError,
  GatewayProviderRegistry,
  GatewayProviderUnknownError,
  assertNoGatewayPii,
  buildGatewayProviderRegistry,
  gatewayProviderDisplayName,
  type GatewayProviderRuntimeConfig,
  type GatewayStartInput,
} from './gateway-providers.ts';

const STARTED: GatewayStartInput = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  applicationId: '22222222-2222-2222-2222-222222222222',
  sessionId: '33333333-3333-3333-3333-333333333333',
  policySlug: 'br-18-plus',
  ageThreshold: 18,
  nonce: 'n-abc',
  callbackUrl: 'https://app/cb',
};

function cfg(over: Partial<GatewayProviderRuntimeConfig> = {}): GatewayProviderRuntimeConfig {
  return {
    id: 'yoti',
    enabled: false,
    ...over,
  };
}

describe('gatewayProviderDisplayName', () => {
  it('maps known provider ids', () => {
    expect(gatewayProviderDisplayName('yoti')).toBe('Yoti');
    expect(gatewayProviderDisplayName('veriff')).toBe('Veriff');
    expect(gatewayProviderDisplayName('onfido')).toBe('Onfido');
    expect(gatewayProviderDisplayName('serpro')).toBe('Serpro');
    expect(gatewayProviderDisplayName('idwall')).toBe('iDwall');
  });

  it('falls back to the raw id for unknown providers', () => {
    expect(gatewayProviderDisplayName('acme-id-corp')).toBe('acme-id-corp');
  });
});

describe('ContractOnlyGatewayProvider', () => {
  it('throws GatewayProviderNotConfiguredError on start when disabled', async () => {
    const p = new ContractOnlyGatewayProvider(cfg({ enabled: false }));
    await expect(p.start(STARTED)).rejects.toBeInstanceOf(
      GatewayProviderNotConfiguredError,
    );
  });

  it('throws GatewayProviderNotConfiguredError on start when enabled but missing credentials', async () => {
    const p = new ContractOnlyGatewayProvider(cfg({ enabled: true }));
    await expect(p.start(STARTED)).rejects.toBeInstanceOf(
      GatewayProviderNotConfiguredError,
    );
  });

  it('throws GatewayProviderNotConfiguredError on verifyCallback', async () => {
    const p = new ContractOnlyGatewayProvider(
      cfg({ enabled: true, apiBaseUrl: 'https://api', apiKey: 'k' }),
    );
    await expect(
      p.verifyCallback({ provider: 'yoti', headers: {}, rawBody: '{}' }),
    ).rejects.toBeInstanceOf(GatewayProviderNotConfiguredError);
  });

  it('throws GatewayProviderNotConfiguredError on normalizeDecision (non-PII payload)', async () => {
    const p = new ContractOnlyGatewayProvider(cfg());
    await expect(
      p.normalizeDecision({ approved: true, age_at_least: 18 }),
    ).rejects.toBeInstanceOf(GatewayProviderNotConfiguredError);
  });

  it('refuses to normalize a payload with PII even before throwing not-configured', async () => {
    const p = new ContractOnlyGatewayProvider(cfg());
    await expect(
      p.normalizeDecision({ birthdate: '2000-01-01', cpf: '...' }),
    ).rejects.toThrow(/forbidden/i);
  });

  it('exposes the configured display name', () => {
    expect(new ContractOnlyGatewayProvider(cfg({ id: 'yoti' })).displayName).toBe('Yoti');
    expect(new ContractOnlyGatewayProvider(cfg({ id: 'veriff' })).displayName).toBe('Veriff');
  });
});

describe('GatewayProviderRegistry', () => {
  it('throws GatewayProviderUnknownError when looking up an unregistered id', () => {
    const registry = new GatewayProviderRegistry();
    expect(() => registry.get('yoti')).toThrow(GatewayProviderUnknownError);
  });

  it('lists registered providers in insertion order', () => {
    const registry = buildGatewayProviderRegistry([
      cfg({ id: 'yoti' }),
      cfg({ id: 'veriff' }),
      cfg({ id: 'onfido' }),
    ]);
    expect(registry.list().map((p) => p.id)).toEqual(['yoti', 'veriff', 'onfido']);
  });

  it('every default-registered provider is a safe stub (NEVER approves)', async () => {
    const registry = buildGatewayProviderRegistry([
      cfg({ id: 'yoti' }),
      cfg({ id: 'veriff' }),
      cfg({ id: 'onfido' }),
      cfg({ id: 'serpro' }),
      cfg({ id: 'idwall' }),
    ]);
    for (const p of registry.list()) {
      await expect(p.start(STARTED)).rejects.toBeInstanceOf(
        GatewayProviderNotConfiguredError,
      );
    }
  });
});

describe('assertNoGatewayPii', () => {
  it('passes for clean payload', () => {
    expect(() =>
      assertNoGatewayPii({
        approved: true,
        provider_session_id: 'abc',
        age_at_least: 18,
      }),
    ).not.toThrow();
  });

  it('blocks any of the documented PII keys', () => {
    for (const key of [
      'birthdate',
      'date_of_birth',
      'dob',
      'cpf',
      'rg',
      'passport',
      'document',
      'selfie',
      'face_image',
      'full_name',
      'address',
    ]) {
      expect(() => assertNoGatewayPii({ [key]: 'x' })).toThrow(
        new RegExp(`forbidden key: ${key}`, 'i'),
      );
    }
  });
});
