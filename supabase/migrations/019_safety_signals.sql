-- Migration: 019_safety_signals
-- AgeKey Safety Signals module (Round 4) — METADATA-ONLY MVP.
--
-- Creates the canonical tables of the safety domain:
--   1. safety_subjects
--   2. safety_interactions
--   3. safety_events
--   4. safety_rules
--   5. safety_alerts
--   6. safety_aggregates
--   7. safety_evidence_artifacts
--   8. safety_model_runs
--
-- ZERO PII columns. ZERO raw content columns. Every row stores either an
-- enum, an HMAC hex, an artefact hash, a counter, a timestamp or a small
-- bounded JSON metadata blob (CHECK against forbidden keys).
--
-- All tables are tenant-scoped and RLS is enabled. The edge functions
-- `safety-*` are the only authorised writers (service-role).
--
-- Reference: docs/modules/safety-signals/DATA_MODEL.md
--            docs/modules/safety-signals/RLS_AND_SECURITY.md

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE safety_event_type AS ENUM (
    'interaction_started',
    'interaction_ended',
    'message_send_attempt',
    'message_sent',
    'message_blocked',
    'media_upload_attempt',
    'media_upload_blocked',
    'external_link_attempt',
    'external_link_blocked',
    'friend_request_attempt',
    'friend_request_accepted',
    'friend_request_blocked',
    'group_invite_attempt',
    'group_invite_accepted',
    'group_invite_blocked',
    'report_submitted',
    'user_blocked',
    'user_muted',
    'step_up_required',
    'step_up_completed',
    'step_up_failed',
    'moderation_action_received'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_channel_type AS ENUM (
    'direct_message',
    'group_chat',
    'public_post',
    'comment_thread',
    'voice_call',
    'video_call',
    'live_stream',
    'media_upload',
    'external_link',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_relationship_type AS ENUM (
    'unknown_to_unknown',
    'minor_to_minor',
    'adult_to_adult',
    'adult_to_minor',
    'minor_to_adult',
    'unknown_to_minor',
    'minor_to_unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_age_state AS ENUM (
    'unknown',
    'minor',
    'minor_under_13',
    'minor_13_to_17',
    'adult',
    'adult_18_plus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_alert_status AS ENUM (
    'open',
    'acknowledged',
    'resolved',
    'closed',
    'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_decision AS ENUM (
    'approved',
    'needs_review',
    'step_up_required',
    'rate_limited',
    'soft_blocked',
    'hard_blocked',
    'blocked_by_policy',
    'parental_consent_required',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HELPER: refuse forbidden keys (raw content + PII) on metadata blobs.
-- Mirror SQL of `findForbiddenIngestKeys`/privacy-guard.
-- ============================================================
CREATE OR REPLACE FUNCTION safety_jsonb_has_no_forbidden_keys(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
DECLARE
  forbidden text[] := ARRAY[
    -- Raw content (Safety v1 is METADATA-ONLY)
    'message','raw_text','text','body','content',
    'image','image_data','video','video_data','audio','audio_data',
    'attachment','attachment_data','transcript','caption',
    -- PII (full canonical list)
    'birthdate','date_of_birth','dob','birth_date','birthday',
    'data_nascimento','nascimento','idade','age','exact_age',
    'document','cpf','cnh','rg','passport','passport_number',
    'id_number','civil_id','social_security','ssn',
    'name','full_name','nome','nome_completo','first_name','last_name',
    'email','phone','mobile','telefone',
    'address','endereco','street','postcode','zipcode',
    'selfie','face','face_image','biometric','biometrics','raw_id',
    'latitude','longitude','gps','lat','lng','lon'
  ];
  k text;
BEGIN
  IF payload IS NULL THEN RETURN true; END IF;
  FOREACH k IN ARRAY forbidden LOOP
    IF payload ? k THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION safety_jsonb_has_no_forbidden_keys(jsonb) IS
  'Recusa blobs com chaves de conteúdo bruto ou PII. Mirror SQL do ingest guard.';

-- ============================================================
-- 1. safety_subjects — opaque view of an actor in a tenant.
-- ============================================================
CREATE TABLE safety_subjects (
  id                            uuid              NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                     uuid              NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id                uuid              NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  subject_ref_hmac              text              NOT NULL,
  current_age_state             safety_age_state  NOT NULL DEFAULT 'unknown',
  current_assurance_level       assurance_level,
  last_agekey_token_jti         uuid,
  last_verification_result_id   uuid,
  /** Tenant-scoped contextual risk score (0–1). NEVER cross-tenant. */
  risk_score                    numeric(4,3)      NOT NULL DEFAULT 0
                                CHECK (risk_score >= 0 AND risk_score <= 1),
  risk_state                    text              NOT NULL DEFAULT 'unknown',
  first_seen_at                 timestamptz       NOT NULL DEFAULT now(),
  last_seen_at                  timestamptz       NOT NULL DEFAULT now(),
  metadata                      jsonb             NOT NULL DEFAULT '{}',
  created_at                    timestamptz       NOT NULL DEFAULT now(),
  updated_at                    timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT safety_subjects_pkey  PRIMARY KEY (id),
  CONSTRAINT safety_subjects_subject_hmac_unique
    UNIQUE (tenant_id, application_id, subject_ref_hmac),
  CONSTRAINT safety_subjects_subject_hmac_format
    CHECK (subject_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT safety_subjects_metadata_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(metadata))
);

CREATE INDEX idx_safety_subjects_tenant_app ON safety_subjects (tenant_id, application_id);
CREATE INDEX idx_safety_subjects_last_seen  ON safety_subjects (tenant_id, last_seen_at DESC);

CREATE TRIGGER trg_safety_subjects_updated_at
  BEFORE UPDATE ON safety_subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. safety_interactions — bounded interaction (DM thread, group, etc.)
-- ============================================================
CREATE TABLE safety_interactions (
  id                       uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                       NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  interaction_ref          text,                                          -- relying-party-supplied opaque id
  channel_type             safety_channel_type        NOT NULL DEFAULT 'unknown',
  relationship_type        safety_relationship_type   NOT NULL DEFAULT 'unknown_to_unknown',
  actor_subject_id         uuid                                REFERENCES safety_subjects (id) ON DELETE SET NULL,
  counterparty_subject_id  uuid                                REFERENCES safety_subjects (id) ON DELETE SET NULL,
  actor_age_state          safety_age_state           NOT NULL DEFAULT 'unknown',
  counterparty_age_state   safety_age_state           NOT NULL DEFAULT 'unknown',
  started_at               timestamptz                NOT NULL DEFAULT now(),
  ended_at                 timestamptz,
  duration_ms              bigint,
  status                   text                       NOT NULL DEFAULT 'open',
  metadata                 jsonb                      NOT NULL DEFAULT '{}',
  created_at               timestamptz                NOT NULL DEFAULT now(),
  updated_at               timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT safety_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT safety_interactions_metadata_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(metadata))
);

CREATE INDEX idx_safety_interactions_tenant_app
  ON safety_interactions (tenant_id, application_id);
CREATE INDEX idx_safety_interactions_actor
  ON safety_interactions (actor_subject_id);
CREATE INDEX idx_safety_interactions_counterparty
  ON safety_interactions (counterparty_subject_id);

CREATE TRIGGER trg_safety_interactions_updated_at
  BEFORE UPDATE ON safety_interactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. safety_events — append-only ingestion ledger.
-- ============================================================
CREATE TABLE safety_events (
  id                        uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                 uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id            uuid                       NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  event_type                safety_event_type          NOT NULL,
  occurred_at               timestamptz                NOT NULL,
  received_at               timestamptz                NOT NULL DEFAULT now(),
  interaction_id            uuid                                REFERENCES safety_interactions (id) ON DELETE SET NULL,
  interaction_ref           text,
  actor_subject_id          uuid                                REFERENCES safety_subjects (id) ON DELETE SET NULL,
  counterparty_subject_id   uuid                                REFERENCES safety_subjects (id) ON DELETE SET NULL,
  actor_ref_hmac            text                       NOT NULL,
  counterparty_ref_hmac     text,
  actor_age_state           safety_age_state           NOT NULL DEFAULT 'unknown',
  counterparty_age_state    safety_age_state           NOT NULL DEFAULT 'unknown',
  relationship_type         safety_relationship_type   NOT NULL DEFAULT 'unknown_to_unknown',
  channel_type              safety_channel_type        NOT NULL DEFAULT 'unknown',
  ip_ref_hmac               text,
  ip_prefix_truncated       text,                                          -- /24 IPv4 or /48 IPv6 fragment, never full IP
  device_ref_hmac           text,
  user_agent_hash           text,
  duration_ms               bigint,
  -- Locks Safety v1 to metadata-only.
  content_processed         boolean                    NOT NULL DEFAULT false
                            CHECK (content_processed = false),
  content_stored            boolean                    NOT NULL DEFAULT false
                            CHECK (content_stored = false),
  artifact_hash             text,
  artifact_type             text,
  risk_categories           text[]                     NOT NULL DEFAULT '{}',
  reason_codes              text[]                     NOT NULL DEFAULT '{}',
  model_score               numeric(5,4),
  rule_eval                 jsonb                      NOT NULL DEFAULT '{}',
  retention_class           text                       NOT NULL DEFAULT 'standard_audit',
  retention_until           timestamptz,
  raw_event_hash            text,
  client_event_id           text,
  metadata                  jsonb                      NOT NULL DEFAULT '{}',
  created_at                timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT safety_events_pkey PRIMARY KEY (id),
  CONSTRAINT safety_events_actor_hmac_format
    CHECK (actor_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT safety_events_counterparty_hmac_format
    CHECK (counterparty_ref_hmac IS NULL OR counterparty_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT safety_events_metadata_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(metadata)),
  CONSTRAINT safety_events_rule_eval_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(rule_eval))
);

COMMENT ON TABLE  safety_events                IS
  'Eventos de Safety Signals (apenas metadados). Append-only.';
COMMENT ON COLUMN safety_events.content_processed IS
  'Sempre false em v1. CHECK trava esse invariante.';

CREATE INDEX idx_safety_events_tenant_received
  ON safety_events (tenant_id, received_at DESC);
CREATE INDEX idx_safety_events_actor
  ON safety_events (tenant_id, actor_ref_hmac, received_at DESC);
CREATE INDEX idx_safety_events_event_type
  ON safety_events (tenant_id, event_type, received_at DESC);
CREATE INDEX idx_safety_events_interaction
  ON safety_events (interaction_id) WHERE interaction_id IS NOT NULL;

-- Append-only.
CREATE TRIGGER trg_safety_events_no_update
  BEFORE UPDATE ON safety_events
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();
CREATE TRIGGER trg_safety_events_no_delete
  BEFORE DELETE ON safety_events
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ============================================================
-- 4. safety_rules — rule definitions per tenant or system-wide.
-- ============================================================
CREATE TABLE safety_rules (
  id                uuid              NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id         uuid                       REFERENCES tenants (id) ON DELETE CASCADE,
  application_id    uuid                       REFERENCES applications (id) ON DELETE SET NULL,
  rule_key          text              NOT NULL, -- e.g. 'SAFETY_UNKNOWN_TO_MINOR_PRIVATE_MESSAGE'
  name              text              NOT NULL,
  description       text,
  jurisdiction      text,
  version           integer           NOT NULL DEFAULT 1,
  risk_category     text              NOT NULL,
  severity          safety_severity   NOT NULL DEFAULT 'medium',
  condition_json    jsonb             NOT NULL,
  action_json       jsonb             NOT NULL,
  enabled           boolean           NOT NULL DEFAULT true,
  is_system_rule    boolean           NOT NULL DEFAULT false,
  created_by        uuid                       REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at        timestamptz       NOT NULL DEFAULT now(),
  updated_at        timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT safety_rules_pkey PRIMARY KEY (id),
  CONSTRAINT safety_rules_unique_key
    UNIQUE (tenant_id, rule_key, version),
  CONSTRAINT safety_rules_condition_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(condition_json)),
  CONSTRAINT safety_rules_action_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(action_json))
);

CREATE INDEX idx_safety_rules_tenant_enabled
  ON safety_rules (tenant_id, enabled) WHERE enabled = true;

CREATE TRIGGER trg_safety_rules_updated_at
  BEFORE UPDATE ON safety_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. safety_alerts — actionable cases.
-- ============================================================
CREATE TABLE safety_alerts (
  id                       uuid                  NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                  NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                  NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  alert_ref                text,
  status                   safety_alert_status   NOT NULL DEFAULT 'open',
  severity                 safety_severity       NOT NULL DEFAULT 'medium',
  risk_category            text                  NOT NULL,
  actor_subject_id         uuid                          REFERENCES safety_subjects (id) ON DELETE SET NULL,
  counterparty_subject_id  uuid                          REFERENCES safety_subjects (id) ON DELETE SET NULL,
  interaction_id           uuid                          REFERENCES safety_interactions (id) ON DELETE SET NULL,
  reason_codes             text[]                NOT NULL DEFAULT '{}',
  event_ids                uuid[]                NOT NULL DEFAULT '{}',
  evidence_artifact_ids    uuid[]                NOT NULL DEFAULT '{}',
  score                    numeric(4,3)          CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  action_taken             text,
  human_review_required    boolean               NOT NULL DEFAULT false,
  assigned_to              uuid                          REFERENCES auth.users (id) ON DELETE SET NULL,
  opened_at                timestamptz           NOT NULL DEFAULT now(),
  acknowledged_at          timestamptz,
  resolved_at              timestamptz,
  closed_at                timestamptz,
  retention_class          text                  NOT NULL DEFAULT 'standard_audit',
  retention_until          timestamptz,
  metadata                 jsonb                 NOT NULL DEFAULT '{}',
  created_at               timestamptz           NOT NULL DEFAULT now(),
  updated_at               timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT safety_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT safety_alerts_metadata_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(metadata))
);

