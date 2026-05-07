-- Migration: 020_parental_consent_core
--
-- AgeKey Consent (Rodada 3) — núcleo do módulo de consentimento parental.
-- Tabelas: parental_consent_requests, consent_text_versions,
--          parental_consents, parental_consent_tokens,
--          parental_consent_revocations.
--
-- Princípios:
--   - Não há cadastro civil de criança ou responsável.
--   - Criança é referenciada por `child_ref_hmac` (opaco, gerado pelo tenant).
--   - Texto exibido ao responsável é versionado e referenciado por hash.
--   - parental_consents é APPEND-ONLY (trigger em 022_rls).
--   - Token reusa `crypto_keys` ES256 do Core (mesma JWKS).
--   - Guardian contacts e OTP ficam em 021_parental_consent_guardian.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE parental_consent_status AS ENUM (
    'pending',
    'awaiting_guardian',
    'awaiting_verification',
    'awaiting_confirmation',
    'approved',
    'denied',
    'expired',
    'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parental_consent_assurance_level AS ENUM (
    'AAL-C0', 'AAL-C1', 'AAL-C2', 'AAL-C3', 'AAL-C4'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- CONSENT_TEXT_VERSIONS
-- Texto exibido ao responsável. Imutável e versionado.
-- ============================================================
CREATE TABLE consent_text_versions (
  id              uuid          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id       uuid          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  policy_id       uuid          NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  policy_version  integer       NOT NULL,
  locale          text          NOT NULL DEFAULT 'pt-BR',
  /**
   * Texto integral apresentado ao responsável. Pode conter HTML
   * estritamente neutro (parágrafos, listas, ênfase) — sem scripts,
   * sem links externos, sem placeholders dinâmicos com PII.
   */
  text_body       text          NOT NULL,
  /**
   * SHA-256 hex de `text_body`, usado para referência cruzada de
   * `parental_consents.consent_text_version_id` e do claim
   * `consent_text_version_id` no token.
   */
  text_hash       text          NOT NULL,
  is_active       boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT consent_text_versions_pkey  PRIMARY KEY (id),
  CONSTRAINT consent_text_versions_hash_uniq UNIQUE (tenant_id, policy_id, policy_version, locale, text_hash)
);

COMMENT ON TABLE  consent_text_versions     IS 'Texto de consentimento exibido ao responsável. Imutável; novas versões inserem nova linha.';
COMMENT ON COLUMN consent_text_versions.text_hash IS 'SHA-256 hex de text_body. Referenciado no token e na admin trail.';

CREATE INDEX idx_ctv_active
  ON consent_text_versions (tenant_id, policy_id, policy_version, locale)
  WHERE is_active = true;
CREATE INDEX idx_ctv_tenant ON consent_text_versions (tenant_id, created_at DESC);

-- ============================================================
-- PARENTAL_CONSENT_REQUESTS
-- Solicitação criada pelo Application. Não contém PII.
-- ============================================================
CREATE TABLE parental_consent_requests (
  id                       uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                       NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  policy_id                uuid                       NOT NULL REFERENCES policies (id) ON DELETE RESTRICT,
  policy_version_id        uuid                       NOT NULL REFERENCES policy_versions (id) ON DELETE RESTRICT,
  consent_text_version_id  uuid                       NOT NULL REFERENCES consent_text_versions (id) ON DELETE RESTRICT,

  resource                 text                       NOT NULL,
  /**
   * `purpose_codes`: rótulos controlados de finalidade
   * (ex.: ["account_creation", "data_collection"]).
   */
  purpose_codes            text[]                     NOT NULL,
  /**
   * `data_categories`: categorias de dado processadas
   * (ex.: ["nickname", "preferences"]).
   */
  data_categories          text[]                     NOT NULL,
  locale                   text                       NOT NULL DEFAULT 'pt-BR',

  /**
   * Referência opaca à criança/adolescente. NUNCA PII direta.
   * O tenant é responsável por gerar HMAC com sal próprio.
   */
  child_ref_hmac           text                       NOT NULL,

  status                   parental_consent_status    NOT NULL DEFAULT 'pending',

  /**
   * Token curto/escopado para acesso ao painel parental.
   * Hash SHA-256 do raw — raw é entregue 1x ao integrador.
   */
  guardian_panel_token_hash text                      NOT NULL,
  guardian_panel_token_expires_at timestamptz         NOT NULL,

  redirect_url             text,

  /**
   * Quando foi tomada a decisão final (approve/deny/revoke).
   */
  decided_at               timestamptz,
  reason_code              text,

  created_at               timestamptz                NOT NULL DEFAULT now(),
  updated_at               timestamptz                NOT NULL DEFAULT now(),
  expires_at               timestamptz                NOT NULL DEFAULT (now() + interval '24 hours'),

  CONSTRAINT parental_consent_requests_pkey  PRIMARY KEY (id),
  CONSTRAINT parental_consent_requests_panel_token_uniq UNIQUE (guardian_panel_token_hash)
);

COMMENT ON TABLE  parental_consent_requests                        IS 'Solicitação de consentimento parental criada pelo Application. Sem PII.';
COMMENT ON COLUMN parental_consent_requests.child_ref_hmac          IS 'Referência opaca da criança (HMAC). Bloqueado pelo Privacy Guard se for PII direta.';
COMMENT ON COLUMN parental_consent_requests.guardian_panel_token_hash IS 'SHA-256 do token entregue ao integrador. Raw nunca é persistido.';

CREATE INDEX idx_pcr_tenant_created   ON parental_consent_requests (tenant_id, created_at DESC);
CREATE INDEX idx_pcr_app_status       ON parental_consent_requests (application_id, status);
CREATE INDEX idx_pcr_expires          ON parental_consent_requests (expires_at) WHERE status NOT IN ('approved','denied','revoked','expired');
CREATE INDEX idx_pcr_child_ref        ON parental_consent_requests (tenant_id, child_ref_hmac);

-- ============================================================
-- PARENTAL_CONSENTS
-- Registro do consentimento aceito. APPEND-ONLY (trigger em 022).
-- ============================================================
CREATE TABLE parental_consents (
  id                       uuid                              NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                              NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                              NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  consent_request_id       uuid                              NOT NULL REFERENCES parental_consent_requests (id) ON DELETE RESTRICT,
  policy_id                uuid                              NOT NULL REFERENCES policies (id) ON DELETE RESTRICT,
  policy_version_id        uuid                              NOT NULL REFERENCES policy_versions (id) ON DELETE RESTRICT,
  consent_text_version_id  uuid                              NOT NULL REFERENCES consent_text_versions (id) ON DELETE RESTRICT,

  /**
   * `granted` quando aceito; `denied` quando recusado.
   * Revogações vão para `parental_consent_revocations`.
   */
  decision                 text                              NOT NULL CHECK (decision IN ('granted', 'denied')),
  reason_code              text                              NOT NULL,
  consent_assurance_level  parental_consent_assurance_level  NOT NULL DEFAULT 'AAL-C1',

  purpose_codes            text[]                            NOT NULL,
  data_categories          text[]                            NOT NULL,

  /**
   * Hash do canal usado para verificação (HMAC do contato cifrado).
   * Permite cross-check sem expor o contato.
   */
  guardian_contact_hmac    text                              NOT NULL,

  granted_at               timestamptz,
  expires_at               timestamptz,
  revoked_at               timestamptz,

  created_at               timestamptz                       NOT NULL DEFAULT now(),

  CONSTRAINT parental_consents_pkey  PRIMARY KEY (id),
  CONSTRAINT parental_consents_request_uniq UNIQUE (consent_request_id)
);

COMMENT ON TABLE  parental_consents                       IS 'Registro imutável do consentimento parental. Append-only.';
COMMENT ON COLUMN parental_consents.guardian_contact_hmac IS 'HMAC do contato verificado. Sem cleartext.';

CREATE INDEX idx_pc_tenant_created   ON parental_consents (tenant_id, created_at DESC);
CREATE INDEX idx_pc_app_decision     ON parental_consents (application_id, decision);
CREATE INDEX idx_pc_expires          ON parental_consents (expires_at) WHERE revoked_at IS NULL;

-- ============================================================
-- PARENTAL_CONSENT_TOKENS
-- Índice de JTIs emitidos. Mesma forma de `result_tokens`.
-- ============================================================
CREATE TABLE parental_consent_tokens (
  jti                  uuid         NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id            uuid         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id       uuid         NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  parental_consent_id  uuid         NOT NULL REFERENCES parental_consents (id) ON DELETE RESTRICT,

  -- Reusa kid das `crypto_keys` do Core (mesmo JWKS público).
  kid                  text         NOT NULL,

  issued_at            timestamptz  NOT NULL DEFAULT now(),
  expires_at           timestamptz  NOT NULL,
  revoked_at           timestamptz,
  revoked_reason       text,

  CONSTRAINT parental_consent_tokens_pkey  PRIMARY KEY (jti),
  CONSTRAINT parental_consent_tokens_consent_uniq UNIQUE (parental_consent_id)
);

COMMENT ON TABLE  parental_consent_tokens     IS 'JTIs dos parental_consent_tokens emitidos. Suporta revogação.';
COMMENT ON COLUMN parental_consent_tokens.kid IS 'Reusa crypto_keys.kid do Core — mesmo JWKS, mesma rotação.';

CREATE UNIQUE INDEX idx_pct_jti     ON parental_consent_tokens (jti);
CREATE INDEX        idx_pct_consent ON parental_consent_tokens (parental_consent_id);
CREATE INDEX        idx_pct_expires ON parental_consent_tokens (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX        idx_pct_tenant  ON parental_consent_tokens (tenant_id, issued_at DESC);

-- ============================================================
-- PARENTAL_CONSENT_REVOCATIONS
-- Append-only. Toda revogação gera linha aqui + UPDATE em
-- parental_consents.revoked_at + parental_consent_tokens.revoked_at.
-- ============================================================
CREATE TABLE parental_consent_revocations (
  id                   uuid         NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id            uuid         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  parental_consent_id  uuid         NOT NULL REFERENCES parental_consents (id) ON DELETE RESTRICT,
  jti                  uuid         NOT NULL,

  /**
   * Origem da revogação: `guardian` (responsável), `tenant_admin` (admin
   * do tenant), `system` (cron de retenção, expiração).
   */
  source               text         NOT NULL CHECK (source IN ('guardian','tenant_admin','system')),
  reason               text         NOT NULL,

  revoked_at           timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT parental_consent_revocations_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE parental_consent_revocations IS 'Trilha de revogações de parental_consent. Append-only.';

CREATE INDEX idx_pcrev_tenant ON parental_consent_revocations (tenant_id, revoked_at DESC);
CREATE INDEX idx_pcrev_consent ON parental_consent_revocations (parental_consent_id);
