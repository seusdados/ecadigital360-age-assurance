// Espelho dos enums Postgres (000_bootstrap.sql). Mantido em sincronia manualmente
// — qualquer alteração nos enums SQL precisa replicar aqui.

export type VerificationMethod = 'zkp' | 'vc' | 'gateway' | 'fallback';

export type SessionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled';

export type VerificationDecision = 'approved' | 'denied' | 'needs_review';

export type AssuranceLevel = 'low' | 'substantial' | 'high';

export type TokenStatus = 'active' | 'revoked' | 'expired';

export type IssuerTrustStatus = 'trusted' | 'suspended' | 'untrusted';

export type CryptoKeyStatus = 'rotating' | 'active' | 'retired';

export type WebhookDeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'dead_letter';

export type AuditActorType = 'user' | 'api_key' | 'system' | 'cron';

export type TenantUserRole =
  | 'owner'
  | 'admin'
  | 'operator'
  | 'auditor'
  | 'billing';

// Hierarquia de assurance: low < substantial < high
export const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  low: 1,
  substantial: 2,
  high: 3,
};

// Hierarquia de roles RBAC: owner > admin > operator > auditor > billing
export const ROLE_RANK: Record<TenantUserRole, number> = {
  owner: 5,
  admin: 4,
  operator: 3,
  auditor: 2,
  billing: 1,
};

export interface PolicySnapshot {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  age_threshold: number;
  age_band_min: number | null;
  age_band_max: number | null;
  jurisdiction_code: string | null;
  method_priority: VerificationMethod[];
  required_assurance_level: AssuranceLevel;
  token_ttl_seconds: number;
  current_version: number;
}

export interface ClientCapabilities {
  digital_credentials_api?: boolean;
  wallet_present?: boolean;
  webauthn?: boolean;
  user_agent?: string;
  platform?: 'web' | 'ios' | 'android';
}

export interface AdapterEvidence {
  // Sempre minimizado: nada de DOB, nome ou documento.
  readonly format?: string;
  readonly issuer_did?: string;
  readonly nonce_match?: boolean;
  readonly proof_kind?: string;
  readonly extra?: Record<string, string | number | boolean>;
}
