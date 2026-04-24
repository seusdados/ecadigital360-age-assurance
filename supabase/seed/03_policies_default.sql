-- Seed: 03_policies_default.sql
-- Templates de policies (tenant_id = NULL, is_template = true).
-- Qualquer tenant pode clonar via painel.
--
-- Jurisdições cobertas no MVP: BR + EU.

INSERT INTO policies (
  id, tenant_id, name, slug, description,
  age_threshold, jurisdiction_code,
  method_priority_json, required_assurance_level,
  token_ttl_seconds, legal_reference_url,
  is_template
) VALUES
-- ============================================================
-- BRASIL — templates regulatórios
-- ============================================================
(
  uuid_generate_v7(), NULL,
  'Brasil — Idade mínima 13+ (ECA)',
  'br-13-plus',
  'Idade mínima para uso de redes sociais e conteúdo infantojuvenil conforme ECA (Lei 8.069/1990).',
  13, 'BR',
  '["zkp","vc","gateway","fallback"]'::jsonb,
  'low',
  86400,
  'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm',
  true
),
(
  uuid_generate_v7(), NULL,
  'Brasil — Consentimento digital 16+ (LGPD art. 14)',
  'br-16-plus',
  'Consentimento digital sem assistência conforme art. 14 da LGPD.',
  16, 'BR',
  '["zkp","vc","gateway","fallback"]'::jsonb,
  'substantial',
  86400,
  'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
  true
),
(
  uuid_generate_v7(), NULL,
  'Brasil — Maioridade 18+ (conteúdo adulto / apostas / álcool)',
  'br-18-plus',
  'Acesso a conteúdo adulto, apostas (Lei 14.790/2023) e álcool.',
  18, 'BR',
  '["vc","gateway","zkp","fallback"]'::jsonb,
  'high',
  86400,
  'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14790.htm',
  true
),
(
  uuid_generate_v7(), NULL,
  'Brasil — 21+ (serviços financeiros)',
  'br-21-plus',
  'Alguns serviços financeiros e crédito exigem 21+.',
  21, 'BR',
  '["vc","gateway","fallback"]'::jsonb,
  'high',
  86400,
  NULL,
  true
),

-- ============================================================
-- UNIÃO EUROPEIA — templates pan-europeus
-- ============================================================
(
  uuid_generate_v7(), NULL,
  'EU — Minimum 13+ (DSA)',
  'eu-13-plus',
  'DSA minimum age for online services offered to minors.',
  13, 'EU',
  '["zkp","vc","gateway","fallback"]'::jsonb,
  'low',
  86400,
  'https://eur-lex.europa.eu/eli/reg/2022/2065/oj',
  true
),
(
  uuid_generate_v7(), NULL,
  'EU — Digital consent 16+ (GDPR art. 8)',
  'eu-16-plus',
  'GDPR default digital consent age. Adjustable by Member State between 13–16.',
  16, 'EU',
  '["vc","zkp","gateway","fallback"]'::jsonb,
  'substantial',
  86400,
  'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  true
),
(
  uuid_generate_v7(), NULL,
  'EU — Adult 18+ (AVMSD / age-verification blueprint)',
  'eu-18-plus',
  'Access to adult content under AVMSD and the EU age-verification blueprint.',
  18, 'EU',
  '["vc","zkp","gateway","fallback"]'::jsonb,
  'high',
  86400,
  'https://eur-lex.europa.eu/eli/dir/2018/1808/oj',
  true
)
ON CONFLICT (tenant_id, slug) DO NOTHING;
