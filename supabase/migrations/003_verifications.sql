-- Migration: 003_verifications
-- Tabelas transacionais do núcleo de verificação:
-- verification_sessions, verification_challenges, proof_artifacts,
-- verification_results, result_tokens

-- ============================================================
-- VERIFICATION_SESSIONS
-- ============================================================
CREATE TABLE verification_sessions (
  id                       uuid            NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid            NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid            NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  policy_id                uuid            NOT NULL REFERENCES policies (id) ON DELETE RESTRICT,
  policy_version_id        uuid            NOT NULL REFERENCES policy_versions (id) ON DELETE RESTRICT,

  status                   session_status  NOT NULL DEFAULT 'pending',
  method                   verification_method,     -- preenchido quando um adapter é selecionado

  -- Referência opaca do usuário passada pelo cliente (nunca PII direta)
  external_user_ref        text,
  locale                   text            NOT NULL DEFAULT 'pt-BR',

  -- Capabilities do browser/app enviadas pelo SDK
  client_capabilities_json jsonb           NOT NULL DEFAULT '{}',

  -- URLs de retorno
  redirect_url             text,
  cancel_url               text,

  -- IP e user-agent da requisição de criação (para risk scoring)
  client_ip                inet,
  user_agent               text,

  created_at               timestamptz     NOT NULL DEFAULT now(),
  updated_at               timestamptz     NOT NULL DEFAULT now(),
  expires_at               timestamptz     NOT NULL DEFAULT (now() + interval '15 minutes'),
  completed_at             timestamptz,

  CONSTRAINT verification_sessions_pkey  PRIMARY KEY (id)
);

COMMENT ON TABLE  verification_sessions                    IS 'Sessão de verificação de elegibilidade etária. Criada pelo SDK cliente.';
COMMENT ON COLUMN verification_sessions.external_user_ref IS 'Ref opaca do usuário final passada pelo cliente. Nunca deve conter PII.';
COMMENT ON COLUMN verification_sessions.expires_at        IS 'Sessões expiradas são marcadas pelo retention job. TTL padrão: 15 min.';

CREATE INDEX idx_vsessions_tenant_created  ON verification_sessions (tenant_id, created_at DESC);
CREATE INDEX idx_vsessions_app_status      ON verification_sessions (application_id, status);
CREATE INDEX idx_vsessions_expires         ON verification_sessions (expires_at) WHERE status = 'pending';
CREATE INDEX idx_vsessions_policy          ON verification_sessions (policy_id);

-- ============================================================
-- VERIFICATION_CHALLENGES — nonce anti-replay por sessão
-- ============================================================
CREATE TABLE verification_challenges (
  id           uuid        NOT NULL DEFAULT uuid_generate_v7(),
  session_id   uuid        NOT NULL REFERENCES verification_sessions (id) ON DELETE CASCADE,
  nonce        text        NOT NULL,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  consumed_at  timestamptz,         -- preenchido quando o nonce é usado (uso único)

  CONSTRAINT verification_challenges_pkey         PRIMARY KEY (id),
  CONSTRAINT verification_challenges_session_uniq UNIQUE (session_id),
  CONSTRAINT verification_challenges_nonce_uniq   UNIQUE (nonce)
);

COMMENT ON TABLE  verification_challenges            IS 'Challenge/nonce por sessão. Uso único, vida de 5 minutos.';
COMMENT ON COLUMN verification_challenges.consumed_at IS 'Preenchido na primeira validação. Tentativas subsequentes são rejeitadas.';

CREATE INDEX idx_vchallenges_expires ON verification_challenges (expires_at) WHERE consumed_at IS NULL;

-- ============================================================
-- PROOF_ARTIFACTS — artefatos criptográficos por sessão
-- O blob fica no Supabase Storage; aqui fica apenas o hash + path.
-- ============================================================
CREATE TABLE proof_artifacts (
  id              uuid                NOT NULL DEFAULT uuid_generate_v7(),
  session_id      uuid                NOT NULL REFERENCES verification_sessions (id) ON DELETE CASCADE,
  tenant_id       uuid                NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  adapter_method  verification_method NOT NULL,

  -- SHA-256 do artefato em hex. Integridade verificável.
  artifact_hash   text                NOT NULL,

  -- Localização no Supabase Storage (bucket 'proof-artifacts')
  storage_bucket  text                NOT NULL DEFAULT 'proof-artifacts',
  storage_path    text,               -- NULL quando artefato é apenas o hash (fallback declaration)

  mime_type       text,
  size_bytes      bigint,

  -- Issuer associado (FK para issuers, preenchido nos adapters vc/gateway)
  issuer_id       uuid,               -- FK adicionada em 004_trust.sql via ALTER TABLE

  created_at      timestamptz         NOT NULL DEFAULT now(),

  CONSTRAINT proof_artifacts_pkey  PRIMARY KEY (id)
);

