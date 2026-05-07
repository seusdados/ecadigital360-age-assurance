// Per-tenant HMAC helper for the Parental Consent module.
//
// All opaque references that hit storage (subject_ref, guardian_ref, contact)
// pass through this helper. The HMAC key is loaded once from Supabase Vault
// per tenant and cached for the lifetime of the function instance. There is
// NO global key — losing the per-tenant key would not allow correlation
// across tenants.
//
// MVP fallback: if the tenant has not yet provisioned a vault key, the
// helper falls back to `app.consent_hmac_pepper` (a per-environment GUC) +
// the tenant_id as salt. This keeps the contracts truthful while the
// per-tenant rotation infrastructure ships.
//
// Reference: docs/modules/parental-consent/security.md §HMAC

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ENCODER = new TextEncoder();

const KEY_CACHE: Map<string, CryptoKey> = new Map();

async function loadTenantHmacKeyFromVault(
  client: SupabaseClient,
  tenantId: string,
): Promise<Uint8Array | null> {
  const { data, error } = await client.rpc('consent_hmac_key_load', {
    p_tenant_id: tenantId,
  });
  if (error) {
    // RPC may not exist yet in older environments; fall back below.
    if (/function .* does not exist/i.test(error.message)) return null;
    throw error;
  }
  if (data == null) return null;
  if (typeof data !== 'string') return null;
  return hexToBytes(data);
}

async function loadFallbackKey(): Promise<Uint8Array> {
  const pepper = Deno.env.get('AGEKEY_CONSENT_HMAC_PEPPER');
  if (!pepper) {
    throw new Error(
      'AGEKEY_CONSENT_HMAC_PEPPER is required when no per-tenant key exists',
    );
  }
  return ENCODER.encode(pepper);
}

async function deriveKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('odd-length hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function getTenantKey(
  client: SupabaseClient,
  tenantId: string,
): Promise<CryptoKey> {
  const cached = KEY_CACHE.get(tenantId);
  if (cached) return cached;
  const fromVault = await loadTenantHmacKeyFromVault(client, tenantId);
  let raw: Uint8Array;
  if (fromVault != null) {
    raw = fromVault;
  } else {
    const pepper = await loadFallbackKey();
    // Bind the fallback key to the tenant so the HMAC differs per tenant
    // even on the shared pepper.
    raw = await sha256Bytes(
      new Uint8Array([...pepper, ...ENCODER.encode(`|${tenantId}`)]),
    );
  }
  const key = await deriveKey(raw);
  KEY_CACHE.set(tenantId, key);
  return key;
}

async function sha256Bytes(input: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', input);
  return new Uint8Array(buf);
}

/**
 * HMAC-SHA256(key=tenant key, msg=`<purpose>:${value}`). Returns lowercase
 * hex. The `purpose` parameter is mandatory so a single tenant key cannot
 * be used to swap subject_ref and guardian_ref hashes.
 */
export async function consentHmacHex(
  client: SupabaseClient,
  tenantId: string,
  purpose: 'subject_ref' | 'guardian_ref' | 'contact' | 'actor_ref',
  value: string,
): Promise<string> {
  const key = await getTenantKey(client, tenantId);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    ENCODER.encode(`${purpose}:${value}`),
  );
  return bytesToHex(new Uint8Array(sig));
}

/** Hex SHA-256 of an arbitrary string. Public, not key-dependent. */
export async function sha256HexConsent(value: string): Promise<string> {
  return bytesToHex(await sha256Bytes(ENCODER.encode(value)));
}
