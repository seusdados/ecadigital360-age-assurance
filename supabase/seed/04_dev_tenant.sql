-- Seed: 04_dev_tenant.sql
-- Cria um tenant "dev" com uma aplicação e 3 policies clonadas dos templates.
-- Use APENAS em ambientes de desenvolvimento e staging.
--
-- Raw api_key (mostrada uma vez, guardar no .env):
--   ak_dev_sk_test_0123456789abcdef
-- Hash:
--   sha256_hex('ak_dev_sk_test_0123456789abcdef')
--
-- Raw webhook secret:
--   whsec_dev_0123456789abcdef
--
-- Em staging/prod esses valores NÃO devem ser usados. Rotacionar via painel.

DO $$
DECLARE
  v_tenant_id       uuid := uuid_generate_v7();
  v_application_id  uuid := uuid_generate_v7();
  v_policy_13_id    uuid := uuid_generate_v7();
  v_policy_16_id    uuid := uuid_generate_v7();
  v_policy_18_id    uuid := uuid_generate_v7();
  v_template_13     uuid;
  v_template_16     uuid;
  v_template_18     uuid;
  v_demo_issuer_id  uuid;
BEGIN
  -- ============================================================
  -- TENANT
  -- ============================================================
  INSERT INTO tenants (
    id, name, slug, status, retention_days, plan, branding_json
  ) VALUES (
    v_tenant_id,
    'AgeKey Dev',
    'dev',
    'active',
    30,
    'dev',
    jsonb_build_object(
      'primary_color', '#0F172A',
      'logo_url', 'https://agekey.com.br/logo.svg',
      'support_email', 'dev@agekey.com.br'
    )
  ) ON CONFLICT (slug) DO NOTHING;

  -- Re-obter id se já existia
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'dev';

  -- ============================================================
  -- APPLICATION
  -- ============================================================
  INSERT INTO applications (
    id, tenant_id, name, slug, description,
    api_key_hash, api_key_prefix,
    callback_url, webhook_url, webhook_secret_hash,
    allowed_origins
  ) VALUES (
    v_application_id,
    v_tenant_id,
    'AgeKey Dev App',
    'dev-app',
    'Aplicação de referência para testes locais.',
    sha256_hex('ak_dev_sk_test_0123456789abcdef'),
    'ak_dev_sk_test_',
    'http://localhost:3000/callback',
    'http://localhost:3000/api/webhooks/agekey',
    sha256_hex('whsec_dev_0123456789abcdef'),
    ARRAY['http://localhost:3000', 'http://127.0.0.1:3000']
  ) ON CONFLICT (tenant_id, slug) DO NOTHING;

  SELECT id INTO v_application_id
  FROM   applications
  WHERE  tenant_id = v_tenant_id AND slug = 'dev-app';

  -- ============================================================
  -- POLICIES — clonadas dos templates BR
  -- ============================================================
  SELECT id INTO v_template_13 FROM policies WHERE slug = 'br-13-plus' AND is_template = true;
  SELECT id INTO v_template_16 FROM policies WHERE slug = 'br-16-plus' AND is_template = true;
  SELECT id INTO v_template_18 FROM policies WHERE slug = 'br-18-plus' AND is_template = true;

  INSERT INTO policies (
    id, tenant_id, name, slug, description,
    age_threshold, jurisdiction_code,
    method_priority_json, required_assurance_level,
    token_ttl_seconds, legal_reference_url,
    is_template, cloned_from_id
  )
  SELECT
    v_policy_13_id, v_tenant_id,
    'Dev — 13+', 'dev-13-plus', description,
    age_threshold, jurisdiction_code,
    method_priority_json, required_assurance_level,
    token_ttl_seconds, legal_reference_url,
    false, v_template_13
  FROM policies WHERE id = v_template_13
  ON CONFLICT (tenant_id, slug) DO NOTHING;

  INSERT INTO policies (
    id, tenant_id, name, slug, description,
    age_threshold, jurisdiction_code,
    method_priority_json, required_assurance_level,
    token_ttl_seconds, legal_reference_url,
    is_template, cloned_from_id
  )
  SELECT
    v_policy_16_id, v_tenant_id,
    'Dev — 16+', 'dev-16-plus', description,
    age_threshold, jurisdiction_code,
    method_priority_json, required_assurance_level,
    token_ttl_seconds, legal_reference_url,
    false, v_template_16
  FROM policies WHERE id = v_template_16
  ON CONFLICT (tenant_id, slug) DO NOTHING;

  INSERT INTO policies (
    id, tenant_id, name, slug, description,
    age_threshold, jurisdiction_code,
    method_priority_json, required_assurance_level,
    token_ttl_seconds, legal_reference_url,
    is_template, cloned_from_id
  )
  SELECT
    v_policy_18_id, v_tenant_id,
    'Dev — 18+', 'dev-18-plus', description,
    age_threshold, jurisdiction_code,
    method_priority_json, required_assurance_level,
    token_ttl_seconds, legal_reference_url,
    false, v_template_18
  FROM policies WHERE id = v_template_18
  ON CONFLICT (tenant_id, slug) DO NOTHING;

  -- ============================================================
  -- TRUST_LIST — tenant dev confia no AgeKey Demo Issuer
  -- ============================================================
  SELECT id INTO v_demo_issuer_id
  FROM   issuers
  WHERE  issuer_did = 'did:web:demo.agekey.com.br';

  IF v_demo_issuer_id IS NOT NULL THEN
    INSERT INTO trust_lists (tenant_id, issuer_id, trust_override)
    VALUES (v_tenant_id, v_demo_issuer_id, 'trust')
    ON CONFLICT (tenant_id, issuer_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Dev tenant bootstrap complete. tenant_id=%, application_id=%', v_tenant_id, v_application_id;
END;
$$;
