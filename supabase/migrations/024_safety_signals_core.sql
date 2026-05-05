-- Migration: 024_safety_signals_core
--
-- AgeKey Safety Signals (Rodada 4) — núcleo metadata-only.
-- 9 tabelas: safety_subjects, safety_interactions, safety_events,
-- safety_rules, safety_alerts, safety_aggregates,
-- safety_evidence_artifacts, safety_model_runs, safety_webhook_deliveries.
--
-- Princípios:
--   - Metadata-only no MVP. Nenhuma coluna armazena conteúdo bruto.
--   - Sujeitos por referência opaca (subject_ref_hmac).
--   - Reusa crypto_keys, audit_events, webhook_deliveries do Core.
--   - Reusa parental_consent_requests do Consent quando policy exige.
--   - RLS habilitada em 025; webhook fan-out em 026; seed regras em 027.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE safety_severity AS ENUM ('info','low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_alert_status AS ENUM (
    'open', 'acknowledged', 'escalated', 'resolved', 'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_subject_age_state AS ENUM (
    'minor',
    'teen',
    'adult',
    'unknown',
    'eligible_under_policy',
    'not_eligible_under_policy',
    'blocked_under_policy'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_event_type AS ENUM (
    'message_sent',
    'message_received',
    'media_upload',
    'external_link_shared',
    'profile_view',
    'follow_request',
    'report_filed',
    'private_chat_started'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_rule_code AS ENUM (
    'UNKNOWN_TO_MINOR_PRIVATE_MESSAGE',
    'ADULT_MINOR_HIGH_FREQUENCY_24H',
    'MEDIA_UPLOAD_TO_MINOR',
    'EXTERNAL_LINK_TO_MINOR',
    'MULTIPLE_REPORTS_AGAINST_ACTOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SAFETY_SUBJECTS — referência opaca + estado etário derivado
-- ============================================================
CREATE TABLE safety_subjects (
  id                       uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                       NOT NULL REFERENCES applications (id) ON DELETE CASCADE,

  /**
   * HMAC opaco do sujeito (gerado pelo tenant). NUNCA PII direta.
   */
  subject_ref_hmac         text                       NOT NULL,
  age_state                safety_subject_age_state   NOT NULL DEFAULT 'unknown',
  /** AAL canônico se conhecido (AAL-0..AAL-4). Texto livre tolerado para evolução. */
  assurance_level          text,

  reports_count            integer                    NOT NULL DEFAULT 0,
  alerts_count             integer                    NOT NULL DEFAULT 0,

  last_seen_at             timestamptz                NOT NULL DEFAULT now(),
  created_at               timestamptz                NOT NULL DEFAULT now(),
  updated_at               timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT safety_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT safety_subjects_uniq_ref UNIQUE (tenant_id, application_id, subject_ref_hmac)
);

CREATE INDEX idx_safety_subjects_tenant ON safety_subjects (tenant_id, created_at DESC);
CREATE INDEX idx_safety_subjects_app    ON safety_subjects (application_id, age_state);

COMMENT ON TABLE  safety_subjects                  IS 'Referência opaca de sujeito. Sem PII.';
COMMENT ON COLUMN safety_subjects.subject_ref_hmac IS 'HMAC do tenant. Privacy guard rejeita se PII direta.';

-- ============================================================
-- SAFETY_INTERACTIONS — par actor/counterparty (sem conteúdo)
-- ============================================================
CREATE TABLE safety_interactions (
  id                       uuid                NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  actor_subject_id         uuid                NOT NULL REFERENCES safety_subjects (id) ON DELETE CASCADE,
  counterparty_subject_id  uuid                REFERENCES safety_subjects (id) ON DELETE CASCADE,

  /**
   * Tipo do par (derivado do age_state):
   *   - adult_to_minor, adult_to_adult, minor_to_minor, unknown_to_minor,
   *   - unknown_to_unknown, self_actor (sem counterparty), other.
   */
  relationship             text                NOT NULL,
  first_seen_at            timestamptz         NOT NULL DEFAULT now(),
  last_seen_at             timestamptz         NOT NULL DEFAULT now(),
  events_count             integer             NOT NULL DEFAULT 0,
  reports_count            integer             NOT NULL DEFAULT 0,

  CONSTRAINT safety_interactions_pkey  PRIMARY KEY (id),
  CONSTRAINT safety_interactions_uniq  UNIQUE (tenant_id, application_id, actor_subject_id, counterparty_subject_id)
);

CREATE INDEX idx_si_tenant_last       ON safety_interactions (tenant_id, last_seen_at DESC);
CREATE INDEX idx_si_actor             ON safety_interactions (actor_subject_id);
CREATE INDEX idx_si_counterparty      ON safety_interactions (counterparty_subject_id) WHERE counterparty_subject_id IS NOT NULL;

COMMENT ON TABLE  safety_interactions IS 'Par actor/counterparty. Metadata-only.';

-- ============================================================
-- SAFETY_EVENTS — evento ingerido (metadata-only)
-- ============================================================
CREATE TABLE safety_events (
  id                       uuid                NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  interaction_id           uuid                REFERENCES safety_interactions (id) ON DELETE CASCADE,

  event_type               safety_event_type   NOT NULL,
  /**
   * Metadata mínimo. Privacy guard `safety_event_v1` rejeita conteúdo
   * bruto (message, raw_text, image, video, audio).
   */
  metadata_jsonb           jsonb               NOT NULL DEFAULT '{}',
  content_hash             text,

  /**
   * Hash do payload completo do request (para correlação em audit).
   */
  payload_hash             text                NOT NULL,

  occurred_at              timestamptz         NOT NULL DEFAULT now(),
  created_at               timestamptz         NOT NULL DEFAULT now(),

  /**
   * Classe de retenção canônica. Default `event_90d`.
   */
  retention_class          text                NOT NULL DEFAULT 'event_90d',
  legal_hold               boolean             NOT NULL DEFAULT false,

  CONSTRAINT safety_events_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_se_tenant_created  ON safety_events (tenant_id, created_at DESC);
CREATE INDEX idx_se_interaction     ON safety_events (interaction_id);
CREATE INDEX idx_se_app_type        ON safety_events (application_id, event_type);
CREATE INDEX idx_se_legal_hold      ON safety_events (tenant_id) WHERE legal_hold = true;

COMMENT ON TABLE  safety_events                  IS 'Evento Safety v1. Metadata-only — conteúdo bruto proibido.';
COMMENT ON COLUMN safety_events.retention_class  IS 'Canônico: event_30d|event_90d|event_180d|legal_hold. Cleanup respeita legal_hold.';

-- ============================================================
-- SAFETY_RULES — configuração de regra por tenant
-- ============================================================
CREATE TABLE safety_rules (
  id                       uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                       REFERENCES tenants (id) ON DELETE CASCADE,
  /**
   * `tenant_id` NULL → regra global (default). Override per-tenant
   * cria nova linha com tenant_id setado.
   */
  rule_code                safety_rule_code           NOT NULL,
  enabled                  boolean                    NOT NULL DEFAULT true,
  severity                 safety_severity            NOT NULL,
  actions                  text[]                     NOT NULL,
  config_json              jsonb                      NOT NULL DEFAULT '{}',

  created_at               timestamptz                NOT NULL DEFAULT now(),
  updated_at               timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT safety_rules_pkey PRIMARY KEY (id),
  CONSTRAINT safety_rules_uniq UNIQUE (tenant_id, rule_code)
);

CREATE INDEX idx_sr_tenant ON safety_rules (tenant_id) WHERE enabled = true;
CREATE INDEX idx_sr_global ON safety_rules (rule_code) WHERE tenant_id IS NULL;

COMMENT ON TABLE  safety_rules           IS 'Configuração de regra por tenant. tenant_id NULL = default global.';
COMMENT ON COLUMN safety_rules.actions   IS 'Array de safety_action: log_only, request_step_up, soft_block, hard_block, etc.';

-- ============================================================
-- SAFETY_ALERTS — alerta gerado por regra
-- ============================================================
CREATE TABLE safety_alerts (
  id                            uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                     uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id                uuid                       NOT NULL REFERENCES applications (id) ON DELETE CASCADE,

  rule_id                       uuid                       REFERENCES safety_rules (id) ON DELETE SET NULL,
  rule_code                     safety_rule_code           NOT NULL,

  status                        safety_alert_status        NOT NULL DEFAULT 'open',
  severity                      safety_severity            NOT NULL,
  risk_category                 text                       NOT NULL,
  reason_codes                  text[]                     NOT NULL,
  actions_taken                 text[]                     NOT NULL DEFAULT '{}',

  actor_subject_id              uuid                       NOT NULL REFERENCES safety_subjects (id) ON DELETE CASCADE,
  counterparty_subject_id       uuid                       REFERENCES safety_subjects (id) ON DELETE SET NULL,

  /**
   * FK para verification_session do Core quando step-up é exigido.
   */
  step_up_session_id            uuid,
  /**
   * FK para parental_consent_request do Consent quando consent check é exigido.
   */
  parental_consent_request_id   uuid,

  /**
   * IDs dos eventos correlacionados.
   */
  triggering_event_ids          uuid[]                     NOT NULL DEFAULT '{}',

  created_at                    timestamptz                NOT NULL DEFAULT now(),
  resolved_at                   timestamptz,
  resolved_note                 text,

  retention_class               text                       NOT NULL DEFAULT 'alert_12m',
  legal_hold                    boolean                    NOT NULL DEFAULT false,

  CONSTRAINT safety_alerts_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_sa_tenant_status   ON safety_alerts (tenant_id, status, created_at DESC);
CREATE INDEX idx_sa_severity        ON safety_alerts (tenant_id, severity);
CREATE INDEX idx_sa_actor           ON safety_alerts (actor_subject_id);
CREATE INDEX idx_sa_legal_hold      ON safety_alerts (tenant_id) WHERE legal_hold = true;

COMMENT ON TABLE safety_alerts IS 'Alerta gerado por regra. Status evolui via Edge Function admin.';

-- ============================================================
-- SAFETY_AGGREGATES — contadores agregados (sobrevivem aos eventos)
-- ============================================================
CREATE TABLE safety_aggregates (
  id                       uuid                NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  subject_id               uuid                NOT NULL REFERENCES safety_subjects (id) ON DELETE CASCADE,
  /**
   * Chave do agregado (ex.: 'adult_to_minor_messages_24h').
   */
  aggregate_key            text                NOT NULL,
  /**
   * Janela: '24h' | '7d' | '30d' | '12m'.
   */
  window                   text                NOT NULL,
  value                    bigint              NOT NULL DEFAULT 0,
  updated_at               timestamptz         NOT NULL DEFAULT now(),

  CONSTRAINT safety_aggregates_pkey PRIMARY KEY (id),
  CONSTRAINT safety_aggregates_uniq UNIQUE (tenant_id, application_id, subject_id, aggregate_key, window)
);

CREATE INDEX idx_sag_tenant ON safety_aggregates (tenant_id, aggregate_key);
CREATE INDEX idx_sag_subject ON safety_aggregates (subject_id);

COMMENT ON TABLE safety_aggregates IS 'Contadores agregados por sujeito. Aggregate_12m por padrão.';

-- ============================================================
-- SAFETY_EVIDENCE_ARTIFACTS — referência mínima (hash + path)
-- ============================================================
CREATE TABLE safety_evidence_artifacts (
  id                       uuid                NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  alert_id                 uuid                NOT NULL REFERENCES safety_alerts (id) ON DELETE CASCADE,
  /**
   * Hash do artefato (SHA-256 hex). Conteúdo bruto NÃO é armazenado
   * em V1 — apenas referência via storage path opcional.
   */
  artifact_hash            text                NOT NULL,
  storage_bucket           text,
  storage_path             text,
  mime_type                text,
  size_bytes               bigint,
  legal_hold               boolean             NOT NULL DEFAULT false,
  retention_class          text                NOT NULL DEFAULT 'case_24m',

  created_at               timestamptz         NOT NULL DEFAULT now(),

  CONSTRAINT safety_evidence_artifacts_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_sea_alert ON safety_evidence_artifacts (alert_id);
CREATE INDEX idx_sea_legal_hold ON safety_evidence_artifacts (tenant_id) WHERE legal_hold = true;

COMMENT ON TABLE safety_evidence_artifacts IS 'Referência de evidência (hash + path opcional). Conteúdo bruto proibido em V1.';

-- ============================================================
-- SAFETY_MODEL_RUNS — governança de classificadores (não usa em MVP)
-- ============================================================
CREATE TABLE safety_model_runs (
  id                       uuid                NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  model_id                 text                NOT NULL,
  model_version            text                NOT NULL,
  /**
   * Hash do input. Cleartext nunca persiste.
   */
  input_hash               text                NOT NULL,
  /**
   * Output do modelo (já minimizado). Sem PII.
   */
  output_jsonb             jsonb               NOT NULL DEFAULT '{}',
  /**
   * Confiança ou score, normalizado [0..1].
   */
  confidence               numeric(5,4),
  duration_ms              integer,
  created_at               timestamptz         NOT NULL DEFAULT now(),

  CONSTRAINT safety_model_runs_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_smr_tenant ON safety_model_runs (tenant_id, created_at DESC);

COMMENT ON TABLE safety_model_runs IS 'Governança de classificadores. Input apenas como hash.';

-- ============================================================
-- SAFETY_WEBHOOK_DELIVERIES — visão dedicada de entregas safety.*
--
-- O Core já tem `webhook_deliveries`. Esta tabela é uma view simples
-- para o admin filtrar entregas safety.* — não duplica a fila.
-- ============================================================
CREATE OR REPLACE VIEW safety_webhook_deliveries AS
SELECT *
FROM webhook_deliveries
WHERE event_type LIKE 'safety.%';

COMMENT ON VIEW safety_webhook_deliveries IS
  'View sobre webhook_deliveries filtrando event_type LIKE safety.%. Não duplica a fila.';
