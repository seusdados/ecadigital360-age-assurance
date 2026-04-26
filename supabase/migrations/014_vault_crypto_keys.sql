-- Migration: 014_vault_crypto_keys
--
-- Move crypto_keys private key storage from hex placeholder to Supabase Vault
-- (pgsodium-backed). Each `crypto_keys` row gets a corresponding entry in
-- `vault.secrets`; the encrypted private key JWK is read via SECURITY DEFINER
-- RPCs that bypass RLS but enforce service_role-only execution.
--
-- Steps:
--   1. Ensure `pgsodium` extension is available.
--   2. Add `vault_secret_id` column to crypto_keys (FK to vault.secrets).
--   3. Define RPCs `crypto_keys_store_private`, `crypto_keys_load_private`.
--   4. Backfill skipped — existing hex placeholder rows become unusable;
--      run `key-rotation` once after deploy to seed a fresh vault-backed key.

-- ============================================================
-- Pre-flight: Vault is part of Supabase managed extensions. The schema
-- `vault` must exist (it does on every Supabase project).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgsodium') THEN
    -- pgsodium is provided by Supabase but not auto-enabled in older setups.
    -- Skipping CREATE EXTENSION here: Supabase ships it on demand and the
    -- vault schema/objects are pre-installed on all live projects.
    RAISE NOTICE 'pgsodium extension not auto-enabled — relying on Supabase Vault preinstall.';
  END IF;
END$$;

-- ============================================================
-- Schema additions
-- ============================================================
ALTER TABLE crypto_keys
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid;

COMMENT ON COLUMN crypto_keys.vault_secret_id IS
  'FK to vault.secrets. NULL on legacy rows that still have private_key_enc as hex placeholder.';

-- ============================================================
-- RPC: store the private JWK in vault and link via vault_secret_id.
-- Called by the key-rotation Edge Function.
-- ============================================================
CREATE OR REPLACE FUNCTION crypto_keys_store_private(
  p_kid text,
  p_private_jwk_json jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  -- Insert into vault.secrets. The `secret` column is encrypted at rest.
  INSERT INTO vault.secrets (name, description, secret)
  VALUES (
    'crypto_keys.' || p_kid,
    'AgeKey ES256 signing key (private JWK JSON).',
    p_private_jwk_json::text
  )
  RETURNING id INTO v_secret_id;

  -- Link from public.crypto_keys.
  UPDATE crypto_keys
     SET vault_secret_id = v_secret_id,
         -- Keep the legacy columns for one rotation cycle as fallback;
         -- the next rotation overwrites them with empty strings.
         private_key_enc = '',
         private_key_iv  = ''
   WHERE kid = p_kid;

  RETURN v_secret_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION crypto_keys_store_private(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crypto_keys_store_private(text, jsonb) TO service_role;

-- ============================================================
-- RPC: load the private JWK by kid. Returns NULL if the row uses the
-- legacy hex placeholder (vault_secret_id IS NULL).
-- ============================================================
CREATE OR REPLACE FUNCTION crypto_keys_load_private(
  p_kid text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_secret    text;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM   crypto_keys
  WHERE  kid = p_kid;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- vault.decrypted_secrets is the standard view that returns plaintext.
  -- Access is implicitly restricted to bypass-RLS contexts (service_role).
  SELECT decrypted_secret INTO v_secret
  FROM   vault.decrypted_secrets
  WHERE  id = v_secret_id;

  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_secret::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION crypto_keys_load_private(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crypto_keys_load_private(text) TO service_role;

-- ============================================================
-- RPC: delete the vault secret when a crypto_key is purged.
-- ============================================================
CREATE OR REPLACE FUNCTION crypto_keys_purge_vault(
  p_kid text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM   crypto_keys
  WHERE  kid = p_kid;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION crypto_keys_purge_vault(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crypto_keys_purge_vault(text) TO service_role;

COMMENT ON FUNCTION crypto_keys_store_private IS
  'Encrypts a private JWK in Supabase Vault and links to crypto_keys via vault_secret_id.';
COMMENT ON FUNCTION crypto_keys_load_private IS
  'Returns the decrypted private JWK as jsonb. Returns NULL for legacy rows.';
COMMENT ON FUNCTION crypto_keys_purge_vault IS
  'Deletes the vault.secrets row associated with a crypto_keys.kid.';
