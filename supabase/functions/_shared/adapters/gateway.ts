// Gateway adapter — generic JWS attestation verification.
//
// Each gateway provider (Yoti, Veriff, Onfido, Serpro ID, Unico Check, etc.)
// is registered as an `issuers` row with `metadata_json.adapter_variant =
// 'gateway'` and `metadata_json.provider = '<id>'`. The provider's JWKS
// lives in `issuers.public_keys_json` (refreshed by trust-registry-refresh).
//
// The provider runs its own SDK on the client device, performs the
// verification (document scan / liveness / database lookup), and returns
// an attestation token (JWS) that the client posts to
// /verifications-session-complete with method='gateway'.
//
// We verify the JWS signature against the provider JWKS, check claims:
//   - iss matches a known provider issuer_did
//   - exp/nbf within tolerance
//   - nonce binds to session
//   - attestation contains `age_at_least` (or equivalent provider claim)
//
// Provider-specific quirks (claim names, signature suites) are handled by
// `normalizeProviderClaims()` based on `metadata_json.provider`.

import type {
  AdapterCompleteInput,
  AdapterResult,
  AdapterSessionPayload,
  SessionContext,
  VerificationAdapter,
} from '../../../../packages/adapter-contracts/src/index.ts';
import { AdapterDenied } from '../../../../packages/adapter-contracts/src/index.ts';
import { REASON_CODES } from '../../../../packages/shared/src/reason-codes.ts';
import { verifyJws } from '../../../../packages/shared/src/jws-generic.ts';
import { db } from '../db.ts';

interface GatewayMetadata {
  adapter_variant?: string; // 'gateway'
  provider?: string;
  // Optional: alternate claim names per provider; defaults to age_at_least.
  age_claim_name?: string;
  // Optional: the assurance level returned for an approved attestation
  // depends on the provider's KYC depth. Default 'substantial'.
  assurance_level?: 'low' | 'substantial' | 'high';
  // Optional: alternative nonce claim name (some providers use 'cnonce').
  nonce_claim_name?: string;
}

interface ProviderRow {
  id: string;
  issuer_did: string;
  trust_status: 'trusted' | 'suspended' | 'untrusted';
  public_keys_json: Record<string, unknown>;
  metadata_json: GatewayMetadata;
}

export const gatewayAdapter: VerificationAdapter = {
  method: 'gateway',

  async prepareSession(ctx: SessionContext): Promise<AdapterSessionPayload> {
    // Surface the registered providers for this tenant so the SDK can
    // pick an SDK-supported one. Both global and tenant-overridden are
    // visible through findGatewayProviders().
    const providers = await findGatewayProviders(ctx.tenantId);
    return {
      method: 'gateway',
      client_payload: {
        challenge_nonce: ctx.nonce,
        provider_options: providers.map((p) => ({
          provider: p.metadata_json.provider,
          issuer_did: p.issuer_did,
          assurance_level: p.metadata_json.assurance_level ?? 'substantial',
        })),
      },
    };
  },

  async completeSession(
    ctx: SessionContext,
    input: AdapterCompleteInput,
  ): Promise<AdapterResult> {
    if (input.method !== 'gateway') {
      throw new AdapterDenied(REASON_CODES.INVALID_REQUEST, 'method mismatch');
    }

    const provider = await findGatewayProviderByName(ctx.tenantId, input.provider);
    if (!provider) {
      return denied(
        REASON_CODES.GATEWAY_CONFIG_MISSING,
        input.provider,
        'provider_not_registered_or_untrusted',
      );
    }

    const jwksKeys = extractKeys(provider.public_keys_json);
    if (jwksKeys.length === 0) {
      return denied(
        REASON_CODES.GATEWAY_CONFIG_MISSING,
        input.provider,
        'no_provider_keys',
      );
    }

    const verify = await verifyJws(input.attestation, {
      jwksKeys,
      expectedIssuer: provider.issuer_did,
    });
    if (!verify.valid) {
      return mapJwsFailure(verify.reason, input.provider);
    }

    const payload = verify.parsed?.payload as Record<string, unknown> | undefined;
    if (!payload) {
      return denied(
        REASON_CODES.GATEWAY_ATTESTATION_INVALID,
        input.provider,
        'empty_payload',
      );
    }

    // Nonce binding (anti-replay)
    const nonceClaim = provider.metadata_json.nonce_claim_name ?? 'nonce';
    const presentedNonce = payload[nonceClaim];
    if (presentedNonce !== ctx.nonce) {
      return denied(
        REASON_CODES.GATEWAY_ATTESTATION_INVALID,
        input.provider,
        'nonce_mismatch',
      );
    }

    // Age claim — defaults to `age_at_least`. Provider may override.
    const ageClaimName = provider.metadata_json.age_claim_name ?? 'age_at_least';
    const ageRaw = payload[ageClaimName];
    const declaredAge = typeof ageRaw === 'number' ? ageRaw : Number(ageRaw);
    if (!Number.isFinite(declaredAge)) {
      return denied(
        REASON_CODES.GATEWAY_ATTESTATION_INVALID,
        input.provider,
        `missing_${ageClaimName}`,
      );
    }

    if (declaredAge < ctx.policy.age_threshold) {
      return {
        decision: 'denied',
        threshold_satisfied: false,
        assurance_level: provider.metadata_json.assurance_level ?? 'substantial',
        method: 'gateway',
        reason_code: REASON_CODES.POLICY_ASSURANCE_UNMET,
        issuer_did: provider.issuer_did,
        evidence: {
          proof_kind: 'gateway_attestation',
          issuer_did: provider.issuer_did,
          extra: {
            provider: input.provider,
            declared_age_at_least: declaredAge,
            age_threshold: ctx.policy.age_threshold,
          },
        },
      };
    }

    const artifactHash = await sha256Hex(input.attestation);

    return {
      decision: 'approved',
      threshold_satisfied: true,
      assurance_level: provider.metadata_json.assurance_level ?? 'substantial',
      method: 'gateway',
      reason_code: REASON_CODES.THRESHOLD_SATISFIED,
      issuer_did: provider.issuer_did,
      evidence: {
        proof_kind: 'gateway_attestation',
        issuer_did: provider.issuer_did,
        nonce_match: true,
        extra: {
          provider: input.provider,
          declared_age_at_least: declaredAge,
        },
      },
      artifact: {
        hash_hex: artifactHash,
        mime_type: 'application/jwt',
        size_bytes: new TextEncoder().encode(input.attestation).byteLength,
      },
    };
  },
};