CREATE INDEX idx_safety_alerts_tenant_status
  ON safety_alerts (tenant_id, status, severity DESC, opened_at DESC);
CREATE INDEX idx_safety_alerts_actor
  ON safety_alerts (actor_subject_id) WHERE actor_subject_id IS NOT NULL;

CREATE TRIGGER trg_safety_alerts_updated_at
  BEFORE UPDATE ON safety_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. safety_aggregates — counters per (subject, category, window).
-- ============================================================
CREATE TABLE safety_aggregates (
  id              uuid              NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id       uuid              NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id  uuid              NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  subject_id      uuid                       REFERENCES safety_subjects (id) ON DELETE CASCADE,
  bucket          text              NOT NULL,  -- e.g. '24h', '7d', '30d', '6m', '12m'
  category        text              NOT NULL,  -- event_type or risk_category
  count_value     bigint            NOT NULL DEFAULT 0 CHECK (count_value >= 0),
  window_start    timestamptz       NOT NULL,
  window_end      timestamptz       NOT NULL,
  computed_at     timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT safety_aggregates_pkey PRIMARY KEY (id),
  CONSTRAINT safety_aggregates_unique
    UNIQUE (tenant_id, subject_id, bucket, category, window_start)
);

CREATE INDEX idx_safety_aggregates_subject
  ON safety_aggregates (tenant_id, subject_id, bucket, category);

