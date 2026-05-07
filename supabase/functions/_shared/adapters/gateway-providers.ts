import type {
  GatewayCallbackInput,
  GatewayNormalizedDecision,
  GatewayProviderAdapter,
  GatewayProviderId,
  GatewayStartInput,
  GatewayStartResult,
} from '../../../../packages/adapter-contracts/src/gateway-providers.ts';
import {
  GatewayProviderNotConfiguredError,
  assertNoGatewayPii,
} from '../../../../packages/adapter-contracts/src/gateway-providers.ts';

export interface ProviderRuntimeConfig {
  readonly id: GatewayProviderId | string;
  readonly enabled: boolean;
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly webhookSecret?: string;
  readonly issuerDid?: string;
  readonly assuranceLevel?: 'low' | 'substantial' | 'high';
}

export abstract class BaseGatewayProvider implements GatewayProviderAdapter {
  abstract readonly id: GatewayProviderId | string;
  abstract readonly displayName: string;

  protected constructor(protected readonly config: ProviderRuntimeConfig) {}

  protected requireConfigured(): void {
    if (!this.config.enabled || !this.config.apiBaseUrl || !this.config.apiKey) {
      throw new GatewayProviderNotConfiguredError(String(this.id));
    }
  }

  abstract start(input: GatewayStartInput): Promise<GatewayStartResult>;

  abstract verifyCallback(
    input: GatewayCallbackInput,
  ): Promise<GatewayNormalizedDecision>;

  async normalizeDecision(raw: unknown): Promise<GatewayNormalizedDecision> {
    assertNoGatewayPii(raw);
    throw new GatewayProviderNotConfiguredError(
      String(this.id),
      'Provider-specific normalization is not implemented for this provider',
    );
  }
}

export class ContractOnlyGatewayProvider extends BaseGatewayProvider {
  readonly displayName: string;

  constructor(config: ProviderRuntimeConfig, displayName: string) {
    super(config);
    this.displayName = displayName;
  }

  get id(): GatewayProviderId | string {
    return this.config.id;
  }

  async start(_input: GatewayStartInput): Promise<GatewayStartResult> {
    this.requireConfigured();
    throw new GatewayProviderNotConfiguredError(
      String(this.id),
      'Start flow requires provider API mapping before production use',
    );
  }

  async verifyCallback(
    _input: GatewayCallbackInput,
  ): Promise<GatewayNormalizedDecision> {
    this.requireConfigured();
    throw new GatewayProviderNotConfiguredError(
      String(this.id),
      'Callback verification requires provider signature mapping before production use',
    );
  }
}

export function buildGatewayProviderRegistry(
  configs: ProviderRuntimeConfig[],
): Record<string, GatewayProviderAdapter> {
  const registry: Record<string, GatewayProviderAdapter> = {};

  for (const config of configs) {
    const displayName =
      config.id === 'yoti'
        ? 'Yoti'
        : config.id === 'veriff'
          ? 'Veriff'
          : config.id === 'onfido'
            ? 'Onfido'
            : config.id === 'serpro'
              ? 'Serpro'
              : config.id === 'idwall'
                ? 'iDwall'
                : String(config.id);

    registry[String(config.id)] = new ContractOnlyGatewayProvider(
      config,
      displayName,
    );
  }

  return registry;
}