// ============================================================
// Helpers
// ============================================================

async function findGatewayProviders(tenantId: string): Promise<ProviderRow[]> {
  const { data, error } = await db()
    .from('issuers')
    .select(
      'id, issuer_did, trust_status, public_keys_json, metadata_json, tenant_id',
    )
    .eq('trust_status', 'trusted')
    .is('deleted_at', null)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  if (error) throw error;
  const rows = (data ?? []) as Array<
    ProviderRow & { tenant_id: string | null }
  >;
  return rows.filter(
    (r) =>
      r.metadata_json?.adapter_variant === 'gateway' &&
      typeof r.metadata_json?.provider === 'string',
  );
}

async function findGatewayProviderByName(
  tenantId: string,
  providerName: string,
): Promise<ProviderRow | null> {
  const all = await findGatewayProviders(tenantId);
  return all.find((p) => p.metadata_json.provider === providerName) ?? null;
}

interface KeyEntry {
  kid?: string;
  alg?: string;
  [k: string]: unknown;
}

function extractKeys(json: Record<string, unknown>): Array<JsonWebKey & KeyEntry> {
  if (Array.isArray(json.keys)) return json.keys as Array<JsonWebKey & KeyEntry>;
  if ('kty' in json) return [json as JsonWebKey & KeyEntry];
  return [];
}

function mapJwsFailure(
  reason: string | undefined,
  provider: string,
): AdapterResult {
  if (reason === 'expired' || reason === 'not_yet_valid') {
    return denied(
      REASON_CODES.GATEWAY_PROVIDER_ERROR,
      provider,
      `attestation_${reason}`,
    );
  }
  if (reason === 'wrong_issuer' || reason === 'unknown_kid') {
    return denied(REASON_CODES.GATEWAY_CONFIG_MISSING, provider, reason);
  }
  return denied(
    REASON_CODES.GATEWAY_ATTESTATION_INVALID,
    provider,
    reason ?? 'verify_failed',
  );
}

function denied(
  reason: keyof typeof REASON_CODES | string,
  provider: string,
  detail: string,
): AdapterResult {
  return {
    decision: 'denied',
    threshold_satisfied: false,
    assurance_level: 'substantial',
    method: 'gateway',
    // deno-lint-ignore no-explicit-any
    reason_code: reason as any,
    evidence: {
      proof_kind: 'gateway_attestation',
      extra: { provider, detail },
    },
  };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
