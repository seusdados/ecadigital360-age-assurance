-- Migration: 011_storage
-- Cria bucket privado proof-artifacts + RLS para que cada tenant só
-- enxergue seus próprios objetos. Path convention enforced em código:
--   <tenant_id>/<session_id>/<artifact_id>

-- ============================================================
-- BUCKET proof-artifacts
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-artifacts',
  'proof-artifacts',
  false,
  10 * 1024 * 1024, -- 10 MiB ceiling per artifact
  ARRAY[
    'application/json',
    'application/jwt',
    'application/octet-stream',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public             = EXCLUDED.public;

-- ============================================================
-- RLS — leitura por auditor do mesmo tenant; escrita apenas service_role
-- ============================================================
DROP POLICY IF EXISTS "proof_artifacts_select" ON storage.objects;
CREATE POLICY "proof_artifacts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'proof-artifacts'
    AND split_part(name, '/', 1)::uuid = current_tenant_id()
    AND has_role('auditor')
  );

DROP POLICY IF EXISTS "proof_artifacts_insert" ON storage.objects;
CREATE POLICY "proof_artifacts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (false);  -- only service_role writes

-- Notas (eram COMMENT ON POLICY mas storage.objects pertence a
-- supabase_storage_admin, então COMMENT exige ownership que não temos):
--
--   proof_artifacts_select:
--     Tenant members with role >= auditor leem os objetos do próprio tenant.
--
--   proof_artifacts_insert:
--     Escrita só via service_role (Edge Functions). Bloqueia upload direto pelo cliente.
