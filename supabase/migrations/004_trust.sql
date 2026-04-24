-- Migration: 004_trust
-- Tabelas: issuers, trust_lists, issuer_revocations, revocations, crypto_keys
-- Também adiciona FKs diferidas para proof_artifacts e verification_results.

-- ============================================================
-- ISSUERS — emissores confiáveis no trust registry global
-- ============================================================
CREATE TABLE issuers (
  id                uuid              NOT NULL DEFAULT uuid_generate_v7(),
  issuer_did        text              NOT NULL,   -- DID ou URL canônica
  name              text              NOT NULL,
  trust_status      issuer_trust_status NOT NULL DEFAULT 'trusted',

  -- JWKS do issuer (cache local; atualizado por trust-registry-refresh)
  public_keys_json  jsonb             NOT NULL DEFAULT '{}',

  -- Formatos suportados: ["w3c_vc", "sd_jwt_vc", "zkp_bls12381", "attestation"]
  supports_formats  text[]            NOT NULL DEFAULT '{}',

  -- Configuração do adapter (adapter_variant, endpoint, etc.)
  metadata_json     jsonb             NOT NULL DEFAULT '{}',

  jwks_uri          text,
  jwks_fetched_at   timestamptz,

  -- Issuer global (NULL) ou criado por tenant
  tenant_id         uuid              REFERENCES tenants (id) ON DELETE CASCADE,

  created_at        timestamptz       NOT NULL DEFAULT now(),
  updated_at        timestamptz       NOT NULL DEFAULT now(),
  deleted_at        timestamptz,

  CONSTRAINT issuers_pkey     PRIMARY KEY (id),
  CONSTRAINT issuers_did_uniq UNIQUE (issuer_did)
);

COMMENT ON TABLE  issuers              IS 'Emissores confiáveis. NULL tenant_id = lista global AgeKey; UUID = override de tenant.';
COMMENT ON COLUMN issuers.issuer_did   IS 'DID (did:web:, did:key:) ou URL do issuer. Único no sistema.';
COMMENT ON COLUMN issuers.metadata_json IS 'Configuração do adapter gateway: adapter_variant, endpoint, credentials, etc.';

