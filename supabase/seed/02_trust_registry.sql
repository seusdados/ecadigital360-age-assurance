-- Seed: 02_trust_registry.sql
-- Issuers globais de desenvolvimento (tenant_id = NULL).
-- Em produção estes seriam substituídos pelas chaves reais de:
--   - EUDI Wallet (UE)
--   - Google Wallet
--   - Apple Wallet
--   - Serpro ID (BR)
-- Chaves públicas abaixo são placeholders (did:web: com JWKS vazio).
-- A atualização real ocorre via Edge Function trust-registry-refresh.

INSERT INTO issuers (
  id, issuer_did, name, trust_status, public_keys_json,
  supports_formats, metadata_json, tenant_id
) VALUES
-- ============================================================
-- AgeKey Demo Issuer — usado pelo adapter-fallback e exemplos
-- ============================================================
(
  uuid_generate_v7(),
  'did:web:demo.agekey.com.br',
  'AgeKey Demo Issuer',
  'trusted',
  '{"keys": []}'::jsonb,
  ARRAY['attestation'],
  jsonb_build_object(
    'adapter_variant', 'internal_demo',
    'environment', 'dev',
    'description', 'Issuer mock para ambiente de desenvolvimento.'
  ),
  NULL
),

-- ============================================================
-- EUDI Wallet (mock para dev; em prod puxar JWKS do EUDI Trust Registry)
-- ============================================================
(
  uuid_generate_v7(),
  'did:web:eudi-wallet.europa.eu',
  'EU Digital Identity Wallet (mock)',
  'trusted',
  '{"keys": []}'::jsonb,
  ARRAY['w3c_vc', 'sd_jwt_vc'],
  jsonb_build_object(
    'adapter_variant', 'eudi',
    'jwks_uri', 'https://eudi-wallet.europa.eu/.well-known/jwks.json',
    'legal_reference', 'eIDAS 2.0 Regulation (EU) 2024/1183',
    'bloc', 'EU'
  ),
  NULL
),

-- ============================================================
-- Google Wallet (mock)
-- ============================================================
(
  uuid_generate_v7(),
  'did:web:wallet.google.com',
  'Google Wallet (mock)',
  'trusted',
  '{"keys": []}'::jsonb,
  ARRAY['w3c_vc', 'sd_jwt_vc'],
  jsonb_build_object(
    'adapter_variant', 'google_wallet',
    'jwks_uri', 'https://wallet.google.com/.well-known/jwks.json'
  ),
  NULL
),

-- ============================================================
-- Apple Wallet (mock)
-- ============================================================
(
  uuid_generate_v7(),
  'did:web:wallet.apple.com',
  'Apple Wallet (mock)',
  'trusted',
  '{"keys": []}'::jsonb,
  ARRAY['w3c_vc', 'attestation'],
  jsonb_build_object(
    'adapter_variant', 'apple_wallet',
    'min_ios_version', '18.0'
  ),
  NULL
),

-- ============================================================
-- Serpro ID Brasil (mock; gateway adapter em Fase 2)
-- ============================================================
(
  uuid_generate_v7(),
  'did:web:id.serpro.gov.br',
  'Serpro ID (mock)',
  'trusted',
  '{"keys": []}'::jsonb,
  ARRAY['attestation'],
  jsonb_build_object(
    'adapter_variant', 'serpro_id',
    'jurisdiction', 'BR',
    'description', 'Identidade digital governamental BR (gov.br).'
  ),
  NULL
)

ON CONFLICT (issuer_did) DO NOTHING;
