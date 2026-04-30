import type { AssuranceLevel } from '@agekey/shared';

export type GatewayProviderId =
  | 'yoti'
  | 'veriff'
  | 'onfido'
  | 'serpro'
  | 'idwall'
  | 'custom';

export type GatewayDecisionCode =
  | 'approved'
  | 'denied'
  | 'insufficient_proof'
  | 'provider_unavailable'
  | 'provider_not_configured'
  | 'signature_invalid'
  | 'callback_invalid'
  | 'fraud_suspected';

export interface GatewayStartInput {
  readonly tenantId: string;
  readonly applicationId: string;
  readonly sessionId: string;
  readonly policySlug: string;
  readonly ageThreshold: number;
  readonly nonce: string;
  readonly callbackUrl: string;
  readonly redirectUrl?: string;
  readonly cancelUrl?: string;
  readonly locale?: string;
  readonly externalUserRefHash?: string;
}

export interface GatewayStartResult {
  readonly provider: GatewayProviderId | string;
  readonly providerSessionId: string;
  readonly redirectUrl: string;
  readonly expiresAt: string;
  readonly evidence?: Record<string, string | number | boolean>;
}

export interface GatewayCallbackInput {
  readonly provider: GatewayProviderId | string;
  readonly headers: Record<string, string>;
  readonly rawBody: string;
  readonly parsedBody?: unknown;
}

export interface GatewayNormalizedDecision {
  readonly provider: GatewayProviderId | string;
  readonly providerSessionId: string;
  readonly approved: boolean;
  readonly decisionCode: GatewayDecisionCode;
  readonly assuranceLevel: AssuranceLevel;
  readonly ageThresholdSatisfied: boolean;
  readonly artifactHashHex: string;
  readonly issuerDid?: string;
  readonly nonce?: string;
  readonly evidence: {
    readonly proof_kind: 'gateway_provider_decision';
    readonly provider: string;
    readonly provider_session_id: string;
    readonly nonce_match?: boolean;
    readonly extra?: Record<string, string | number | boolean>;
  };
}

export interface GatewayProviderAdapter {
  readonly id: GatewayProviderId | string;
  readonly displayName: string;
  start(input: GatewayStartInput): Promise<GatewayStartResult>;
  verifyCallback(input: GatewayCallbackInput): Promise<GatewayNormalizedDecision>;
  normalizeDecision(raw: unknown): Promise<GatewayNormalizedDecision>;
}

export class GatewayProviderNotConfiguredError extends Error {
  readonly provider: string;

  constructor(provider: string, message = 'Gateway provider is not configured') {
    super(message);
    this.name = 'GatewayProviderNotConfiguredError';
    this.provider = provider;
  }
}

export class GatewayProviderUnknownError extends Error {
  readonly provider: string;

  constructor(provider: string, message = 'Gateway provider is unknown') {
    super(message);
    this.name = 'GatewayProviderUnknownError';
    this.provider = provider;
  }
}

/**
 * Runtime configuration for a gateway provider entry.
 *
 * `enabled=false` plus missing apiKey/apiBaseUrl means the provider is
 * registered but cannot be invoked — `start()` and `verifyCallback()`
 * will throw {@link GatewayProviderNotConfiguredError}.
 */
export interface GatewayProviderRuntimeConfig {
  readonly id: GatewayProviderId | string;
  readonly enabled: boolean;
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly webhookSecret?: string;
  readonly issuerDid?: string;
  readonly assuranceLevel?: AssuranceLevel;
}

const PROVIDER_DISPLAY_NAMES: Record<GatewayProviderId, string> = {
  yoti: 'Yoti',
  veriff: 'Veriff',
  onfido: 'Onfido',
  serpro: 'Serpro',
  idwall: 'iDwall',
  custom: 'Custom Gateway Provider',
};

export function gatewayProviderDisplayName(id: GatewayProviderId | string): string {
  return (
    (PROVIDER_DISPLAY_NAMES as Record<string, string | undefined>)[id] ??
    String(id)
  );
}

/**
 * A safe stub that throws {@link GatewayProviderNotConfiguredError} on
 * every entrypoint. It NEVER approves, NEVER returns PII, and is the
 * default for providers added to the registry without real credentials,
 * SDK mappings or signed test vectors.
 */
export class ContractOnlyGatewayProvider implements GatewayProviderAdapter {
  readonly id: GatewayProviderId | string;
  readonly displayName: string;

  constructor(private readonly config: GatewayProviderRuntimeConfig) {
    this.id = config.id;
    this.displayName = gatewayProviderDisplayName(config.id);
  }

  protected requireConfigured(): void {
    if (!this.config.enabled || !this.config.apiBaseUrl || !this.config.apiKey) {
      throw new GatewayProviderNotConfiguredError(String(this.id));
    }
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

  async normalizeDecision(raw: unknown): Promise<GatewayNormalizedDecision> {
    assertNoGatewayPii(raw);
    throw new GatewayProviderNotConfiguredError(
      String(this.id),
      'Provider-specific normalization is not implemented for this provider',
    );
  }
}

export class GatewayProviderRegistry {
  private readonly providers = new Map<string, GatewayProviderAdapter>();

  register(adapter: GatewayProviderAdapter): void {
    this.providers.set(String(adapter.id), adapter);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  get(id: string): GatewayProviderAdapter {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new GatewayProviderUnknownError(id);
    }
    return provider;
  }

  list(): readonly GatewayProviderAdapter[] {
    return Array.from(this.providers.values());
  }
}

/**
 * Builds a registry pre-populated with safe stubs for every config entry.
 * No provider returns a real decision — each stub throws
 * {@link GatewayProviderNotConfiguredError} until a concrete adapter
 * is installed via `registry.register()`.
 */
export function buildGatewayProviderRegistry(
  configs: readonly GatewayProviderRuntimeConfig[],
): GatewayProviderRegistry {
  const registry = new GatewayProviderRegistry();
  for (const config of configs) {
    registry.register(new ContractOnlyGatewayProvider(config));
  }
  return registry;
}

export function assertNoGatewayPii(value: unknown): void {
  const text = JSON.stringify(value ?? {}).toLowerCase();
  const forbidden = [
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
  ];

  const hit = forbidden.find((key) => text.includes(key));
  if (hit) {
    throw new Error(`Gateway normalized payload contains forbidden key: ${hit}`);
  }
}
