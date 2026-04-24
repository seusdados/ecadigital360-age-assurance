-- Migration: 009_triggers
-- Triggers de:
--   1. updated_at automático em tabelas mutáveis
--   2. Imutabilidade (append-only) em tabelas de evidência
--   3. Auditoria automática em tabelas sensíveis
--   4. Versionamento automático de policies
--   5. Incremento de usage_counters em billing_events
--   6. Expiração automática de verification_sessions

-- ============================================================
-- 1. UPDATED_AT automático
-- Aplica-se a todas as tabelas mutáveis com a coluna updated_at.
-- ============================================================
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'tenants', 'tenant_users', 'applications',
    'policies', 'trust_lists',
    'issuers', 'webhook_endpoints',
    'rate_limit_buckets', 'crypto_keys'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 2. IMUTABILIDADE — bloqueia UPDATE e DELETE em tabelas de evidência
-- ============================================================
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'verification_results',
    'audit_events',
    'billing_events',
    'revocations',
    'policy_versions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_immutable
       BEFORE UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION prevent_update_delete()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- Exceção para result_tokens: permite UPDATE apenas de revoked_at/revoked_reason
-- (revogação legítima). Bloqueia alterações em qualquer outro campo.
CREATE OR REPLACE FUNCTION guard_result_token_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.jti             IS DISTINCT FROM OLD.jti            OR
     NEW.session_id      IS DISTINCT FROM OLD.session_id     OR
     NEW.tenant_id       IS DISTINCT FROM OLD.tenant_id      OR
     NEW.application_id  IS DISTINCT FROM OLD.application_id OR
     NEW.kid             IS DISTINCT FROM OLD.kid            OR
     NEW.issued_at       IS DISTINCT FROM OLD.issued_at      OR
     NEW.expires_at      IS DISTINCT FROM OLD.expires_at
  THEN
    RAISE EXCEPTION 'result_tokens: apenas revoked_at e revoked_reason podem ser alterados.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Revogação só avança (não pode "des-revogar")
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'result_tokens: token já revogado não pode ser reativado.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_result_tokens_guard
  BEFORE UPDATE ON result_tokens
  FOR EACH ROW EXECUTE FUNCTION guard_result_token_update();

-- ============================================================
-- 3. AUDITORIA AUTOMÁTICA
-- Gera um registro em audit_events para INSERT/UPDATE/DELETE
-- em tabelas sensíveis.  Roda como SECURITY DEFINER para
-- contornar RLS (audit_events só pode ser inserido por sistema).
-- ============================================================
CREATE OR REPLACE FUNCTION audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_label text;
  diff         jsonb := '{}';
  actor        uuid;
  actor_t      audit_actor_type;
BEGIN
  action_label := TG_TABLE_NAME || '.' || lower(TG_OP);

  -- Tenta obter o usuário corrente
  actor := auth.uid();
  IF actor IS NOT NULL THEN
    actor_t := 'user';
  ELSE
    actor_t := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    diff := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- diff: apenas chaves cujos valores mudaram
    SELECT jsonb_object_agg(key, value)
    INTO diff
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key;
  ELSIF TG_OP = 'DELETE' THEN
    diff := jsonb_build_object('deleted', to_jsonb(OLD));
  END IF;

  -- Remove campos potencialmente sensíveis do diff
  diff := diff
    - 'api_key_hash'
    - 'webhook_secret_hash'
    - 'secret_hash'
    - 'private_key_enc'
    - 'private_key_iv'
    - 'password';

  INSERT INTO audit_events (
    tenant_id, actor_type, actor_id,
    action, resource_type, resource_id,
    diff_json
  ) VALUES (
    COALESCE(
      (to_jsonb(COALESCE(NEW, OLD)) ->> 'tenant_id')::uuid,
      current_tenant_id()
    ),
    actor_t,
    actor,
    action_label,
    TG_TABLE_NAME,
    (to_jsonb(COALESCE(NEW, OLD)) ->> 'id')::uuid,
    diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplica o trigger de auditoria nas tabelas sensíveis
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'tenants', 'applications', 'policies',
    'issuers', 'trust_lists', 'crypto_keys',
    'webhook_endpoints'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_audit
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION audit_log()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 4. VERSIONAMENTO AUTOMÁTICO DE POLICIES
-- Ao atualizar uma policy, cria um snapshot em policy_versions
-- e incrementa current_version.
-- ============================================================
CREATE OR REPLACE FUNCTION version_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    NEW.current_version := OLD.current_version + 1;
    INSERT INTO policy_versions (policy_id, version, snapshot_json, created_by)
    VALUES (
      NEW.id,
      NEW.current_version,
      to_jsonb(NEW),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_policies_version
  BEFORE UPDATE ON policies
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION version_policy();

-- Cria versão 1 na inserção
CREATE OR REPLACE FUNCTION init_policy_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO policy_versions (policy_id, version, snapshot_json, created_by)
  VALUES (NEW.id, 1, to_jsonb(NEW), auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_policies_init_version
  AFTER INSERT ON policies
  FOR EACH ROW EXECUTE FUNCTION init_policy_version();

-- ============================================================
-- 5. USAGE_COUNTERS — upsert diário por (tenant, application)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_usage_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_delta int := CASE WHEN NEW.decision = 'approved' THEN 1 ELSE 0 END;
  v_denied_delta   int := CASE WHEN NEW.decision = 'denied'   THEN 1 ELSE 0 END;
BEGIN
  INSERT INTO usage_counters (
    tenant_id, application_id, day,
    verifications_created, verifications_approved, verifications_denied, tokens_issued
  )
  VALUES (
    NEW.tenant_id, NEW.application_id,
    date_trunc('day', NEW.created_at AT TIME ZONE 'UTC')::date,
    1, v_approved_delta, v_denied_delta, v_approved_delta
  )
  ON CONFLICT (tenant_id, application_id, day) DO UPDATE SET
    verifications_created  = usage_counters.verifications_created  + 1,
    verifications_approved = usage_counters.verifications_approved + v_approved_delta,
    verifications_denied   = usage_counters.verifications_denied   + v_denied_delta,
    tokens_issued          = usage_counters.tokens_issued          + v_approved_delta;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_billing_events_usage
  AFTER INSERT ON billing_events
  FOR EACH ROW EXECUTE FUNCTION increment_usage_counter();

-- ============================================================
-- 6. EXPIRAÇÃO AUTOMÁTICA DE SESSIONS
-- Job pg_cron que marca sessões expiradas como 'expired'.
-- ============================================================
SELECT cron.schedule(
  'expire-verification-sessions',
  '*/2 * * * *',  -- a cada 2 minutos
  $$
    UPDATE verification_sessions
    SET    status = 'expired', updated_at = now()
    WHERE  status = 'pending'
      AND  expires_at < now();
  $$
);
