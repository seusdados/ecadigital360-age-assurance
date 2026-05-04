-- Migration: 021_parental_consent_guardian
--
-- AgeKey Consent — contato do responsável + verificação OTP.
--
-- Princípios:
--   - Contato cifrado em Supabase Vault (mesma infra de 014_vault_crypto_keys).
--   - HMAC permite lookup sem cleartext.
--   - Cleartext nunca é persistido em coluna.
--   - OTP é armazenado como hash (SHA-256). Cleartext nunca persiste.
--   - Tabelas têm RLS habilitada em 022_parental_consent_rls.

-- ============================================================
-- GUARDIAN_CONTACTS
-- ============================================================
CREATE TABLE guardian_contacts (
  id                       uuid          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  consent_request_id       uuid          NOT NULL REFERENCES parental_consent_requests (id) ON DELETE CASCADE,

  /**
   * Canal: 'email' ou 'phone'. Usado pelo OTP delivery provider.
   */
  contact_channel          text          NOT NULL CHECK (contact_channel IN ('email','phone')),

  /**
   * `vault.secrets.id` que carrega o contato cifrado. Nunca cleartext.
   */
  vault_secret_id          uuid,

  /**
   * HMAC SHA-256(`tenant_salt || contact_normalizado`).
   * Permite lookup e correlação sem cleartext.
   */
  contact_hmac             text          NOT NULL,

  /**
   * Display mascarado (ex.: "r***@example.com"). Aceitável em
   * audit_internal/admin_minimized_view; nunca em payload público.
   */
  contact_masked           text          NOT NULL,

  /**
   * Quando o contato foi confirmado por OTP (consumed_at do verification).
   */
  verified_at              timestamptz,

  /**
   * Retenção: ativo enquanto o consentimento estiver ativo;
   * arquivado e cifrado por mais `consent_expired_audit_window` (365d default).
   */
  archived_at              timestamptz,
  archived_reason          text,

  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT guardian_contacts_pkey  PRIMARY KEY (id)
);

COMMENT ON TABLE  guardian_contacts                  IS 'Contato do responsável cifrado em Vault. Cleartext nunca persiste.';
COMMENT ON COLUMN guardian_contacts.contact_hmac     IS 'HMAC para lookup. Tenant-salted. Sem cleartext.';
COMMENT ON COLUMN guardian_contacts.contact_masked   IS 'Display mascarado. Único valor seguro para admin_minimized_view.';
COMMENT ON COLUMN guardian_contacts.vault_secret_id  IS 'FK para vault.secrets onde o contato cifrado vive.';

CREATE INDEX idx_gc_request           ON guardian_contacts (consent_request_id);
CREATE INDEX idx_gc_tenant_hmac       ON guardian_contacts (tenant_id, contact_hmac);
CREATE INDEX idx_gc_tenant_archive    ON guardian_contacts (tenant_id) WHERE archived_at IS NULL;

-- ============================================================
-- GUARDIAN_VERIFICATIONS
-- OTP. Apenas hash. Tentativas limitadas. TTL curto.
-- ============================================================
CREATE TABLE guardian_verifications (
  id                   uuid          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id            uuid          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  consent_request_id   uuid          NOT NULL REFERENCES parental_consent_requests (id) ON DELETE CASCADE,
  guardian_contact_id  uuid          NOT NULL REFERENCES guardian_contacts (id) ON DELETE CASCADE,

  /**
   * SHA-256 hex do OTP. Cleartext nunca persiste.
   */
  otp_hash             text          NOT NULL,
  attempts             integer       NOT NULL DEFAULT 0,
  max_attempts         integer       NOT NULL DEFAULT 5,

  expires_at           timestamptz   NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at          timestamptz,

  created_at           timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT guardian_verifications_pkey  PRIMARY KEY (id),
  CONSTRAINT guardian_verifications_request_uniq UNIQUE (consent_request_id)
);

COMMENT ON TABLE  guardian_verifications      IS 'OTP de verificação do responsável. Apenas hash. TTL 10 min.';
COMMENT ON COLUMN guardian_verifications.otp_hash IS 'SHA-256 hex do OTP. Cleartext descartado.';

CREATE INDEX idx_gv_active
  ON guardian_verifications (consent_request_id)
  WHERE consumed_at IS NULL;
CREATE INDEX idx_gv_expires
  ON guardian_verifications (expires_at)
  WHERE consumed_at IS NULL;

-- ============================================================
-- VAULT RPCs — armazenam e leem contato cifrado.
--
-- Acesso restrito a service_role (bypass de RLS). RPC retorna NULL se
-- o consent_request_id não pertencer ao tenant atual; service_role
-- ignora o filtro mas inserções via callers de admin obedecem ao
-- contexto. Idêntico ao padrão de 014_vault_crypto_keys.
-- ============================================================

CREATE OR REPLACE FUNCTION guardian_contacts_store(
  p_consent_request_id uuid,
  p_contact_value      text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_contact_id uuid;
BEGIN
  -- 1. Cifra o valor em vault.secrets.
  INSERT INTO vault.secrets (name, description, secret)
  VALUES (
    'parental_consent.' || p_consent_request_id::text,
    'AgeKey parental consent guardian contact (encrypted at rest).',
    p_contact_value
  )
  RETURNING id INTO v_secret_id;

  -- 2. Busca a guardian_contacts row e linka.
  UPDATE guardian_contacts
     SET vault_secret_id = v_secret_id,
         updated_at = now()
   WHERE consent_request_id = p_consent_request_id
   RETURNING id INTO v_contact_id;

  RETURN v_secret_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION guardian_contacts_store(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION guardian_contacts_store(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION guardian_contacts_load(
  p_guardian_contact_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
  v_secret    text;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM   guardian_contacts
  WHERE  id = p_guardian_contact_id;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM   vault.decrypted_secrets
  WHERE  id = v_secret_id;

  RETURN v_secret;
END;
$$;

REVOKE EXECUTE ON FUNCTION guardian_contacts_load(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION guardian_contacts_load(uuid) TO service_role;

CREATE OR REPLACE FUNCTION guardian_contacts_purge_vault(
  p_guardian_contact_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM   guardian_contacts
  WHERE  id = p_guardian_contact_id;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
    UPDATE guardian_contacts
       SET vault_secret_id = NULL,
           archived_at = now(),
           archived_reason = COALESCE(archived_reason, 'vault_purged')
     WHERE id = p_guardian_contact_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION guardian_contacts_purge_vault(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION guardian_contacts_purge_vault(uuid) TO service_role;

COMMENT ON FUNCTION guardian_contacts_store        IS 'Cifra contato do responsável em vault.secrets e linka guardian_contacts.';
COMMENT ON FUNCTION guardian_contacts_load         IS 'Retorna o contato cleartext (apenas para envio de OTP). service_role only.';
COMMENT ON FUNCTION guardian_contacts_purge_vault  IS 'Apaga vault.secrets e marca guardian_contacts como archived.';
