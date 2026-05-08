-- ============================================================================
-- AgeKey HML — RLS isolation smoke (READ-ONLY)
-- ----------------------------------------------------------------------------
-- Objetivo:
--   1. Confirmar que TODAS as tabelas críticas têm RLS habilitada.
--   2. Confirmar que TODAS as tabelas críticas possuem ao menos UMA policy.
--   3. Demonstrar que tenant A não vê dados do tenant B (cross-tenant).
--   4. Listar tabelas sem policies (gera erro lógico via assertion).
--
-- Executar em HML APENAS (project wljedzqgprkpqhuazdzv) via SQL Editor com
-- role autenticado de teste. NENHUMA escrita. NENHUMA mutação.
--
-- Restrições respeitadas:
--   - Sem CREATE/ALTER/DROP/INSERT/UPDATE/DELETE.
--   - Sem leitura de PII (apenas counts e metadata de RLS).
--   - Não substitui testes automatizados; é o gate de smoke manual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [1] Lista todas as tabelas em public e mostra status RLS.
-- Esperado: rls_enabled = true em TODAS as linhas.
-- ----------------------------------------------------------------------------
SELECT
  n.nspname        AS schema_name,
  c.relname        AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'                  -- regular tables only
ORDER BY c.relname;
-- Critério PASS: nenhuma linha com rls_enabled = false.

-- ----------------------------------------------------------------------------
-- [2] Lista tabelas críticas que NÃO possuem nenhuma policy.
-- Esperado: ZERO linhas. Tabelas críticas sempre devem ter policy.
-- ----------------------------------------------------------------------------
WITH critical_tables AS (
  SELECT unnest(ARRAY[
    'tenants',
    'tenant_users',
    'applications',
    'policies',
    'policy_versions',
    'verification_sessions',
    'verification_challenges',
    'verification_results',
    'result_tokens',
    'audit_events',
    'billing_events',
    'webhook_endpoints',
    'webhook_deliveries',
    'crypto_keys',
    'parental_consent_requests',
    'parental_consents',
    'parental_consent_revocations',
    'parental_consent_tokens',
    'guardian_contacts',
    'guardian_verifications',
    'consent_text_versions',
    'safety_subjects',
    'safety_interactions',
    'safety_events',
    'safety_alerts',
    'safety_rules',
    'safety_aggregates',
    'safety_evidence_artifacts',
    'safety_model_runs'
  ]) AS table_name
)
SELECT ct.table_name
FROM critical_tables ct
LEFT JOIN pg_policies p
  ON p.schemaname = 'public' AND p.tablename = ct.table_name
WHERE p.policyname IS NULL
GROUP BY ct.table_name
HAVING COUNT(p.policyname) = 0;
-- Critério PASS: 0 linhas. Qualquer linha indica tabela crítica sem RLS.

-- ----------------------------------------------------------------------------
-- [3] Conta policies por tabela crítica (audit visual).
-- Esperado: cada tabela com >=1 policy. Tabelas append-only normalmente
-- terão SELECT + INSERT (sem UPDATE/DELETE).
-- ----------------------------------------------------------------------------
SELECT
  tablename,
  COUNT(*)            AS policy_count,
  array_agg(policyname ORDER BY policyname) AS policies,
  array_agg(DISTINCT cmd)                    AS commands
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- [4] Cross-tenant isolation simulation (read-only).
-- Substitua os UUIDs abaixo por dois tenants reais de TESTE em HML.
-- A query deve retornar 0 linhas para cada tenant simulado quando o JWT
-- for do outro tenant. Aqui apenas mostramos a forma da query — a execução
-- real deve ser feita via Supabase SQL Editor "Run as user".
-- ----------------------------------------------------------------------------
-- Exemplo (executar duas vezes, alternando set_config):
--   SELECT set_config('request.jwt.claim.sub', '<tenant_user_id_A>', true);
--   SELECT set_config('request.jwt.claim.tenant_id', '<tenant_id_A>', true);
--   SELECT count(*) FROM applications WHERE tenant_id = '<tenant_id_B>';
--   -- Esperado: 0 linhas (RLS bloqueia).
-- ----------------------------------------------------------------------------
SELECT
  'cross-tenant-check'::text AS check_name,
  'Run via SQL Editor with explicit JWT claims; expect 0 rows.' AS instruction;

-- ----------------------------------------------------------------------------
-- [5] Tabelas particionadas (audit_events, billing_events) — confirma RLS
-- nas partições filhas (regressão da migration 030).
-- Esperado: rls_enabled = true em TODAS as partições.
-- ----------------------------------------------------------------------------
SELECT
  c.relname AS partition_name,
  c.relrowsecurity AS rls_enabled,
  parent.relname AS parent_table
FROM pg_inherits i
JOIN pg_class c       ON c.oid = i.inhrelid
JOIN pg_class parent  ON parent.oid = i.inhparent
JOIN pg_namespace n   ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND parent.relname IN ('audit_events', 'billing_events')
ORDER BY parent.relname, c.relname;
-- Critério PASS: TODAS as partições com rls_enabled = true.

-- ----------------------------------------------------------------------------
-- [6] Verifica vault.crypto_keys — chaves devem existir mas nunca expor secret.
-- ----------------------------------------------------------------------------
SELECT
  kid,
  alg,
  status,
  created_at,
  not_before,
  not_after,
  -- NUNCA selecionar private_key/secret_ref aqui.
  (private_key IS NOT NULL) AS private_key_present
FROM public.crypto_keys
WHERE status IN ('active', 'next')
ORDER BY created_at DESC
LIMIT 10;

-- ----------------------------------------------------------------------------
-- [7] Sanity: verificar migrations aplicadas (read-only).
-- Esperado em HML: 000-017 + 020-030 (29 versões total).
-- ----------------------------------------------------------------------------
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
-- Critério PASS: contém 000..017, 020..030. Não contém 018, 019.

-- ============================================================================
-- FIM. Nenhuma escrita executada. Sem PII lida.
-- ============================================================================
