-- Migration: 031_fix_guardian_contacts_store
--
-- Bug reproduzido em HML (`wljedzqgprkpqhuazdzv`) durante consent-smoke
-- (trace_id operador: d2209ead-8086-43e7-a5d5-866373e76e83):
--
--   parental-consent-guardian-start →
--     client.rpc('guardian_contacts_store', ...) →
--       public.guardian_contacts_store (SECURITY DEFINER, owned by postgres) →
--         INSERT INTO vault.secrets (...) →
--           cifragem por coluna chama vault._crypto_aead_det_noncegen() →
--             permission denied for function _crypto_aead_det_noncegen
--
-- Causa raiz: a versão original (migration 021) faz INSERT direto em
-- vault.secrets. A tabela tem cifragem por coluna pgsodium que invoca
-- vault._crypto_aead_det_noncegen() — owned by supabase_admin com
-- proacl restrito a supabase_admin. Em projetos Supabase managed, a role
-- `postgres` (efetiva sob SECURITY DEFINER) não tem EXECUTE.
--
-- Fix: substituir INSERT direto por vault.create_secret(...). Essa é a
-- API canônica do Supabase Vault (SECURITY DEFINER owned by
-- supabase_admin) que lida com pgsodium internamente sem exigir grants
-- diretos em funções pgsodium internas.
--
-- Padrão idêntico ao já validado em 016_vault_create_secret.sql para
-- crypto_keys_store_private.
--
-- Escopo desta migration:
--   - CREATE OR REPLACE FUNCTION public.guardian_contacts_store(uuid, text).
--   - Mesma assinatura, retorno, security model e search_path da 021.
--   - REVOKE/GRANT externos restaurados explicitamente para idempotência.
--   - Nenhuma alteração em tabelas, RLS, dados, triggers, índices ou
--     outras funções.
--
-- Não autorizado nesta migration:
--   - Não conceder GRANT EXECUTE em vault._crypto_aead_det_noncegen()
--     ou qualquer função interna de vault/pgsodium.
--   - Não tocar em schema vault ou objetos owned by supabase_admin.

CREATE OR REPLACE FUNCTION public.guardian_contacts_store(
  p_consent_request_id uuid,
  p_contact_value      text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id  uuid;
  v_contact_id uuid;
BEGIN
  -- 1. Cifra o contato em Supabase Vault via API canônica.
  --    vault.create_secret é SECURITY DEFINER owned by supabase_admin,
  --    com grants pgsodium internos já configurados.
  v_secret_id := vault.create_secret(
    new_secret      => p_contact_value,
    new_name        => 'parental_consent.' || p_consent_request_id::text,
    new_description => 'AgeKey parental consent guardian contact (encrypted at rest).'
  );

  -- 2. Vincula o secret_id ao guardian_contacts row criado pela Edge
  --    Function antes da chamada deste RPC.
  UPDATE guardian_contacts
     SET vault_secret_id = v_secret_id,
         updated_at      = now()
   WHERE consent_request_id = p_consent_request_id
   RETURNING id INTO v_contact_id;

  RETURN v_secret_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guardian_contacts_store(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.guardian_contacts_store(uuid, text) TO service_role;

COMMENT ON FUNCTION public.guardian_contacts_store(uuid, text) IS
  'Stores guardian contact in Supabase Vault using vault.create_secret(), avoiding direct INSERT into vault.secrets and pgsodium internal permission errors. See 031_fix_guardian_contacts_store.';
