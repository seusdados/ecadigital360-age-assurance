-- Migration: 016_vault_create_secret
--
-- Bug 5 reproduzido pelo Marcel: ao chamar /key-rotation pela primeira vez
-- no Supabase managed (`tpdiccnmsnjtjwhardij`), o RPC crypto_keys_store_private
-- (definido em 014) falha com:
--
--   ERROR: permission denied for function _crypto_aead_det_noncegen
--
-- Causa: 014 usa `INSERT INTO vault.secrets (...)` direto. Esse INSERT
-- dispara um trigger que chama funções pgsodium de baixo nível
-- (`_crypto_aead_det_noncegen`) que não têm grant para roles aplicacionais
-- em projetos Supabase managed.
--
-- Fix: usar a API de alto nível `vault.create_secret(secret, name, description)`
-- que internamente já tem os grants corretos. Mesmo input/output do RPC,
-- só muda a forma de gravar.
--
-- A função de leitura (`crypto_keys_load_private`) continua usando
-- `vault.decrypted_secrets` que é uma view com SELECT garantido a service_role.

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
  -- vault.create_secret é a API canônica do Supabase Vault. Lida com
  -- encryption nos bastidores via pgsodium, mas sem exigir grants
  -- diretos nas funções pgsodium internas.
  v_secret_id := vault.create_secret(
    new_secret      => p_private_jwk_json::text,
    new_name        => 'crypto_keys.' || p_kid,
    new_description => 'AgeKey ES256 signing key (private JWK JSON).'
  );

  UPDATE crypto_keys
     SET vault_secret_id = v_secret_id,
         private_key_enc = '',
         private_key_iv  = ''
   WHERE kid = p_kid;

  RETURN v_secret_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION crypto_keys_store_private(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION crypto_keys_store_private(text, jsonb) TO service_role;

COMMENT ON FUNCTION crypto_keys_store_private IS
  'Grava o JWK privado no Supabase Vault via vault.create_secret() e linka
   crypto_keys.vault_secret_id. Substitui a versão de 014 que usava INSERT
   direto em vault.secrets (bloqueado por pgsodium grants em managed projects).';
