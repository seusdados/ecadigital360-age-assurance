// Crypto key access — load active signing key + retired keys for verification.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { InternalError } from './errors.ts';
import type { JwsSigningKey } from './tokens.ts';

export interface JwksRecord {
  kid: string;
  algorithm: string;
  status: 'rotating' | 'active' | 'retired';
  public_jwk_json: JsonWebKey;
  private_key_enc: string;
  private_key_iv: string;
}

// In Fase 2 the private key is stored cleartext-equivalent (hex of raw JWK
// JSON) keyed by an env-derived static key. A follow-up will move this to
// Supabase Vault (decrypt via pgsodium / vault.decrypted_secrets).
async function decryptPrivateJwk(
  encHex: string,
  ivHex: string,
): Promise<JsonWebKey> {
  // Decoder helper: encHex/ivHex pair store the raw JSON of the JWK as hex.
  // This is a placeholder — production must call a dedicated decrypt RPC.
  const bytes = new Uint8Array(encHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(encHex.slice(i * 2, i * 2 + 2), 16);
  }
  void ivHex; // unused in placeholder
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as JsonWebKey;
  } catch {
    throw new InternalError('crypto_keys: failed to decode private key');
  }
}

export async function loadActiveSigningKey(
  client: SupabaseClient,
): Promise<JwsSigningKey> {
  const { data, error } = await client
    .from('crypto_keys')
    .select('kid, algorithm, status, public_jwk_json, private_key_enc, private_key_iv')
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new InternalError('No active signing key found');

  const privateJwk = await decryptPrivateJwk(
    data.private_key_enc,
    data.private_key_iv,
  );
  return { kid: data.kid, privateJwk };
}

export async function loadJwksPublicKeys(
  client: SupabaseClient,
): Promise<Array<{ kid: string; publicJwk: JsonWebKey }>> {
  const { data, error } = await client
    .from('crypto_keys')
    .select('kid, status, public_jwk_json')
    .in('status', ['active', 'retired']);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    kid: r.kid,
    publicJwk: r.public_jwk_json as JsonWebKey,
  }));
}
