-- Migration: 023_parental_consent_webhooks
--
-- Trigger de fan-out de webhooks para eventos `parental_consent.*`.
-- NÃO toca `fan_out_verification_webhooks` (Core); cria trigger novo
-- para `parental_consents` insert e para revogações.
--
-- Compat: usa o mesmo formato de assinatura do Core
-- (HMAC-SHA256(secret_hash, payload_text)) e a mesma tabela
-- `webhook_deliveries`. O worker `webhooks-worker` já entrega
-- qualquer evento; só precisamos enfileirar.

-- ============================================================
-- Helper: payload do evento parental_consent.*
-- ============================================================
CREATE OR REPLACE FUNCTION build_parental_consent_event_payload(
  p_consent_id uuid,
  p_event_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT jsonb_build_object(
    'event_id',          pc.id,
    'event_type',        p_event_type,
    'tenant_id',         pc.tenant_id,
    'application_id',    pc.application_id,
    'session_id',        pc.consent_request_id,
    'consent_token_id',  pct.jti,
    'policy_id',         pc.policy_id,
    'policy_version',    pv.version::text,
    'resource',          pcr.resource,
    'reason_code',       pc.reason_code,
    'reason_codes',      ARRAY[pc.reason_code],
    'severity',          'info',
    'decision',          jsonb_build_object(
                           'decision_domain',          'parental_consent',
                           'decision',                 CASE
                                                         WHEN pc.revoked_at IS NOT NULL THEN 'revoked'
                                                         WHEN pc.decision = 'granted' THEN 'approved'
                                                         ELSE 'denied'
                                                       END,
                           'tenant_id',                pc.tenant_id,
                           'application_id',           pc.application_id,
                           'policy_id',                pc.policy_id,
                           'policy_version',           pv.version::text,
                           'resource',                 pcr.resource,
                           'consent_token_id',         pct.jti,
                           'reason_code',              pc.reason_code,
                           'expires_at',               to_char(pc.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                           'parental_consent_required', true,
                           'content_included',         false,
                           'pii_included',             false
                         ),
    'content_included',  false,
    'pii_included',      false,
    'created_at',        to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'payload_hash',      'pending'
  )
  INTO v_payload
  FROM parental_consents pc
  JOIN parental_consent_requests pcr ON pcr.id = pc.consent_request_id
  JOIN policy_versions pv ON pv.id = pc.policy_version_id
  LEFT JOIN parental_consent_tokens pct ON pct.parental_consent_id = pc.id
  WHERE pc.id = p_consent_id;

  RETURN v_payload;
END;
$$;

COMMENT ON FUNCTION build_parental_consent_event_payload IS
  'Constrói payload canônico de webhook parental_consent.* (sem PII).';

-- ============================================================
-- Trigger: AFTER INSERT em parental_consents → enfileira webhook
-- ============================================================
CREATE OR REPLACE FUNCTION fan_out_parental_consent_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint     RECORD;
  v_event_type   text;
  v_payload      jsonb;
  v_payload_text text;
  v_signature    text;
BEGIN
  v_event_type := CASE NEW.decision
                    WHEN 'granted' THEN 'parental_consent.approved'
                    ELSE 'parental_consent.denied'
                  END;

  v_payload := build_parental_consent_event_payload(NEW.id, v_event_type);
  v_payload_text := v_payload::text;

  FOR v_endpoint IN
    SELECT we.id, we.tenant_id, we.secret_hash, we.events
    FROM   webhook_endpoints we
    WHERE  we.application_id = NEW.application_id
      AND  we.deleted_at IS NULL
      AND  we.status = 'active'
      AND  (cardinality(we.events) = 0 OR v_event_type = ANY(we.events))
  LOOP
    v_signature := encode(
      hmac(v_payload_text::bytea, v_endpoint.secret_hash::bytea, 'sha256'),
      'hex'
    );

    INSERT INTO webhook_deliveries (
      endpoint_id, tenant_id, event_type,
      payload_json, signature
    ) VALUES (
      v_endpoint.id, v_endpoint.tenant_id, v_event_type,
      v_payload, v_signature
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parental_consents_fanout ON parental_consents;
CREATE TRIGGER trg_parental_consents_fanout
  AFTER INSERT ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION fan_out_parental_consent_webhooks();

COMMENT ON FUNCTION fan_out_parental_consent_webhooks IS
  'AFTER INSERT em parental_consents: enfileira webhook parental_consent.{approved,denied}.';

-- ============================================================
-- Trigger: AFTER INSERT em parental_consent_revocations → webhook
-- ============================================================
CREATE OR REPLACE FUNCTION fan_out_parental_consent_revoke_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint     RECORD;
  v_event_type   text := 'parental_consent.revoked';
  v_payload      jsonb;
  v_payload_text text;
  v_signature    text;
  v_application  uuid;
BEGIN
  SELECT pc.application_id INTO v_application
  FROM parental_consents pc
  WHERE pc.id = NEW.parental_consent_id;

  v_payload := build_parental_consent_event_payload(NEW.parental_consent_id, v_event_type);
  v_payload_text := v_payload::text;

  FOR v_endpoint IN
    SELECT we.id, we.tenant_id, we.secret_hash, we.events
    FROM   webhook_endpoints we
    WHERE  we.application_id = v_application
      AND  we.deleted_at IS NULL
      AND  we.status = 'active'
      AND  (cardinality(we.events) = 0 OR v_event_type = ANY(we.events))
  LOOP
    v_signature := encode(
      hmac(v_payload_text::bytea, v_endpoint.secret_hash::bytea, 'sha256'),
      'hex'
    );

    INSERT INTO webhook_deliveries (
      endpoint_id, tenant_id, event_type,
      payload_json, signature
    ) VALUES (
      v_endpoint.id, v_endpoint.tenant_id, v_event_type,
      v_payload, v_signature
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parental_consent_revocations_fanout ON parental_consent_revocations;
CREATE TRIGGER trg_parental_consent_revocations_fanout
  AFTER INSERT ON parental_consent_revocations
  FOR EACH ROW EXECUTE FUNCTION fan_out_parental_consent_revoke_webhooks();

COMMENT ON FUNCTION fan_out_parental_consent_revoke_webhooks IS
  'AFTER INSERT em parental_consent_revocations: enfileira webhook parental_consent.revoked.';