CREATE INDEX idx_issuers_did      ON issuers (issuer_did);
CREATE INDEX idx_issuers_status   ON issuers (trust_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_issuers_tenant   ON issuers (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_issuers_metadata ON issuers USING gin (metadata_json);

-- ============================================================
-- TRUST_LISTS — overrides de confiança por tenant
-- ============================================================
CREATE TABLE trust_lists (
  id             uuid           NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id      uuid           NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  issuer_id      uuid           NOT NULL REFERENCES issuers (id) ON DELETE CASCADE,
  trust_override trust_override NOT NULL,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT trust_lists_pkey   PRIMARY KEY (id),
  CONSTRAINT trust_lists_unique UNIQUE (tenant_id, issuer_id)
);

COMMENT ON TABLE trust_lists IS 'Overrides de confiança por tenant em relação à lista global.';

CREATE INDEX idx_trust_lists_tenant ON trust_lists (tenant_id);
CREATE INDEX idx_trust_lists_issuer ON trust_lists (issuer_id);

-- ============================================================
-- ISSUER_REVOCATIONS — revogações publicadas por issuer
-- Cache com TTL; atualizado pelo trust-registry-refresh job.
-- ============================================================
CREATE TABLE issuer_revocations (
  id             uuid        NOT NULL DEFAULT uuid_generate_v7(),
  issuer_id      uuid        NOT NULL REFERENCES issuers (id) ON DELETE CASCADE,
  credential_id  text        NOT NULL,   -- ID da credencial revogada
  revoked_at     timestamptz NOT NULL,
  reason         text,
  expires_cache_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),

  CONSTRAINT issuer_revocations_pkey   PRIMARY KEY (id),
  CONSTRAINT issuer_revocations_unique UNIQUE (issuer_id, credential_id)
);

COMMENT ON TABLE  issuer_revocations                IS 'Cache local de revogações publicadas por cada issuer.';
COMMENT ON COLUMN issuer_revocations.expires_cache_at IS 'Quando o cache expira e precisa ser atualizado.';

CREATE INDEX idx_issuer_revocations_issuer     ON issuer_revocations (issuer_id);
CREATE INDEX idx_issuer_revocations_credential ON issuer_revocations (credential_id);
CREATE INDEX idx_issuer_revocations_cache_exp  ON issuer_revocations (expires_cache_at);

-- ============================================================
-- REVOCATIONS — revogações internas de result_tokens e artefatos
-- APPEND-ONLY.
-- ============================================================
CREATE TABLE revocations (
  id             uuid        NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id      uuid        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- Exatamente um dos dois deve estar preenchido
  jti            uuid        REFERENCES result_tokens (jti) ON DELETE CASCADE,
  artifact_hash  text,

  revoked_by     uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  reason         text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT revocations_pkey          PRIMARY KEY (id),
  CONSTRAINT revocations_target_check  CHECK (
    (jti IS NOT NULL)::int + (artifact_hash IS NOT NULL)::int = 1
  )
);

COMMENT ON TABLE  revocations IS 'Revogações internas de tokens (jti) ou artefatos. Append-only.';

CREATE INDEX idx_revocations_jti    ON revocations (jti) WHERE jti IS NOT NULL;
CREATE INDEX idx_revocations_hash   ON revocations (artifact_hash) WHERE artifact_hash IS NOT NULL;
CREATE INDEX idx_revocations_tenant ON revocations (tenant_id, created_at DESC);

-- ============================================================
-- CRYPTO_KEYS — chaves de assinatura AgeKey (JWKS rotacionado)
-- Geridas pelo Edge Function key-rotation (cron diário).
-- ============================================================
CREATE TABLE crypto_keys (
  id                  uuid             NOT NULL DEFAULT uuid_generate_v7(),
  kid                 text             NOT NULL,     -- Key ID no JWKS (ex.: "ak_20260424")
  algorithm           text             NOT NULL,     -- "ES256" ou "EdDSA"
  status              crypto_key_status NOT NULL DEFAULT 'rotating',

  -- JWK público (publicado em /.well-known/jwks.json)
  public_jwk_json     jsonb            NOT NULL,

  -- Chave privada cifrada com Supabase Vault (AES-256-GCM)
  -- Armazenada como hex do ciphertext; o IV está em private_key_iv
  private_key_enc     text             NOT NULL,
  private_key_iv      text             NOT NULL,

  activated_at        timestamptz,
  retired_at          timestamptz,
  created_at          timestamptz      NOT NULL DEFAULT now(),
  updated_at          timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT crypto_keys_pkey     PRIMARY KEY (id),
  CONSTRAINT crypto_keys_kid_uniq UNIQUE (kid)
);

COMMENT ON TABLE  crypto_keys               IS 'Chaves de assinatura ES256/EdDSA do AgeKey. Rotacionadas automaticamente.';
COMMENT ON COLUMN crypto_keys.kid           IS 'Key ID publicado no JWKS. Incluso no header do JWT como "kid".';
COMMENT ON COLUMN crypto_keys.private_key_enc IS 'Chave privada cifrada com Supabase Vault. Nunca exposta via API.';
COMMENT ON COLUMN crypto_keys.status        IS 'rotating: nova, ainda não ativa. active: chave atual. retired: aposentada mas JWKS mantém para validação.';

CREATE INDEX idx_crypto_keys_status ON crypto_keys (status);
CREATE INDEX idx_crypto_keys_kid    ON crypto_keys (kid);

-- ============================================================
-- FKs DIFERIDAS: proof_artifacts.issuer_id → issuers.id
-- e verification_results.issuer_id → issuers.id
-- (declaradas aqui porque issuers só existe nesta migration)
-- ============================================================
ALTER TABLE proof_artifacts
  ADD CONSTRAINT fk_proof_artifacts_issuer
    FOREIGN KEY (issuer_id) REFERENCES issuers (id) ON DELETE SET NULL;

ALTER TABLE verification_results
  ADD CONSTRAINT fk_vresults_issuer
    FOREIGN KEY (issuer_id) REFERENCES issuers (id) ON DELETE SET NULL;

-- FK kid → crypto_keys.kid (result_tokens)
ALTER TABLE result_tokens
  ADD CONSTRAINT fk_result_tokens_kid
    FOREIGN KEY (kid) REFERENCES crypto_keys (kid) ON UPDATE CASCADE ON DELETE RESTRICT;
