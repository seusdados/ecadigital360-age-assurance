-- _rls_pre_migrate.sql
-- Setup mínimo aplicado ANTES das migrations 000..016 para que possam
-- rodar contra um Postgres "vanilla-ish" (a imagem supabase/postgres já
-- tem pg_cron e pgcrypto, mas pode faltar auth schema/roles dependendo
-- da versão).
--
-- Tudo é idempotente — pode rodar mais de uma vez ou contra uma imagem
-- que já tenha esses objetos.

-- ============================================================
-- ROLES Supabase (idempotente)
-- ============================================================
DO $$ BEGIN CREATE ROLE anon NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- AUTH schema stub (mínimo para FKs e helpers das migrations)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;

-- auth.users — apenas as colunas necessárias para satisfazer as FKs
-- e para o seed do RLS test. Em Supabase real essas colunas existem
-- com mais campos, todos com defaults.
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id          uuid PRIMARY KEY,
  aud         varchar(255) DEFAULT 'authenticated',
  role        varchar(255) DEFAULT 'authenticated',
  email       varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at  timestamptz,
  confirmation_token varchar(255) DEFAULT '',
  confirmation_sent_at timestamptz,
  recovery_token varchar(255) DEFAULT '',
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255) DEFAULT '',
  email_change varchar(255) DEFAULT '',
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  is_super_admin bool DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  phone       text,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT '',
  phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false
);

-- auth.uid() — lê o sub do JWT colocado em request.jwt.claims (GUC).
-- Tudo no AgeKey checa identidade via essa função.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> 'role',
    ''
  )
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> 'email',
    ''
  )
$$;

-- ============================================================
-- EXTENSIONS schema (algumas migrations setam search_path = public, extensions)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- Em supabase/postgres, pgcrypto/pg_cron já estão instalados em `extensions`.
-- Tornamos o CREATE EXTENSION IF NOT EXISTS no migration 000 idempotente.

-- ============================================================
-- GRANTS — permite que `authenticated` consiga ler/escrever em public
-- (RLS continua sendo o gate; ambos os layers precisam permitir)
-- ============================================================
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;

-- Default privileges para tabelas criadas DEPOIS deste setup
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE
  ON SEQUENCES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE
  ON FUNCTIONS TO anon, authenticated;

GRANT SELECT ON auth.users TO authenticated, anon;

-- ============================================================
-- STORAGE schema stub (mínimo para a migration 011_storage rodar)
-- Em Supabase real, esse schema é populado pelo serviço supabase-storage.
-- ============================================================
DO $$ BEGIN CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  metadata jsonb,
  version text,
  owner_id text
);

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- ============================================================
-- VAULT schema stub (migrations 014 e 016 referenciam vault.secrets em
-- function bodies plpgsql — não são validadas até a função ser chamada,
-- mas adicionar o stub evita surpresas se algum trigger tentar tocar).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  secret text,
  key_id uuid,
  nonce bytea,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION vault.create_secret(
  new_secret text,
  new_name text DEFAULT NULL,
  new_description text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (new_secret, new_name, new_description)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW vault.decrypted_secrets AS
  SELECT id, name, description, secret AS decrypted_secret, key_id, nonce, created_at, updated_at
  FROM vault.secrets;

GRANT USAGE ON SCHEMA vault TO service_role;
