-- Migration: 000_bootstrap
-- Habilita extensões, cria tipos/enums globais e funções utilitárias.
-- Deve ser a primeira migration aplicada em qualquer ambiente.

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- pg_cron para jobs agendados (retention, key-rotation, expiração de sessões).
-- IMPORTANTE: em Supabase Cloud, pg_cron precisa ser ativado manualmente
-- uma única vez em Dashboard > Database > Extensions antes desta migration.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_partman: adiado para Fase 2 — Fase 1 usa partições pré-criadas manualmente.

-- ============================================================
-- UUID v7 — ordenável por tempo, melhor para índices B-tree
-- Fallback puro PL/pgSQL quando pg_uuidv7 não está disponível
--
-- NOTA Supabase: pgcrypto instala suas funções no schema `extensions`,
-- não em `public`. Por isso esta função (e todas as outras que usam
-- gen_random_bytes/digest/hmac) define `SET search_path` explicitamente
-- — caso contrário falha ao executar quando o caller tem search_path
-- diferente do nosso.
-- ============================================================
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE PARALLEL SAFE
SET search_path = public, extensions
AS $$
DECLARE
  unix_ms  bigint;
  hi       bytea;
  lo       bytea;
  raw      bytea;
BEGIN
  unix_ms := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  -- 6 bytes do timestamp (ms), 10 bytes aleatórios
  hi  := substring(int8send(unix_ms) FROM 3 FOR 6);
  lo  := gen_random_bytes(10);
  raw := hi || lo;
  -- version nibble (4 bits altos do byte 6) = 0x7
  raw := set_byte(raw, 6, (get_byte(raw, 6) & x'0f'::int) | x'70'::int);
  -- variant bits (2 bits altos do byte 8) = 0b10
  raw := set_byte(raw, 8, (get_byte(raw, 8) & x'3f'::int) | x'80'::int);
  RETURN encode(raw, 'hex')::uuid;
END;
$$;

COMMENT ON FUNCTION uuid_generate_v7() IS
  'Gera UUID versão 7 (time-ordered). Usa timestamp em ms + bytes aleatórios.';

-- ============================================================
-- ENUMS GLOBAIS
--
-- DROP IF EXISTS antes de CREATE para tornar o passo idempotente —
-- se a 000 falhou no meio em uma execução anterior, re-aplicar não
-- crasheia em "type already exists". CASCADE remove dependências
-- (funções/tabelas que referenciam o tipo serão recriadas pelas
-- migrations subsequentes ou pelas próximas linhas desta migration).
-- ============================================================
DROP TYPE IF EXISTS tenant_user_role        CASCADE;
DROP TYPE IF EXISTS tenant_status           CASCADE;
DROP TYPE IF EXISTS application_status      CASCADE;
DROP TYPE IF EXISTS verification_method     CASCADE;
DROP TYPE IF EXISTS session_status          CASCADE;
DROP TYPE IF EXISTS verification_decision   CASCADE;
DROP TYPE IF EXISTS assurance_level         CASCADE;
DROP TYPE IF EXISTS token_status            CASCADE;
DROP TYPE IF EXISTS issuer_trust_status     CASCADE;
DROP TYPE IF EXISTS crypto_key_status       CASCADE;
DROP TYPE IF EXISTS webhook_delivery_status CASCADE;
DROP TYPE IF EXISTS audit_actor_type        CASCADE;
DROP TYPE IF EXISTS trust_override          CASCADE;

-- Papéis de usuário dentro de um tenant
CREATE TYPE tenant_user_role AS ENUM (
  'owner', 'admin', 'operator', 'auditor', 'billing'
);

-- Status do tenant
CREATE TYPE tenant_status AS ENUM (
  'active', 'suspended', 'pending_setup', 'closed'
);

-- Status de aplicação
CREATE TYPE application_status AS ENUM (
  'active', 'inactive', 'suspended'
);

-- Métodos de verificação suportados
CREATE TYPE verification_method AS ENUM (
  'zkp', 'vc', 'gateway', 'fallback'
);

-- Status de uma sessão de verificação
CREATE TYPE session_status AS ENUM (
  'pending', 'in_progress', 'completed', 'expired', 'cancelled'
);

-- Decisão de verificação
CREATE TYPE verification_decision AS ENUM (
  'approved', 'denied', 'needs_review'
);

-- Nível de assurance (eIDAS / NIST 800-63)
CREATE TYPE assurance_level AS ENUM (
  'low', 'substantial', 'high'
);

-- Status de token de resultado
CREATE TYPE token_status AS ENUM (
  'active', 'revoked', 'expired'
);

-- Status de issuer no trust registry
CREATE TYPE issuer_trust_status AS ENUM (
  'trusted', 'suspended', 'untrusted'
);

-- Status de chave criptográfica
CREATE TYPE crypto_key_status AS ENUM (
  'rotating', 'active', 'retired'
);

-- Status de entrega de webhook
CREATE TYPE webhook_delivery_status AS ENUM (
  'pending', 'delivered', 'failed', 'dead_letter'
);

-- Tipo de ator em eventos de auditoria
CREATE TYPE audit_actor_type AS ENUM (
  'user', 'api_key', 'system', 'cron'
);

-- Override de confiança por tenant
CREATE TYPE trust_override AS ENUM (
  'trust', 'distrust'
);

-- ============================================================
-- FUNÇÃO: current_tenant_id()
-- Lê o tenant atual do contexto da sessão Postgres (SET LOCAL).
-- Edge Functions setam: SET LOCAL app.current_tenant_id = '<uuid>';
-- ============================================================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v text;
BEGIN
  v := current_setting('app.current_tenant_id', true);
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

-- ============================================================
-- FUNÇÃO: has_role(required text)
-- Verifica se o usuário corrente tem o papel exigido no tenant.
-- Ordem de precedência: owner > admin > operator > auditor > billing
--
-- IMPORTANTE: declarada como plpgsql (não sql) porque o corpo
-- referencia tenant_users, que só é criado em 001_tenancy.sql.
-- Funções SQL validam dependências de tabelas na hora do CREATE;
-- funções plpgsql só validam quando executadas, então a ordem
-- entre migrations não é problema.
-- ============================================================
CREATE OR REPLACE FUNCTION has_role(required tenant_user_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tenant_users tu
    WHERE tu.tenant_id = current_tenant_id()
      AND tu.user_id   = auth.uid()
      AND (
        -- owner tem tudo
        tu.role = 'owner'
        OR tu.role = required
        -- admin tem tudo exceto 'owner'
        OR (tu.role = 'admin' AND required != 'owner')
      )
  );
END;
$$;

-- ============================================================
-- FUNÇÃO: set_updated_at()
-- Trigger function que seta updated_at = now() antes de UPDATE.
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- FUNÇÃO: prevent_update_delete()
-- Bloqueia UPDATE e DELETE em tabelas imutáveis (evidências).
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Tabela % é append-only — UPDATE não permitido.', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Tabela % é append-only — DELETE não permitido.', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================
-- FUNÇÃO: sha256_hex(val text)
-- Hash SHA-256 como hex string. Usado para api_key_hash, etc.
-- SET search_path explícito porque digest() vive em `extensions`.
-- ============================================================
CREATE OR REPLACE FUNCTION sha256_hex(val text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(val, 'sha256'), 'hex');
$$;
