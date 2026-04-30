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
