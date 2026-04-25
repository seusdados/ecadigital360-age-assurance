-- Migration: 013_tenant_bootstrap
-- RPC consumido pelo Edge Function `tenant-bootstrap` para criar
-- tenant + role + application numa transação atômica.
--
-- Roda como SECURITY DEFINER para escapar de RLS — o Edge Function
-- já validou o JWT do usuário e impôs a regra "user não é membro de
-- nenhum tenant".

CREATE OR REPLACE FUNCTION tenant_bootstrap(
  p_user_id                  uuid,
  p_tenant_name              text,
  p_tenant_slug              text,
  p_application_name         text,
  p_application_slug         text,
  p_application_description  text,
  p_api_key_hash             text,
  p_api_key_prefix           text,
  p_webhook_secret_hash      text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id      uuid;
  v_application_id uuid;
BEGIN
  -- Defensive: refuse if the user is already in a tenant.
  IF EXISTS (
    SELECT 1 FROM tenant_users WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'user already belongs to a tenant'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- 1. tenant
  INSERT INTO tenants (name, slug, status, plan)
  VALUES (p_tenant_name, p_tenant_slug, 'active', 'free')
  RETURNING id INTO v_tenant_id;

  -- 2. owner role
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'owner');

  -- 3. application
  INSERT INTO applications (
    tenant_id, name, slug, description,
    api_key_hash, api_key_prefix, webhook_secret_hash, allowed_origins
  )
  VALUES (
    v_tenant_id, p_application_name, p_application_slug, p_application_description,
    p_api_key_hash, p_api_key_prefix, p_webhook_secret_hash, '{}'::text[]
  )
  RETURNING id INTO v_application_id;

  RETURN jsonb_build_object(
    'tenant_id',      v_tenant_id,
    'application_id', v_application_id
  );
END;
$$;

COMMENT ON FUNCTION tenant_bootstrap IS
  'Atomically creates tenant + owner membership + first application during onboarding. Edge Function tenant-bootstrap is the only authorized caller.';

-- Lock down execution: only service_role (used by Edge Functions) can call it.
REVOKE EXECUTE ON FUNCTION tenant_bootstrap(
  uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_bootstrap(
  uuid, text, text, text, text, text, text, text, text
) TO service_role;
