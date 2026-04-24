-- Seed: 01_jurisdictions.sql
-- Popula jurisdictions com:
--   - Bloco UE (EU)
--   - 27 Estados-membro da UE
--   - Brasil (BR)
--   - 26 UFs + DF (código ISO 3166-2 BR-XX)
--
-- Executado via service_role (bypassa RLS).

-- ============================================================
-- BLOCOS
-- ============================================================
INSERT INTO jurisdictions (code, parent_code, name_pt, name_en, is_bloc, legal_reference_url) VALUES
  ('EU', NULL, 'União Europeia', 'European Union', true,
   'https://european-union.europa.eu/institutions-law-budget/law_pt')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- ESTADOS-MEMBRO DA UE (ISO 3166-1 alpha-2)
-- ============================================================
INSERT INTO jurisdictions (code, parent_code, name_pt, name_en, is_bloc) VALUES
  ('AT', 'EU', 'Áustria',        'Austria',        false),
  ('BE', 'EU', 'Bélgica',        'Belgium',        false),
  ('BG', 'EU', 'Bulgária',       'Bulgaria',       false),
  ('HR', 'EU', 'Croácia',        'Croatia',        false),
  ('CY', 'EU', 'Chipre',         'Cyprus',         false),
  ('CZ', 'EU', 'República Checa','Czech Republic', false),
  ('DK', 'EU', 'Dinamarca',      'Denmark',        false),
  ('EE', 'EU', 'Estónia',        'Estonia',        false),
  ('FI', 'EU', 'Finlândia',      'Finland',        false),
  ('FR', 'EU', 'França',         'France',         false),
  ('DE', 'EU', 'Alemanha',       'Germany',        false),
  ('GR', 'EU', 'Grécia',         'Greece',         false),
  ('HU', 'EU', 'Hungria',        'Hungary',        false),
  ('IE', 'EU', 'Irlanda',        'Ireland',        false),
  ('IT', 'EU', 'Itália',         'Italy',          false),
  ('LV', 'EU', 'Letónia',        'Latvia',         false),
  ('LT', 'EU', 'Lituânia',       'Lithuania',      false),
  ('LU', 'EU', 'Luxemburgo',     'Luxembourg',     false),
  ('MT', 'EU', 'Malta',          'Malta',          false),
  ('NL', 'EU', 'Países Baixos',  'Netherlands',    false),
  ('PL', 'EU', 'Polónia',        'Poland',         false),
  ('PT', 'EU', 'Portugal',       'Portugal',       false),
  ('RO', 'EU', 'Roménia',        'Romania',        false),
  ('SK', 'EU', 'Eslováquia',     'Slovakia',       false),
  ('SI', 'EU', 'Eslovénia',      'Slovenia',       false),
  ('ES', 'EU', 'Espanha',        'Spain',          false),
  ('SE', 'EU', 'Suécia',         'Sweden',         false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- BRASIL + UFs (ISO 3166-2 BR-XX)
-- ============================================================
INSERT INTO jurisdictions (code, parent_code, name_pt, name_en, is_bloc, legal_reference_url) VALUES
  ('BR', NULL, 'Brasil', 'Brazil', false,
   'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm')
ON CONFLICT (code) DO NOTHING;

INSERT INTO jurisdictions (code, parent_code, name_pt, name_en, is_bloc) VALUES
  ('BR-AC', 'BR', 'Acre',                'Acre',               false),
  ('BR-AL', 'BR', 'Alagoas',             'Alagoas',            false),
  ('BR-AP', 'BR', 'Amapá',               'Amapá',              false),
  ('BR-AM', 'BR', 'Amazonas',            'Amazonas',           false),
  ('BR-BA', 'BR', 'Bahia',               'Bahia',              false),
  ('BR-CE', 'BR', 'Ceará',               'Ceará',              false),
  ('BR-DF', 'BR', 'Distrito Federal',    'Federal District',   false),
  ('BR-ES', 'BR', 'Espírito Santo',      'Espírito Santo',     false),
  ('BR-GO', 'BR', 'Goiás',               'Goiás',              false),
  ('BR-MA', 'BR', 'Maranhão',            'Maranhão',           false),
  ('BR-MT', 'BR', 'Mato Grosso',         'Mato Grosso',        false),
  ('BR-MS', 'BR', 'Mato Grosso do Sul',  'Mato Grosso do Sul', false),
  ('BR-MG', 'BR', 'Minas Gerais',        'Minas Gerais',       false),
  ('BR-PA', 'BR', 'Pará',                'Pará',               false),
  ('BR-PB', 'BR', 'Paraíba',             'Paraíba',            false),
  ('BR-PR', 'BR', 'Paraná',              'Paraná',             false),
  ('BR-PE', 'BR', 'Pernambuco',          'Pernambuco',         false),
  ('BR-PI', 'BR', 'Piauí',               'Piauí',              false),
  ('BR-RJ', 'BR', 'Rio de Janeiro',      'Rio de Janeiro',     false),
  ('BR-RN', 'BR', 'Rio Grande do Norte', 'Rio Grande do Norte', false),
  ('BR-RS', 'BR', 'Rio Grande do Sul',   'Rio Grande do Sul',  false),
  ('BR-RO', 'BR', 'Rondônia',            'Rondônia',           false),
  ('BR-RR', 'BR', 'Roraima',             'Roraima',            false),
  ('BR-SC', 'BR', 'Santa Catarina',      'Santa Catarina',     false),
  ('BR-SP', 'BR', 'São Paulo',           'São Paulo',          false),
  ('BR-SE', 'BR', 'Sergipe',             'Sergipe',            false),
  ('BR-TO', 'BR', 'Tocantins',           'Tocantins',          false)
ON CONFLICT (code) DO NOTHING;