COMMENT ON TABLE  proof_artifacts              IS 'Hashes e referências de artefatos criptográficos (ZKP proofs, VCs, attestations).';
COMMENT ON COLUMN proof_artifacts.artifact_hash IS 'SHA-256 do bytes do artefato. Garante integridade sem armazenar conteúdo.';
COMMENT ON COLUMN proof_artifacts.storage_path IS 'Path no Storage: tenant_id/session_id/artifact_id. NULL para declarações fallback.';

CREATE INDEX idx_partifacts_session  ON proof_artifacts (session_id);
CREATE INDEX idx_partifacts_tenant   ON proof_artifacts (tenant_id, created_at DESC);

-- ============================================================
-- VERIFICATION_RESULTS — decisão final. APPEND-ONLY.
-- ============================================================
CREATE TABLE verification_results (
  id                   uuid                  NOT NULL DEFAULT uuid_generate_v7(),
  session_id           uuid                  NOT NULL REFERENCES verification_sessions (id) ON DELETE CASCADE,
  tenant_id            uuid                  NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  decision             verification_decision NOT NULL,
  threshold_satisfied  boolean               NOT NULL,
  assurance_level      assurance_level       NOT NULL,
  method               verification_method   NOT NULL,

  issuer_id            uuid,                           -- FK adicionada em 004_trust.sql

  -- JTI do token emitido (FK para result_tokens)
  signed_token_jti     uuid,

  -- Reason code legível por máquina (ex.: "VC_SIGNATURE_INVALID")
  reason_code          text                  NOT NULL,

  -- Metadados mínimos de evidência (sem PII)
  evidence_json        jsonb                 NOT NULL DEFAULT '{}',

  created_at           timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT verification_results_pkey         PRIMARY KEY (id),
  CONSTRAINT verification_results_session_uniq UNIQUE (session_id)
);

COMMENT ON TABLE  verification_results           IS 'Decisão final de cada sessão. Append-only — sem UPDATE/DELETE.';
COMMENT ON COLUMN verification_results.reason_code IS 'Reason code padronizado. Ver docs/data-model.md para catálogo completo.';
COMMENT ON COLUMN verification_results.evidence_json IS 'Metadados de evidência sem PII. Nunca incluir DOB, nome, documento.';

CREATE INDEX idx_vresults_tenant   ON verification_results (tenant_id, created_at DESC);
CREATE INDEX idx_vresults_decision ON verification_results (tenant_id, decision);

-- ============================================================
-- RESULT_TOKENS — índice de JTIs emitidos
-- Permite validação O(1) e revogação explícita.
-- ============================================================
CREATE TABLE result_tokens (
  jti              uuid         NOT NULL DEFAULT uuid_generate_v7(),
  session_id       uuid         NOT NULL REFERENCES verification_sessions (id) ON DELETE CASCADE,
  tenant_id        uuid         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id   uuid         NOT NULL REFERENCES applications (id) ON DELETE CASCADE,

  -- kid da chave usada para assinar (FK para crypto_keys, adicionada em 004_trust.sql)
  kid              text         NOT NULL,

  issued_at        timestamptz  NOT NULL DEFAULT now(),
  expires_at       timestamptz  NOT NULL,

  -- Revogação explícita
  revoked_at       timestamptz,
  revoked_reason   text,

  CONSTRAINT result_tokens_pkey  PRIMARY KEY (jti)
);

COMMENT ON TABLE  result_tokens          IS 'Índice de JTIs dos tokens de resultado emitidos. Suporta revogação.';
COMMENT ON COLUMN result_tokens.jti      IS 'JWT ID — valor único no claim jti do token assinado.';
COMMENT ON COLUMN result_tokens.kid      IS 'Key ID da chave usada na assinatura. Permite validar mesmo após rotação.';

CREATE UNIQUE INDEX idx_result_tokens_jti     ON result_tokens (jti);
CREATE INDEX       idx_result_tokens_session  ON result_tokens (session_id);
CREATE INDEX       idx_result_tokens_expires  ON result_tokens (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX       idx_result_tokens_tenant   ON result_tokens (tenant_id, issued_at DESC);
