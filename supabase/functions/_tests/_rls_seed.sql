-- _rls_seed.sql
-- Seed determinístico para a suíte cross-tenant RLS.
-- Idempotente: apaga tudo e reinsere — assume DB já com migrations aplicadas
-- (000..016) e roda como superuser/service_role (postgres).
--
-- IDs fixos para asserções estáveis nos testes.
--
-- NÃO usar em staging/prod. Apenas via CI ou pnpm test:rls local.

BEGIN;

-- Limpa qualquer corrida anterior (CASCADE remove sessions, results, tokens, etc.)
DELETE FROM tenants WHERE slug IN ('rls-test-a', 'rls-test-b');

-- ============================================================
-- Usuários auth stub (necessários para tenant_users.user_id FK + has_role())
--
-- Insere apenas a coluna obrigatória `id`. Em Supabase local todas as
-- demais colunas de auth.users são NULL/default, então um INSERT mínimo
-- satisfaz a FK sem depender de schema versionado.
-- ============================================================
INSERT INTO auth.users (id)
VALUES
  ('11111111-1111-7111-8111-111111111111'),
  ('22222222-2222-7222-8222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TENANTS
-- ============================================================
INSERT INTO tenants (id, name, slug, status, retention_days, plan)
VALUES
  ('aaaaaaaa-0000-7000-8000-000000000001', 'RLS Test Tenant A', 'rls-test-a', 'active', 30, 'test'),
  ('bbbbbbbb-0000-7000-8000-000000000002', 'RLS Test Tenant B', 'rls-test-b', 'active', 30, 'test');

-- ============================================================
-- TENANT_USERS (admin de cada tenant)
-- ============================================================
INSERT INTO tenant_users (tenant_id, user_id, role)
VALUES
  ('aaaaaaaa-0000-7000-8000-000000000001', '11111111-1111-7111-8111-111111111111', 'admin'),
  ('bbbbbbbb-0000-7000-8000-000000000002', '22222222-2222-7222-8222-222222222222', 'admin');

-- ============================================================
-- APPLICATIONS
-- ============================================================
INSERT INTO applications (
  id, tenant_id, name, slug, api_key_hash, api_key_prefix
)
VALUES
  ('aaaaaaaa-1000-7000-8000-000000000001',
   'aaaaaaaa-0000-7000-8000-000000000001',
   'A app', 'a-app',
   sha256_hex('rls_test_key_a_0000000000000000'),
   'ak_test_a_'),
  ('bbbbbbbb-1000-7000-8000-000000000002',
   'bbbbbbbb-0000-7000-8000-000000000002',
   'B app', 'b-app',
   sha256_hex('rls_test_key_b_0000000000000000'),
   'ak_test_b_');

-- ============================================================
-- POLICIES (não-template, por tenant)
-- ============================================================
INSERT INTO policies (
  id, tenant_id, name, slug, age_threshold, jurisdiction_code,
  required_assurance_level, token_ttl_seconds, is_template
)
VALUES
  ('aaaaaaaa-2000-7000-8000-000000000001',
   'aaaaaaaa-0000-7000-8000-000000000001',
   'A 18+', 'a-18-plus', 18, 'BR', 'low', 3600, false),
  ('bbbbbbbb-2000-7000-8000-000000000002',
   'bbbbbbbb-0000-7000-8000-000000000002',
   'B 18+', 'b-18-plus', 18, 'BR', 'low', 3600, false);

-- ============================================================
-- VERIFICATION_SESSIONS + CHALLENGES + RESULTS + TOKENS
--
-- policy_version_id é resolvido via subquery: o trigger
-- init_policy_version (009_triggers.sql) cria policy_versions.version=1
-- automaticamente após o INSERT em policies acima.
-- ============================================================
INSERT INTO verification_sessions (
  id, tenant_id, application_id, policy_id, policy_version_id,
  status, method, external_user_ref
)
VALUES
  ('aaaaaaaa-3000-7000-8000-000000000001',
   'aaaaaaaa-0000-7000-8000-000000000001',
   'aaaaaaaa-1000-7000-8000-000000000001',
   'aaaaaaaa-2000-7000-8000-000000000001',
   (SELECT id FROM policy_versions
    WHERE policy_id = 'aaaaaaaa-2000-7000-8000-000000000001'
    ORDER BY version DESC LIMIT 1),
   'completed', 'fallback', 'opaque-ref-a'),
  ('bbbbbbbb-3000-7000-8000-000000000002',
   'bbbbbbbb-0000-7000-8000-000000000002',
   'bbbbbbbb-1000-7000-8000-000000000002',
   'bbbbbbbb-2000-7000-8000-000000000002',
   (SELECT id FROM policy_versions
    WHERE policy_id = 'bbbbbbbb-2000-7000-8000-000000000002'
    ORDER BY version DESC LIMIT 1),
   'completed', 'fallback', 'opaque-ref-b');

INSERT INTO verification_challenges (id, session_id, nonce)
VALUES
  ('aaaaaaaa-4000-7000-8000-000000000001',
   'aaaaaaaa-3000-7000-8000-000000000001',
   'nonce-tenant-a-0001'),
  ('bbbbbbbb-4000-7000-8000-000000000002',
   'bbbbbbbb-3000-7000-8000-000000000002',
   'nonce-tenant-b-0002');

INSERT INTO verification_results (
  id, session_id, tenant_id, decision, threshold_satisfied,
  assurance_level, method, reason_code
)
VALUES
  ('aaaaaaaa-5000-7000-8000-000000000001',
   'aaaaaaaa-3000-7000-8000-000000000001',
   'aaaaaaaa-0000-7000-8000-000000000001',
   'approved', true, 'low', 'fallback', 'FALLBACK_DECLARATION_ACCEPTED'),
  ('bbbbbbbb-5000-7000-8000-000000000002',
   'bbbbbbbb-3000-7000-8000-000000000002',
   'bbbbbbbb-0000-7000-8000-000000000002',
   'approved', true, 'low', 'fallback', 'FALLBACK_DECLARATION_ACCEPTED');

-- crypto_key stub para FK em result_tokens.kid
INSERT INTO crypto_keys (
  kid, algorithm, status, public_jwk_json, private_key_enc, private_key_iv, activated_at
)
VALUES
  ('rls-test-kid-1', 'ES256', 'active', '{}'::jsonb, 'stub', 'stub', now())
ON CONFLICT (kid) DO NOTHING;

INSERT INTO result_tokens (
  jti, session_id, tenant_id, application_id, kid, expires_at
)
VALUES
  ('aaaaaaaa-6000-7000-8000-000000000001',
   'aaaaaaaa-3000-7000-8000-000000000001',
   'aaaaaaaa-0000-7000-8000-000000000001',
   'aaaaaaaa-1000-7000-8000-000000000001',
   'rls-test-kid-1',
   now() + interval '1 hour'),
  ('bbbbbbbb-6000-7000-8000-000000000002',
   'bbbbbbbb-3000-7000-8000-000000000002',
   'bbbbbbbb-0000-7000-8000-000000000002',
   'bbbbbbbb-1000-7000-8000-000000000002',
   'rls-test-kid-1',
   now() + interval '1 hour');

-- ============================================================
-- ISSUERS (por tenant)
-- ============================================================
INSERT INTO issuers (id, issuer_did, name, trust_status, tenant_id, supports_formats)
VALUES
  ('aaaaaaaa-7000-7000-8000-000000000001',
   'did:web:rls-test-a.example',
   'A issuer', 'trusted',
   'aaaaaaaa-0000-7000-8000-000000000001',
   ARRAY['attestation']),
  ('bbbbbbbb-7000-7000-8000-000000000002',
   'did:web:rls-test-b.example',
   'B issuer', 'trusted',
   'bbbbbbbb-0000-7000-8000-000000000002',
   ARRAY['attestation']);

-- ============================================================
-- AUDIT_EVENTS sintéticos por tenant (insert direto via service_role bypassa RLS)
-- ============================================================
INSERT INTO audit_events (
  tenant_id, actor_type, actor_id, action, resource_type, resource_id, diff_json
)
VALUES
  ('aaaaaaaa-0000-7000-8000-000000000001', 'system', NULL,
   'rls_test.seed', 'tenant',
   'aaaaaaaa-0000-7000-8000-000000000001', '{"seed":"a"}'::jsonb),
  ('bbbbbbbb-0000-7000-8000-000000000002', 'system', NULL,
   'rls_test.seed', 'tenant',
   'bbbbbbbb-0000-7000-8000-000000000002', '{"seed":"b"}'::jsonb);

COMMIT;
