// Trust registry helpers — issuer lookup with per-tenant overrides + revocation cache.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface TrustedIssuer {
  id: string;
  issuer_did: string;
  trust_status: 'trusted' | 'suspended' | 'untrusted';
  supports_formats: string[];
  public_keys_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
}

// Returns the issuer when trusted by global registry AND not distrusted by tenant
// override. Returns null when the issuer is unknown or untrusted/suspended.
export async function findTrustedIssuer(
  client: SupabaseClient,
  tenantId: string,
  issuerDid: string,
): Promise<TrustedIssuer | null> {
  const { data: issuer, error } = await client
    .from('issuers')
    .select(
      'id, issuer_did, trust_status, supports_formats, public_keys_json, metadata_json, tenant_id',
    )
    .eq('issuer_did', issuerDid)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!issuer) return null;
  if (issuer.tenant_id !== null && issuer.tenant_id !== tenantId) return null;
  if (issuer.trust_status !== 'trusted') return null;

  // Per-tenant override
  const { data: override } = await client
    .from('trust_lists')
    .select('trust_override')
    .eq('tenant_id', tenantId)
    .eq('issuer_id', issuer.id)
    .maybeSingle();

  if (override?.trust_override === 'distrust') return null;

  return {
    id: issuer.id,
    issuer_did: issuer.issuer_did,
    trust_status: issuer.trust_status,
    supports_formats: issuer.supports_formats ?? [],
    public_keys_json: (issuer.public_keys_json ?? {}) as Record<string, unknown>,
    metadata_json: (issuer.metadata_json ?? {}) as Record<string, unknown>,
  };
}

// True when a given credential id is in the issuer's revocation cache and
// the cache has not expired (hot cache). Caller should fall back to a live
// fetch via trust-registry-refresh when expires_cache_at < now().
export async function isCredentialRevoked(
  client: SupabaseClient,
  issuerId: string,
  credentialId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('issuer_revocations')
    .select('credential_id, expires_cache_at')
    .eq('issuer_id', issuerId)
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
