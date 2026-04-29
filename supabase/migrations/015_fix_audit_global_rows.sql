-- Migration: 015_fix_audit_global_rows
--
-- Bug: o trigger audit_log() (definido em 009_triggers.sql) tenta inserir
-- em audit_events com tenant_id NULL em dois cenários legítimos:
--
--   1. Rows globais (tenant_id IS NULL na própria row) — aplicável a:
--      - issuers globais do trust registry (mantidos pelo time AgeKey)
--      - policies templates (is_template = true, tenant_id IS NULL)
--      - crypto_keys (chaves de assinatura do AgeKey, sempre globais)
--
--   2. Tabela `tenants` em si — não tem coluna tenant_id; o ID da row
--      É o tenant_id, mas a expressão `to_jsonb(NEW) ->> 'tenant_id'`
--      retorna NULL.
--
-- Em ambos os casos, current_tenant_id() (lê SET LOCAL) também é NULL
-- quando a operação roda fora de uma sessão Edge Function (seeds, SQL
-- Editor, migrations, etc.). audit_events.tenant_id NOT NULL → falha.
--
-- Reproduzido pelo Marcel: INSERT issuers globais (seed 02) e INSERT
-- policy templates (seed 03) falham com SQLSTATE 23502.
--
-- Fix:
--   - Tabela 'tenants': usa NEW.id como tenant_id no audit_events.
--   - Demais tabelas com NULL tenant_id: SKIP audit (return sem insert).
--     Mudanças em rows globais são feitas pelo time da plataforma e
--     auditadas em outro nível (logs do Dashboard/admin do Supabase).

CREATE OR REPLACE FUNCTION audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_label       text;
  diff               jsonb := '{}';
  actor              uuid;
  actor_t            audit_actor_type;
  resolved_tenant_id uuid;
BEGIN
  action_label := TG_TABLE_NAME || '.' || lower(TG_OP);

  actor := auth.uid();
  IF actor IS NOT NULL THEN
    actor_t := 'user';
  ELSE
    actor_t := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    diff := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, value)
    INTO diff
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key;
  ELSIF TG_OP = 'DELETE' THEN
    diff := jsonb_build_object('deleted', to_jsonb(OLD));
  END IF;

  -- Strip campos sensíveis do diff
  diff := diff
    - 'api_key_hash'
    - 'webhook_secret_hash'
    - 'secret_hash'
    - 'private_key_enc'
    - 'private_key_iv'
    - 'password';

  -- Resolver tenant_id do audit:
  --   1. Tabela 'tenants': a row É o tenant, então tenant_id = NEW.id
  --   2. Demais tabelas: prefere row.tenant_id, fallback current_tenant_id()
  IF TG_TABLE_NAME = 'tenants' THEN
    resolved_tenant_id := (to_jsonb(COALESCE(NEW, OLD)) ->> 'id')::uuid;
  ELSE
    resolved_tenant_id := COALESCE(
      (to_jsonb(COALESCE(NEW, OLD)) ->> 'tenant_id')::uuid,
      current_tenant_id()
    );
  END IF;

  -- Pula audit para rows globais (sem tenant identificável). Mudanças em
  -- issuers globais, policies templates e crypto_keys são feitas pelo time
  -- da plataforma e auditadas via logs do Supabase Dashboard.
  IF resolved_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO audit_events (
    tenant_id, actor_type, actor_id,
    action, resource_type, resource_id,
    diff_json
  ) VALUES (
    resolved_tenant_id,
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

COMMENT ON FUNCTION audit_log IS
  'Trigger function que escreve em audit_events. Pula rows globais
   (tenant_id NULL) e usa NEW.id como tenant_id quando TG_TABLE_NAME = tenants.';