-- ============================================================
-- 7. safety_evidence_artifacts — references only (NEVER raw bytes).
-- ============================================================
CREATE TABLE safety_evidence_artifacts (
  id              uuid          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id       uuid          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  alert_id        uuid                   REFERENCES safety_alerts (id) ON DELETE SET NULL,
  event_id        uuid                   REFERENCES safety_events (id) ON DELETE SET NULL,
  artifact_hash   text          NOT NULL,
  artifact_type   text,
  storage_ref     text,         -- opaque pointer to a blob managed elsewhere; NEVER public
  created_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT safety_evidence_artifacts_pkey PRIMARY KEY (id),
  CONSTRAINT safety_evidence_artifacts_hash_format
    CHECK (artifact_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_safety_evidence_alert ON safety_evidence_artifacts (alert_id);
CREATE INDEX idx_safety_evidence_event ON safety_evidence_artifacts (event_id);

-- Append-only.
CREATE TRIGGER trg_safety_evidence_no_update
  BEFORE UPDATE ON safety_evidence_artifacts
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();
CREATE TRIGGER trg_safety_evidence_no_delete
  BEFORE DELETE ON safety_evidence_artifacts
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ============================================================
-- 8. safety_model_runs — model invocation registry (governance).
-- v1 keeps it empty by design (`AGEKEY_SAFETY_MODEL_GOVERNANCE_ENABLED=false`).
-- ============================================================
CREATE TABLE safety_model_runs (
  id              uuid          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id       uuid          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  model_name      text          NOT NULL,
  model_version   text          NOT NULL,
  invoked_at      timestamptz   NOT NULL DEFAULT now(),
  duration_ms     integer,
  inputs_hash     text,
  outputs_hash    text,
  passed          boolean,
  reason          text,
  metadata        jsonb         NOT NULL DEFAULT '{}',

  CONSTRAINT safety_model_runs_pkey PRIMARY KEY (id),
  CONSTRAINT safety_model_runs_metadata_no_pii
    CHECK (safety_jsonb_has_no_forbidden_keys(metadata))
);

CREATE INDEX idx_safety_model_runs_tenant
  ON safety_model_runs (tenant_id, invoked_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE safety_subjects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_interactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_rules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_aggregates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_evidence_artifacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_model_runs          ENABLE ROW LEVEL SECURITY;

-- All inserts go through service-role edge functions.
-- Tenant-side reads are scoped by current_tenant_id().

CREATE POLICY safety_subjects_select ON safety_subjects
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY safety_subjects_insert ON safety_subjects
  FOR INSERT WITH CHECK (false);
CREATE POLICY safety_subjects_update ON safety_subjects
  FOR UPDATE USING (false);

CREATE POLICY safety_interactions_select ON safety_interactions
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY safety_interactions_insert ON safety_interactions
  FOR INSERT WITH CHECK (false);
CREATE POLICY safety_interactions_update ON safety_interactions
  FOR UPDATE USING (false);

CREATE POLICY safety_events_select ON safety_events
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('operator')
  );
CREATE POLICY safety_events_insert ON safety_events
  FOR INSERT WITH CHECK (false);

CREATE POLICY safety_rules_select ON safety_rules
  FOR SELECT USING (
    tenant_id IS NULL OR tenant_id = current_tenant_id()
  );
CREATE POLICY safety_rules_insert ON safety_rules
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );
CREATE POLICY safety_rules_update ON safety_rules
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY safety_alerts_select ON safety_alerts
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY safety_alerts_insert ON safety_alerts
  FOR INSERT WITH CHECK (false);
CREATE POLICY safety_alerts_update ON safety_alerts
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('operator')
  );

