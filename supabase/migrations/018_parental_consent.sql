-- Migration: 018_parental_consent
-- AgeKey Parental Consent module (Round 3).
--
-- Creates the seven canonical tables of the consent domain:
--   1. parental_consent_requests
--   2. guardian_contacts
--   3. guardian_verifications
--   4. consent_text_versions
--   5. parental_consents
--   6. parental_consent_tokens
--   7. parental_consent_revocations
--
-- ZERO PII columns. Civil identifiers, document numbers, full names, civil
-- name, birthdate, exact age, biometric templates, raw selfies and address
-- are EXPRESSLY FORBIDDEN — there is no column where they could land. Tenant
-- code that wants to keep contact (email/phone) of the guardian uses the
-- ciphertext + hash columns of `guardian_contacts`, never plaintext.
--
-- All tables are tenant-scoped and RLS is enabled. The edge functions
-- `parental-consent-*` are the only authorised writers; they use the
-- service-role client and `set_tenant_context()` to attribute writes.
--
-- Reference: docs/modules/parental-consent/data-model.md
--            docs/modules/parental-consent/security.md
--            packages/shared/src/consent/

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE consent_request_status AS ENUM (
    'created',
    'pending_guardian',
    'pending_verification',
    'approved',
    'denied',
    'expired',
    'revoked',
    'failed',
    'under_review',
    'blocked_by_policy'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parental_consent_status AS ENUM (
    'active',
    'denied',
    'expired',
    'revoked',
    'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE guardian_contact_type AS ENUM (
    'email',
    'phone',
    'school_account',
    'federated_account'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE guardian_verification_method AS ENUM (
    'otp_email',
    'otp_phone',
    'school_sso',
    'federated_sso'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE guardian_verification_status AS ENUM (
    'pending',
    'sent',
    'verified',
    'failed',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parental_consent_token_type AS ENUM (
    'agekey_jws',
    'sd_jwt_vc',
    'presentation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parental_consent_token_status AS ENUM (
    'active',
    'revoked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_text_status AS ENUM (
    'draft',
    'published',
    'retired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_revocation_actor AS ENUM (
    'guardian',
    'tenant_admin',
    'subject',
    'agekey_system',
    'regulator'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_risk_tier AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HELPER: assert that a JSONB blob does not carry forbidden PII keys.
-- Mirrors packages/shared/src/privacy-guard.ts. Used by CHECK constraints
-- and (defensively) by triggers before INSERT/UPDATE.
-- ============================================================
CREATE OR REPLACE FUNCTION consent_jsonb_has_no_forbidden_keys(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
DECLARE
  forbidden text[] := ARRAY[
    'birthdate', 'date_of_birth', 'dob', 'birth_date', 'birthday',
    'data_nascimento', 'nascimento', 'idade', 'age', 'exact_age',
    'document', 'cpf', 'cnh', 'rg', 'passport', 'passport_number',
    'id_number', 'civil_id', 'social_security', 'ssn',
    'name', 'full_name', 'nome', 'nome_completo', 'first_name', 'last_name',
    'email', 'phone', 'mobile', 'telefone',
    'address', 'endereco', 'street', 'postcode', 'zipcode',
    'selfie', 'face', 'face_image', 'biometric', 'biometrics', 'raw_id'
  ];
  k text;
BEGIN
  IF payload IS NULL THEN
    RETURN true;
  END IF;
  FOREACH k IN ARRAY forbidden LOOP
    IF payload ? k THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION consent_jsonb_has_no_forbidden_keys(jsonb) IS
  'Recusa blobs com chaves PII no nível superior (birthdate, cpf, email, etc.). Mirror SQL do privacy-guard canônico.';

-- ============================================================
-- 1. parental_consent_requests
-- ============================================================
CREATE TABLE parental_consent_requests (
  id                       uuid                    NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                    NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  application_id           uuid                    NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  policy_id                uuid                             REFERENCES policies (id) ON DELETE RESTRICT,
  policy_version           integer,
  verification_session_id  uuid                             REFERENCES verification_sessions (id) ON DELETE SET NULL,

  external_user_ref        text,                  -- opaque ref supplied by the relying party (validated server-side)
  subject_ref_hmac         text                    NOT NULL,
  -- HMAC-SHA256 hex of the subject ref (per-tenant key). Never PII.

  resource                 text                    NOT NULL,
  scope                    text,
  purpose_codes            text[]                  NOT NULL CHECK (cardinality(purpose_codes) > 0),
  data_categories          text[]                  NOT NULL CHECK (cardinality(data_categories) > 0),
  risk_tier                consent_risk_tier       NOT NULL DEFAULT 'low',

  status                   consent_request_status  NOT NULL DEFAULT 'created',
  decision                 text                    NOT NULL DEFAULT 'pending'
                            CHECK (decision IN ('approved','denied','needs_review','pending','blocked_by_policy')),
  reason_code              text                    NOT NULL DEFAULT 'CONSENT_NOT_GIVEN',

  return_url               text,
  webhook_correlation_id   text,
  locale                   text                    NOT NULL DEFAULT 'pt-BR',

  -- minimised client context (user_agent fragments, platform); CHECK below
  -- guarantees no forbidden keys land here.
  client_context_json      jsonb                   NOT NULL DEFAULT '{}',

  client_ip                inet,
  user_agent               text,

  requested_at             timestamptz             NOT NULL DEFAULT now(),
  expires_at               timestamptz             NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at               timestamptz             NOT NULL DEFAULT now(),
  updated_at               timestamptz             NOT NULL DEFAULT now(),

  CONSTRAINT parental_consent_requests_pkey PRIMARY KEY (id),
  CONSTRAINT parental_consent_requests_subject_hmac_format
    CHECK (subject_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parental_consent_requests_resource_format
    CHECK (resource ~ '^[a-z0-9][a-z0-9_:.\-]{0,127}$'),
  CONSTRAINT parental_consent_requests_client_context_no_pii
    CHECK (consent_jsonb_has_no_forbidden_keys(client_context_json))
);

COMMENT ON TABLE  parental_consent_requests IS
  'Sessão de consentimento parental. PII proibida — só refs HMAC e metadados minimizados.';
COMMENT ON COLUMN parental_consent_requests.subject_ref_hmac IS
  'HMAC-SHA256 hex da external_user_ref (chave por-tenant). Nunca PII.';
COMMENT ON COLUMN parental_consent_requests.client_context_json IS
  'Metadados não-PII do cliente (platform, fragmentos de user_agent). CHECK rejeita chaves PII.';

CREATE INDEX idx_pcr_tenant_created
  ON parental_consent_requests (tenant_id, created_at DESC);
CREATE INDEX idx_pcr_app_status
  ON parental_consent_requests (application_id, status);
CREATE INDEX idx_pcr_session
  ON parental_consent_requests (verification_session_id)
  WHERE verification_session_id IS NOT NULL;
CREATE INDEX idx_pcr_subject
  ON parental_consent_requests (tenant_id, subject_ref_hmac);

CREATE TRIGGER trg_pcr_updated_at
  BEFORE UPDATE ON parental_consent_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. guardian_contacts
-- ============================================================
-- Optional, only filled when the channel is email/phone and the tenant opts
-- into storing the channel for later notifications. The plaintext is NEVER
-- stored — we keep:
--   * `contact_hash`     : HMAC-SHA256 hex (per-tenant key) for lookups,
--   * `contact_ciphertext`: AES-GCM ciphertext base64 (per-tenant DEK).
-- The edge function `parental-consent-guardian-start` is the only writer;
-- the ciphertext is decrypted only inside the OTP-dispatch path.
-- ============================================================
CREATE TABLE guardian_contacts (
  id                  uuid                          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id           uuid                          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  consent_request_id  uuid                          NOT NULL REFERENCES parental_consent_requests (id) ON DELETE CASCADE,

  guardian_ref_hmac   text                          NOT NULL,
  contact_type        guardian_contact_type         NOT NULL,
  contact_hash        text                          NOT NULL,
  contact_ciphertext  text,
  contact_ciphertext_kid text,
  -- NEVER store contact plaintext.

  verification_status guardian_verification_status  NOT NULL DEFAULT 'pending',
  last_otp_sent_at    timestamptz,
  verified_at         timestamptz,

  created_at          timestamptz                   NOT NULL DEFAULT now(),
  updated_at          timestamptz                   NOT NULL DEFAULT now(),

  CONSTRAINT guardian_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT guardian_contacts_guardian_hmac_format
    CHECK (guardian_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guardian_contacts_contact_hash_format
    CHECK (contact_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE  guardian_contacts IS
  'Canal do responsável. Plaintext do contato NUNCA é salvo — só hash HMAC + ciphertext opcional.';
COMMENT ON COLUMN guardian_contacts.contact_hash IS
  'HMAC-SHA256 do contato (chave por-tenant). Nunca PII em texto plano.';
COMMENT ON COLUMN guardian_contacts.contact_ciphertext IS
  'AES-GCM(contato) com DEK por-tenant. Apenas lido server-side pelo dispatcher de OTP. Pode ser NULL.';

CREATE INDEX idx_guardian_contacts_request
  ON guardian_contacts (consent_request_id);
CREATE INDEX idx_guardian_contacts_tenant_hash
  ON guardian_contacts (tenant_id, contact_hash);
CREATE INDEX idx_guardian_contacts_guardian
  ON guardian_contacts (tenant_id, guardian_ref_hmac);

CREATE TRIGGER trg_gc_updated_at
  BEFORE UPDATE ON guardian_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. guardian_verifications
-- ============================================================
CREATE TABLE guardian_verifications (
  id                       uuid                          NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                uuid                          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  consent_request_id       uuid                          NOT NULL REFERENCES parental_consent_requests (id) ON DELETE CASCADE,
  guardian_contact_id      uuid                                   REFERENCES guardian_contacts (id) ON DELETE SET NULL,

  method                   guardian_verification_method  NOT NULL,
  assurance_level          assurance_level               NOT NULL DEFAULT 'low',
  provider_id              text,                                  -- reserved for future SSO/gateway providers
  attestation_hash         text,
  decision                 text                          NOT NULL DEFAULT 'pending'
                            CHECK (decision IN ('approved','denied','needs_review','pending')),
  reason_code              text                          NOT NULL DEFAULT 'CONSENT_GUARDIAN_NOT_VERIFIED',

  -- OTP digest is HMAC of the OTP, never plaintext.
  otp_digest               text,
  otp_attempts             integer                       NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0),
  otp_expires_at           timestamptz,

  -- Minimised evidence (e.g. provider's correlation id, channel kind).
  -- CHECK guarantees no PII keys.
  evidence_json            jsonb                         NOT NULL DEFAULT '{}',

  verified_at              timestamptz,
  expires_at               timestamptz,

  created_at               timestamptz                   NOT NULL DEFAULT now(),
  updated_at               timestamptz                   NOT NULL DEFAULT now(),

  CONSTRAINT guardian_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT guardian_verifications_evidence_no_pii
    CHECK (consent_jsonb_has_no_forbidden_keys(evidence_json))
);

COMMENT ON TABLE  guardian_verifications IS
  'Verificação do canal do responsável. OTP é guardado como digest HMAC, nunca em claro.';

CREATE INDEX idx_gv_request ON guardian_verifications (consent_request_id);
CREATE INDEX idx_gv_tenant_method ON guardian_verifications (tenant_id, method);

CREATE TRIGGER trg_gv_updated_at
  BEFORE UPDATE ON guardian_verifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. consent_text_versions
-- ============================================================
CREATE TABLE consent_text_versions (
  id                uuid                  NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id         uuid                  NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  policy_id         uuid                           REFERENCES policies (id) ON DELETE RESTRICT,
  version           integer               NOT NULL,
  language          text                  NOT NULL DEFAULT 'pt-BR',

  title             text                  NOT NULL,
  body_markdown     text                  NOT NULL,
  body_hash         text                  NOT NULL,        -- SHA-256 hex of body_markdown

  data_categories   text[]                NOT NULL CHECK (cardinality(data_categories) > 0),
  purpose_codes     text[]                NOT NULL CHECK (cardinality(purpose_codes) > 0),

  effective_from    timestamptz           NOT NULL DEFAULT now(),
  effective_until   timestamptz,
  status            consent_text_status   NOT NULL DEFAULT 'draft',
  created_by        uuid,                                  -- auth.users id; SET NULL on deletion via FK below

  created_at        timestamptz           NOT NULL DEFAULT now(),
  updated_at        timestamptz           NOT NULL DEFAULT now(),

  CONSTRAINT consent_text_versions_pkey PRIMARY KEY (id),
  CONSTRAINT consent_text_versions_unique_version
    UNIQUE (tenant_id, policy_id, version, language),
  CONSTRAINT consent_text_versions_body_hash_format
    CHECK (body_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT consent_text_versions_created_by_fk
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE  consent_text_versions IS
  'Versões versionadas do texto de consentimento. body_hash é o que vai assinado no token.';

CREATE INDEX idx_ctv_tenant_status
  ON consent_text_versions (tenant_id, status);
CREATE INDEX idx_ctv_policy
  ON consent_text_versions (policy_id, version)
  WHERE policy_id IS NOT NULL;

CREATE TRIGGER trg_ctv_updated_at
  BEFORE UPDATE ON consent_text_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. parental_consents
-- ============================================================
-- Append-only after creation, except for status transitions handled by the
-- edge function (and validated by trigger). DELETE is forbidden.
-- ============================================================
CREATE TABLE parental_consents (
  id                          uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id                   uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  consent_request_id          uuid                       NOT NULL REFERENCES parental_consent_requests (id) ON DELETE CASCADE,
  verification_session_id     uuid                                REFERENCES verification_sessions (id) ON DELETE SET NULL,
  guardian_verification_id    uuid                                REFERENCES guardian_verifications (id) ON DELETE SET NULL,
  consent_text_version_id     uuid                                REFERENCES consent_text_versions (id) ON DELETE RESTRICT,
  application_id              uuid                       NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  policy_id                   uuid                                REFERENCES policies (id) ON DELETE RESTRICT,
  policy_version              integer,

  subject_ref_hmac            text                       NOT NULL,
  guardian_ref_hmac           text                       NOT NULL,

  resource                    text                       NOT NULL,
  scope                       text,
  purpose_codes               text[]                     NOT NULL,
  data_categories             text[]                     NOT NULL,
  risk_tier                   consent_risk_tier          NOT NULL DEFAULT 'low',

  method                      guardian_verification_method NOT NULL,
  assurance_level             assurance_level            NOT NULL,
  status                      parental_consent_status    NOT NULL DEFAULT 'active',

  consent_text_hash           text                       NOT NULL,
  proof_hash                  text                       NOT NULL,

  issued_at                   timestamptz                NOT NULL DEFAULT now(),
  expires_at                  timestamptz                NOT NULL,
  revoked_at                  timestamptz,
  revocation_reason           text,
  superseded_by               uuid,

  created_at                  timestamptz                NOT NULL DEFAULT now(),
  updated_at                  timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT parental_consents_pkey PRIMARY KEY (id),
  CONSTRAINT parental_consents_subject_hmac_format
    CHECK (subject_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parental_consents_guardian_hmac_format
    CHECK (guardian_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parental_consents_text_hash_format
    CHECK (consent_text_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parental_consents_proof_hash_format
    CHECK (proof_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parental_consents_resource_format
    CHECK (resource ~ '^[a-z0-9][a-z0-9_:.\-]{0,127}$'),
  CONSTRAINT parental_consents_superseded_by_fk
    FOREIGN KEY (superseded_by) REFERENCES parental_consents (id) ON DELETE SET NULL
);

COMMENT ON TABLE  parental_consents IS
  'Consentimento parental concedido. Sem PII direto, só refs HMAC + hashes do texto e da prova.';

CREATE INDEX idx_pc_tenant_status
  ON parental_consents (tenant_id, status, issued_at DESC);
CREATE INDEX idx_pc_subject
  ON parental_consents (tenant_id, subject_ref_hmac);
CREATE INDEX idx_pc_request
  ON parental_consents (consent_request_id);
CREATE INDEX idx_pc_app
  ON parental_consents (application_id, status);
CREATE INDEX idx_pc_resource
  ON parental_consents (tenant_id, resource, status);

CREATE TRIGGER trg_pc_updated_at
  BEFORE UPDATE ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- DELETE blocked at the trigger level.
CREATE TRIGGER trg_pc_no_delete
  BEFORE DELETE ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ============================================================
-- 6. parental_consent_tokens
-- ============================================================
-- Index of issued consent tokens. Mirrors `result_tokens` for the age-verify
-- domain. The full JWT is NEVER stored — only its jti, hash and metadata.
-- ============================================================
CREATE TABLE parental_consent_tokens (
  jti               uuid                            NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id         uuid                            NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  parental_consent_id uuid                          NOT NULL REFERENCES parental_consents (id) ON DELETE CASCADE,
  result_token_id   uuid,                                            -- optional link to a sibling result_tokens row

  token_type        parental_consent_token_type     NOT NULL DEFAULT 'agekey_jws',
  token_hash        text                            NOT NULL,
  audience          text                            NOT NULL,
  kid               text                            NOT NULL,

  issued_at         timestamptz                     NOT NULL DEFAULT now(),
  expires_at        timestamptz                     NOT NULL,
  revoked_at        timestamptz,
  status            parental_consent_token_status   NOT NULL DEFAULT 'active',

  created_at        timestamptz                     NOT NULL DEFAULT now(),

  CONSTRAINT parental_consent_tokens_pkey PRIMARY KEY (jti),
  CONSTRAINT parental_consent_tokens_token_hash_format
    CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE  parental_consent_tokens IS
  'Índice de tokens de consentimento. Suporta revogação. Mirror do result_tokens.';

CREATE INDEX idx_pct_tenant_status
  ON parental_consent_tokens (tenant_id, status);
CREATE INDEX idx_pct_consent
  ON parental_consent_tokens (parental_consent_id);
CREATE INDEX idx_pct_active_expires
  ON parental_consent_tokens (expires_at)
  WHERE status = 'active';

-- ============================================================
-- 7. parental_consent_revocations
-- ============================================================
CREATE TABLE parental_consent_revocations (
  id                    uuid                       NOT NULL DEFAULT uuid_generate_v7(),
  tenant_id             uuid                       NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  parental_consent_id   uuid                       NOT NULL REFERENCES parental_consents (id) ON DELETE CASCADE,
  consent_token_id      uuid                                REFERENCES parental_consent_tokens (jti) ON DELETE SET NULL,
  actor_type            consent_revocation_actor   NOT NULL,
  actor_ref_hmac        text,
  reason_code           text                       NOT NULL DEFAULT 'CONSENT_REVOKED',
  reason_text           text,
  effective_at          timestamptz                NOT NULL DEFAULT now(),
  webhook_dispatched_at timestamptz,
  created_at            timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT parental_consent_revocations_pkey PRIMARY KEY (id),
  CONSTRAINT parental_consent_revocations_actor_hmac_format
    CHECK (actor_ref_hmac IS NULL OR actor_ref_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT parental_consent_revocations_reason_text_max
    CHECK (reason_text IS NULL OR length(reason_text) <= 500)
);

COMMENT ON TABLE  parental_consent_revocations IS
  'Histórico imutável de revogações de consentimento. APPEND-ONLY.';

CREATE INDEX idx_pcrev_tenant_created
  ON parental_consent_revocations (tenant_id, created_at DESC);
CREATE INDEX idx_pcrev_consent
  ON parental_consent_revocations (parental_consent_id);

-- Block UPDATE/DELETE.
CREATE TRIGGER trg_pcrev_no_update
  BEFORE UPDATE ON parental_consent_revocations
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

CREATE TRIGGER trg_pcrev_no_delete
  BEFORE DELETE ON parental_consent_revocations
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE parental_consent_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_contacts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_verifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_text_versions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consent_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consent_revocations    ENABLE ROW LEVEL SECURITY;

-- All writes flow through edge functions using the service-role client which
-- bypasses RLS; tenant-side reads are scoped strictly by current_tenant_id().

CREATE POLICY pcr_select ON parental_consent_requests
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY pcr_insert ON parental_consent_requests
  FOR INSERT WITH CHECK (false);
CREATE POLICY pcr_update ON parental_consent_requests
  FOR UPDATE USING (false);

CREATE POLICY gc_select ON guardian_contacts
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );
CREATE POLICY gc_insert ON guardian_contacts
  FOR INSERT WITH CHECK (false);
CREATE POLICY gc_update ON guardian_contacts
  FOR UPDATE USING (false);

CREATE POLICY gv_select ON guardian_verifications
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );
CREATE POLICY gv_insert ON guardian_verifications
  FOR INSERT WITH CHECK (false);
CREATE POLICY gv_update ON guardian_verifications
  FOR UPDATE USING (false);

CREATE POLICY ctv_select ON consent_text_versions
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY ctv_insert ON consent_text_versions
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id() AND has_role('admin')
  );
CREATE POLICY ctv_update ON consent_text_versions
  FOR UPDATE USING (
    tenant_id = current_tenant_id() AND has_role('admin')
  );

CREATE POLICY pc_select ON parental_consents
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY pc_insert ON parental_consents
  FOR INSERT WITH CHECK (false);
CREATE POLICY pc_update ON parental_consents
  FOR UPDATE USING (false);

CREATE POLICY pct_select ON parental_consent_tokens
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY pct_insert ON parental_consent_tokens
  FOR INSERT WITH CHECK (false);
CREATE POLICY pct_update ON parental_consent_tokens
  FOR UPDATE USING (false);

CREATE POLICY pcrev_select ON parental_consent_revocations
  FOR SELECT USING (
    tenant_id = current_tenant_id() AND has_role('auditor')
  );
CREATE POLICY pcrev_insert ON parental_consent_revocations
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- AUDIT TRIGGERS — append a row to audit_events on lifecycle changes.
-- The diff_json is whitelisted (matches consentEnvelopeAuditDiff in TS).
-- ============================================================

CREATE OR REPLACE FUNCTION audit_parental_consent_change()
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
  IF TG_TABLE_NAME = 'parental_consents' THEN
    v_id     := COALESCE(NEW.id, OLD.id);
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    IF TG_OP = 'INSERT' THEN
      v_action := 'parental_consent.created';
      v_diff := jsonb_build_object(
        'decision_domain', 'parental_consent',
        'envelope_version', 1,
        'consent_request_id', NEW.consent_request_id,
        'parental_consent_id', NEW.id,
        'application_id', NEW.application_id,
        'policy_id', NEW.policy_id,
        'policy_version', NEW.policy_version,
        'resource', NEW.resource,
        'scope', NEW.scope,
        'risk_tier', NEW.risk_tier,
        'method', NEW.method,
        'assurance_level', NEW.assurance_level,
        'consent_text_hash', NEW.consent_text_hash,
        'proof_hash', NEW.proof_hash,
        'issued_at', extract(epoch FROM NEW.issued_at)::bigint,
        'expires_at', extract(epoch FROM NEW.expires_at)::bigint,
        'status', NEW.status,
        'content_included', false,
        'pii_included', false
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'parental_consent.status_changed';
      v_diff := jsonb_build_object(
        'parental_consent_id', NEW.id,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'revoked_at',
          CASE WHEN NEW.revoked_at IS NULL THEN NULL
               ELSE NEW.revoked_at::text END,
        'content_included', false,
        'pii_included', false
      );
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF TG_TABLE_NAME = 'parental_consent_revocations' THEN
    v_id     := NEW.id;
    v_tenant := NEW.tenant_id;
    v_action := 'parental_consent.revoked';
    v_diff := jsonb_build_object(
      'revocation_id', NEW.id,
      'parental_consent_id', NEW.parental_consent_id,
      'consent_token_id', NEW.consent_token_id,
      'actor_type', NEW.actor_type,
      'reason_code', NEW.reason_code,
      'effective_at', NEW.effective_at::text,
      'content_included', false,
      'pii_included', false
    );
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO audit_events (
    tenant_id, actor_type, actor_id, action, resource_type, resource_id, diff_json
  ) VALUES (
    v_tenant,
    'system',
    NULL,
    v_action,
    'parental_consent',
    v_id,
    v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_parental_consents
  AFTER INSERT OR UPDATE ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION audit_parental_consent_change();

CREATE TRIGGER trg_audit_parental_consent_revocations
  AFTER INSERT ON parental_consent_revocations
  FOR EACH ROW EXECUTE FUNCTION audit_parental_consent_change();

-- ============================================================
-- WEBHOOK ENQUEUE — `parental_consent.*` events into webhook_deliveries.
-- Mirrors `fan_out_verification_webhooks` (012_webhook_enqueue.sql) but for
-- the consent domain. Payload follows WebhookParentalConsentEventSchema in
-- packages/shared/src/webhooks/webhook-types.ts.
-- ============================================================

CREATE OR REPLACE FUNCTION build_parental_consent_event_payload(
  p_consent_id uuid,
  p_event_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_payload jsonb;
  v_decision text;
  v_reason_code text;
BEGIN
  SELECT
    CASE pc.status
      WHEN 'active'   THEN 'approved'
      WHEN 'denied'   THEN 'denied'
      WHEN 'revoked'  THEN 'revoked'
      WHEN 'expired'  THEN 'expired'
      ELSE 'pending'
    END,
    CASE pc.status
      WHEN 'active'   THEN 'CONSENT_GRANTED'
      WHEN 'denied'   THEN 'CONSENT_DENIED'
      WHEN 'revoked'  THEN 'CONSENT_REVOKED'
      WHEN 'expired'  THEN 'CONSENT_EXPIRED'
      ELSE 'CONSENT_NOT_GIVEN'
    END
  INTO v_decision, v_reason_code
  FROM parental_consents pc
  WHERE pc.id = p_consent_id;

  SELECT jsonb_build_object(
    'event_id', uuid_generate_v7(),
    'event_type', p_event_type,
    'created_at', to_char(now() AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'tenant_id', pc.tenant_id,
    'application_id', pc.application_id,
    'decision', v_decision,
    'consent_request_id', pc.consent_request_id,
    'consent_token_id', (
      SELECT pct.jti FROM parental_consent_tokens pct
      WHERE  pct.parental_consent_id = pc.id
      ORDER BY pct.issued_at DESC LIMIT 1
    ),
    'policy_id', pc.policy_id,
    'policy_version', pc.policy_version,
    'resource', pc.resource,
    'reason_codes', jsonb_build_array(v_reason_code),
    -- payload_hash anchors the receipt — the edge function stores its own
    -- canonical envelope hash; SQL provides a deterministic best-effort hash
    -- over (proof_hash || consent_text_hash || status) so receivers can
    -- verify the payload matches the stored consent.
    'payload_hash', encode(
      digest(
        coalesce(pc.proof_hash, '') ||
        coalesce(pc.consent_text_hash, '') ||
        pc.status::text, 'sha256'),
      'hex'
    ),
    'pii_included', false,
    'content_included', false
  )
  INTO v_payload
  FROM parental_consents pc
  WHERE pc.id = p_consent_id;

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION fan_out_parental_consent_webhooks()
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
    IF NEW.status = 'active' THEN
      v_event_type := 'parental_consent.approved';
    ELSIF NEW.status = 'denied' THEN
      v_event_type := 'parental_consent.denied';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'revoked' THEN
      v_event_type := 'parental_consent.revoked';
    ELSIF NEW.status = 'expired' THEN
      v_event_type := 'parental_consent.expired';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_payload      := build_parental_consent_event_payload(NEW.id, v_event_type);
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

COMMENT ON FUNCTION fan_out_parental_consent_webhooks IS
  'AFTER INSERT/UPDATE em parental_consents: enfileira webhook_deliveries por endpoint subscrito.';

CREATE TRIGGER trg_parental_consents_fanout
  AFTER INSERT OR UPDATE ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION fan_out_parental_consent_webhooks();
