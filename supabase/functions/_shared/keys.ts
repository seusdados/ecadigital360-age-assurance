// Crypto key access — load active signing key + retired keys for verification.
//
// As of migration 014_vault_crypto_keys, the canonical storage for the
// private JWK is `vault.secrets` (pgsodium-encrypted), linked from
// `crypto_keys.vault_secret_id`. The legacy `private_key_enc` hex column
// is left in place for backwards compatibility but is no longer written.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { InternalError } from './errors.ts';
import type { JwsSigningKey } from './tokens.ts';
import {
  assertJwkIsPublic,
  pickPublicJwk,
} from '../../../packages/shared/src/jws.ts';

/**
 * Loads the currently active signing key. The private JWK is read from
 * Supabase Vault via the SECURITY DEFINER RPC `crypto_keys_load_private`.
 *
 * Throws InternalError when:
 *   - No active key exists (run /key-rotation to bootstrap),
 *   - The active key is a legacy row without vault_secret_id (rotate to fix).
 */
export async function loadActiveSigningKey(
  client: SupabaseClient,
): Promise<JwsSigningKey> {
  const { data, error } = await client
    .from('crypto_keys')
    .select('kid, algorithm, status, public_jwk_json, vault_secret_id')
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new InternalError('No active signing key found');

  if (!data.vault_secret_id) {
    throw new InternalError(
      `crypto_keys.kid=${data.kid} has no vault_secret_id (legacy row); rotate to migrate`,
    );
  }

  const { data: privateJwk, error: rpcErr } = await client.rpc(
    'crypto_keys_load_private',
    { p_kid: data.kid },
  );
  if (rpcErr) throw rpcErr;
  if (!privateJwk) {
    throw new InternalError(`crypto_keys: vault load returned null for ${data.kid}`);
  }

  return { kid: data.kid, privateJwk: privateJwk as JsonWebKey };
}

export async function loadJwksPublicKeys(
  client: SupabaseClient,
): Promise<Array<{ kid: string; publicJwk: JsonWebKey }>> {
  // We expose `active` (current signing key), `rotating` (next key, public
  // already published so clients can fetch ahead), and `retired` (recent
  // keys still inside the token TTL window). All three statuses must be
  // verifiable by external relying parties — but NEVER with private
  // material attached.
  const { data, error } = await client
    .from('crypto_keys')
    .select('kid, status, public_jwk_json')
    .in('status', ['active', 'rotating', 'retired']);

  if (error) throw error;
  return (data ?? []).map((r) => {
    // Defense-in-depth: even if `public_jwk_json` was accidentally written
    // with private members, `pickPublicJwk` strips everything outside the
    // public allowlist. `assertJwkIsPublic` then verifies the result is
    // clean before it is returned to the caller.
    const sanitized = pickPublicJwk(r.public_jwk_json);
    assertJwkIsPublic(sanitized);
    return { kid: r.kid as string, publicJwk: sanitized };
  });
}
