-- Migration: 002_policies
-- Tabelas: jurisdictions, policies, policy_versions

-- ============================================================
-- JURISDICTIONS — dicionário ISO 3166-1/2 + blocos (EU, etc.)
-- ============================================================
CREATE TABLE jurisdictions (
  code              text  NOT NULL,    -- ex.: "BR", "BR-SP", "DE", "EU"
  parent_code       text  REFERENCES jurisdictions (code) ON DELETE SET NULL,
  name_pt           text  NOT NULL,
  name_en           text  NOT NULL,
  is_bloc           boolean NOT NULL DEFAULT false,   -- true para EU, MERCOSUL, etc.
  legal_reference_url text,

  CONSTRAINT jurisdictions_pkey  PRIMARY KEY (code)
);

COMMENT ON TABLE  jurisdictions          IS 'Dicionário de jurisdições (países, estados, blocos). Populado via seed.';
COMMENT ON COLUMN jurisdictions.is_bloc  IS 'true quando representa um bloco geopolítico (ex.: EU) e não um país/estado.';

CREATE INDEX idx_jurisdictions_parent ON jurisdictions (parent_code) WHERE parent_code IS NOT NULL;

-- ============================================================
-- POLICIES — regras de elegibilidade etária por tenant
-- ============================================================
CREATE TABLE policies (
  id                      uuid    NOT NULL DEFAULT uuid_generate_v7(),
  -- NULL quando is_template = true (templates globais geridos pelo time AgeKey).
  tenant_id               uuid    REFERENCES tenants (id) ON DELETE CASCADE,
  name                    text    NOT NULL,
  slug                    text    NOT NULL,
  description             text,

  -- Threshold principal (ex.: 18 para "18+")
  age_threshold           integer NOT NULL CHECK (age_threshold > 0 AND age_threshold <= 120),

  -- Opcional: faixa etária (age_band_min <= age <= age_band_max)
  age_band_min            integer CHECK (age_band_min > 0),
  age_band_max            integer CHECK (age_band_max > 0),

  jurisdiction_code       text    REFERENCES jurisdictions (code) ON DELETE RESTRICT,

  -- Array ordenado de métodos preferidos. Ex.: ["zkp","vc","gateway","fallback"]
  method_priority_json    jsonb   NOT NULL DEFAULT '["zkp","vc","gateway","fallback"]',

  -- Nível de assurance mínimo aceito
  required_assurance_level assurance_level NOT NULL DEFAULT 'substantial',

  -- TTL do JWT de resultado em segundos
  token_ttl_seconds       integer NOT NULL DEFAULT 86400 CHECK (token_ttl_seconds > 0),

  -- Referência normativa para auditoria regulatória
  legal_reference_url     text,

  -- Versão corrente (aponta para policy_versions.version)
  current_version         integer NOT NULL DEFAULT 1,

  status                  text    NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'inactive', 'archived')),

  -- Template clonável pelo tenant (NULL = policy exclusiva do tenant)
  is_template             boolean NOT NULL DEFAULT false,
  cloned_from_id          uuid    REFERENCES policies (id) ON DELETE SET NULL,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,

  CONSTRAINT policies_pkey           PRIMARY KEY (id),
  CONSTRAINT policies_unique_slug    UNIQUE (tenant_id, slug),
  CONSTRAINT policies_band_order     CHECK (
    age_band_min IS NULL OR age_band_max IS NULL OR age_band_min <= age_band_max
  ),
  -- Exatamente: ou é template global (tenant_id NULL) ou pertence a um tenant
  CONSTRAINT policies_template_xor_tenant CHECK (
    (tenant_id IS NOT NULL AND is_template = false) OR
    (tenant_id IS NULL     AND is_template = true)
  )
);

COMMENT ON TABLE  policies                      IS 'Regras de elegibilidade etária configuráveis por tenant.';
COMMENT ON COLUMN policies.method_priority_json IS 'Array JSON com ordem de preferência dos adapters de verificação.';
COMMENT ON COLUMN policies.current_version      IS 'Versão corrente em policy_versions (incrementada a cada UPDATE).';
COMMENT ON COLUMN policies.is_template          IS 'Policies template são globais e clonáveis por qualquer tenant.';

CREATE INDEX idx_policies_tenant      ON policies (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_policies_jurisdiction ON policies (jurisdiction_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_policies_template    ON policies (is_template) WHERE is_template = true AND deleted_at IS NULL;
CREATE INDEX idx_policies_method      ON policies USING gin (method_priority_json);

-- Unique slug entre templates globais (NULLs em UNIQUE são distintos por padrão)
CREATE UNIQUE INDEX idx_policies_template_slug_unique
  ON policies (slug)
  WHERE is_template = true AND deleted_at IS NULL;

-- ============================================================
-- POLICY_VERSIONS — snapshot imutável de cada versão
-- Auditoria regulatória: qualquer mudança em uma policy gera
-- uma nova versão; as anteriores nunca são alteradas.
-- ============================================================
CREATE TABLE policy_versions (
  id           uuid    NOT NULL DEFAULT uuid_generate_v7(),
  policy_id    uuid    NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  version      integer NOT NULL,
  snapshot_json jsonb  NOT NULL,  -- cópia completa dos campos da policy no momento
  created_by   uuid    REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT policy_versions_pkey    PRIMARY KEY (id),
  CONSTRAINT policy_versions_unique  UNIQUE (policy_id, version)
);

COMMENT ON TABLE  policy_versions               IS 'Versões imutáveis de policies para auditoria regulatória.';
COMMENT ON COLUMN policy_versions.snapshot_json IS 'Cópia completa dos campos da policy no momento da versão.';
COMMENT ON COLUMN policy_versions.version       IS 'Inteiro incremental. Começa em 1.';

CREATE INDEX idx_policy_versions_policy ON policy_versions (policy_id, version DESC);