CREATE POLICY safety_aggregates_select ON safety_aggregates
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY safety_aggregates_insert ON safety_aggregates
  FOR INSERT WITH CHECK (false);
CREATE POLICY safety_aggregates_update ON safety_aggregates
  FOR UPDATE USING (false);

CREATE POLICY safety_evidence_artifacts_select ON safety_evidence_artifacts
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('auditor')
  );
CREATE POLICY safety_evidence_artifacts_insert ON safety_evidence_artifacts
  FOR INSERT WITH CHECK (false);

CREATE POLICY safety_model_runs_select ON safety_model_runs
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('auditor')
  );
CREATE POLICY safety_model_runs_insert ON safety_model_runs
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- WEBHOOK FAN-OUT — safety.alert_created mirrors the consent fan-out.
-- ============================================================
CREATE OR REPLACE FUNCTION fan_out_safety_alert_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event_type   text;
  v_payload      jsonb;
  v_payload_text text;
  v_signature    text;
  v_endpoint     RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'safety.alert_created';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'safety.alert_updated';
  ELSE
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event_id', uuid_generate_v7(),
    'event_type', v_event_type,
    'created_at', to_char(now() AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'tenant_id', NEW.tenant_id,
    'application_id', NEW.application_id,
    'decision', CASE NEW.status
      WHEN 'open'         THEN 'needs_review'
      WHEN 'acknowledged' THEN 'needs_review'
      WHEN 'resolved'     THEN 'approved'
      WHEN 'closed'       THEN 'approved'
      WHEN 'dismissed'    THEN 'approved'
      ELSE 'needs_review'
    END,
    'safety_alert_id', NEW.id,
    'safety_event_id', (
      SELECT e_id FROM unnest(NEW.event_ids) AS e_id LIMIT 1
    ),
    'severity', NEW.severity,
    'risk_category', NEW.risk_category,
    'policy_id', NULL,
    'policy_version', NULL,
    'reason_codes',
      CASE WHEN cardinality(NEW.reason_codes) > 0
           THEN to_jsonb(NEW.reason_codes)
           ELSE jsonb_build_array('SAFETY_RISK_FLAGGED') END,
    'payload_hash', encode(
      digest(
        coalesce(NEW.id::text, '') || coalesce(NEW.status::text, '') ||
        coalesce(NEW.severity::text, '') || coalesce(NEW.risk_category, ''),
        'sha256'
      ),
      'hex'
    ),
    'pii_included', false,
    'content_included', false
  );

  v_payload_text := v_payload::text;

  FOR v_endpoint IN
    SELECT we.id, we.tenant_id, we.secret_hash, we.events
    FROM   webhook_endpoints we
    WHERE  we.application_id = NEW.application_id
      AND  we.deleted_at IS NULL
      AND  we.status = 'active'
      AND  (cardinality(we.events) = 0 OR v_event_type = ANY(we.events))
  LOOP
    v_signature := encode(
      hmac(v_payload_text::bytea, v_endpoint.secret_hash::bytea, 'sha256'),
      'hex'
    );
    INSERT INTO webhook_deliveries (
      endpoint_id, tenant_id, event_type, payload_json, signature
    ) VALUES (
      v_endpoint.id, v_endpoint.tenant_id, v_event_type, v_payload, v_signature
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_safety_alerts_fanout
  AFTER INSERT OR UPDATE ON safety_alerts
  FOR EACH ROW EXECUTE FUNCTION fan_out_safety_alert_webhooks();

-- ============================================================
-- AUDIT TRIGGERS — append a row to audit_events on lifecycle changes.
-- ============================================================
CREATE OR REPLACE FUNCTION audit_safety_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_action text;
  v_diff   jsonb;
  v_id     uuid;
  v_tenant uuid;
BEGIN
  IF TG_TABLE_NAME = 'safety_events' AND TG_OP = 'INSERT' THEN
    v_id := NEW.id; v_tenant := NEW.tenant_id;
    v_action := 'safety.event_ingested';
    v_diff := jsonb_build_object(
      'decision_domain', 'safety_signal',
      'envelope_version', 1,
      'event_type', NEW.event_type,
      'channel_type', NEW.channel_type,
      'relationship_type', NEW.relationship_type,
      'actor_age_state', NEW.actor_age_state,
      'counterparty_age_state', NEW.counterparty_age_state,
      'reason_codes', to_jsonb(NEW.reason_codes),
      'risk_categories', to_jsonb(NEW.risk_categories),
      'safety_event_id', NEW.id,
      'interaction_id', NEW.interaction_id,
      'content_included', false,
      'pii_included', false
    );
  ELSIF TG_TABLE_NAME = 'safety_alerts' THEN
    v_id := NEW.id; v_tenant := NEW.tenant_id;
    IF TG_OP = 'INSERT' THEN
      v_action := 'safety.alert_created';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'safety.alert_status_changed';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
    v_diff := jsonb_build_object(
      'decision_domain', 'safety_signal',
      'envelope_version', 1,
      'safety_alert_id', NEW.id,
      'severity', NEW.severity,
      'risk_category', NEW.risk_category,
      'reason_codes', to_jsonb(NEW.reason_codes),
      'status', NEW.status,
      'human_review_required', NEW.human_review_required,
      'content_included', false,
      'pii_included', false
    );
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO audit_events (
    tenant_id, actor_type, actor_id, action, resource_type, resource_id, diff_json
  ) VALUES (
    v_tenant, 'system', NULL, v_action, 'safety_signal', v_id, v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_safety_events
  AFTER INSERT ON safety_events
  FOR EACH ROW EXECUTE FUNCTION audit_safety_change();

CREATE TRIGGER trg_audit_safety_alerts
  AFTER INSERT OR UPDATE ON safety_alerts
  FOR EACH ROW EXECUTE FUNCTION audit_safety_change();
