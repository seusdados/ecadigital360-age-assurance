-- Migration: 001_tenancy
-- Tabelas raiz da hierarquia multi-tenant:
-- tenants, tenant_users, applications

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE tenants (
  id              uuid        NOT NULL DEFAULT uuid_generate_v7(),
  name            text        NOT NULL,
  slug            text        NOT NULL,
  status          tenant_status NOT NULL DEFAULT 'pending_setup',

  -- White-label
  branding_json   jsonb       NOT NULL DEFAULT '{}',
  custom_domain   text,

  -- Retenção de dados (dias). Padrão 90 dias.
  retention_days  integer     NOT NULL DEFAULT 90
                              CHECK (retention_days BETWEEN 30 AND 365),

  -- Plano de billing (referência externa; detalhes em billing_subscriptions)
  plan            text        NOT NULL DEFAULT 'free',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT tenants_pkey            PRIMARY KEY (id),
  CONSTRAINT tenants_slug_unique     UNIQUE (slug),
  CONSTRAINT tenants_slug_format     CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$')
);

COMMENT ON TABLE  tenants                IS 'Raiz da hierarquia multi-tenant. Cada tenant é um cliente SaaS independente.';
COMMENT ON COLUMN tenants.slug           IS 'Identificador URL-safe único. Usado em subdomínios white-label.';
COMMENT ON COLUMN tenants.branding_json  IS 'Logo URL, cores, tipografia para white-label.';
COMMENT ON COLUMN tenants.retention_days IS 'Quantos dias manter artefatos, sessões e audit_events antes do expurgo.';

CREATE INDEX idx_tenants_slug        ON tenants (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_status      ON tenants (status) WHERE deleted_at IS NULL;

-- ============================================================
-- TENANT_USERS — liga auth.users a tenants com papéis
-- ============================================================
CREATE TABLE tenant_users (
  id           uuid              NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id    uuid              NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id      uuid              NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role         tenant_user_role  NOT NULL DEFAULT 'operator',
  invited_by   uuid              REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz       NOT NULL DEFAULT now(),
  updated_at   timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT tenant_users_pkey           PRIMARY KEY (id),
  CONSTRAINT tenant_users_unique_member  UNIQUE (tenant_id, user_id)
);

COMMENT ON TABLE  tenant_users         IS 'Associação usuário ↔ tenant com papel RBAC.';
COMMENT ON COLUMN tenant_users.role    IS 'owner > admin > operator > auditor > billing';

CREATE INDEX idx_tenant_users_tenant  ON tenant_users (tenant_id);
CREATE INDEX idx_tenant_users_user    ON tenant_users (user_id);

-- ============================================================
-- APPLICATIONS — uma tenant tem N aplicações
-- ============================================================
CREATE TABLE applications (
  id                  uuid               NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id           uuid               NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name                text               NOT NULL,
  slug                text               NOT NULL,
  description         text,
  status              application_status NOT NULL DEFAULT 'active',

  -- Chave de API armazenada como SHA-256(raw_api_key)
  -- O valor raw é exibido uma única vez na criação e nunca persiste.
  api_key_hash        text               NOT NULL,
  api_key_prefix      text               NOT NULL,  -- ex.: "ak_live_" + 8 chars para exibição

  -- URLs de integração
  callback_url        text,
  webhook_url         text,
  webhook_secret_hash text,                         -- SHA-256(raw_secret)

  -- Metadata
  allowed_origins     text[]             NOT NULL DEFAULT '{}',
  metadata_json       jsonb              NOT NULL DEFAULT '{}',

  created_at          timestamptz        NOT NULL DEFAULT now(),
  updated_at          timestamptz        NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT applications_pkey               PRIMARY KEY (id),
  CONSTRAINT applications_unique_slug        UNIQUE (tenant_id, slug),
  CONSTRAINT applications_api_key_hash_uniq  UNIQUE (api_key_hash)
);

COMMENT ON TABLE  applications                   IS 'Aplicações clientes de um tenant. Cada uma tem sua api_key.';
COMMENT ON COLUMN applications.api_key_hash      IS 'SHA-256 da api_key raw. Nunca armazenar a chave em texto.';
COMMENT ON COLUMN applications.api_key_prefix    IS 'Prefixo não-secreto exibido no painel para identificação visual.';
COMMENT ON COLUMN applications.allowed_origins   IS 'Lista de origens permitidas para o widget (CORS). Vazio = qualquer origem.';

CREATE INDEX idx_applications_tenant     ON applications (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_api_key    ON applications (api_key_hash);
CREATE INDEX idx_applications_status     ON applications (tenant_id, status) WHERE deleted_at IS NULL;
