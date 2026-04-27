-- Migration: 012_webhook_enqueue
-- Trigger que enfileira webhook_deliveries quando uma verification_results
-- é inserida. O HMAC é computado dentro do trigger usando pgcrypto, então
-- nenhum segredo é exposto à camada Edge Function.
--
-- Fluxo:
--   verification_results INSERT
--     → trigger fan_out_verification_webhooks()
--       → SELECT webhook_endpoints WHERE application_id = ... AND event_type matches
--       → INSERT webhook_deliveries(payload, signature) por endpoint
--   webhook_deliveries INSERT
--     → cron webhooks-worker (a cada 1m) drena o status='pending'
--
-- Observação: webhook_endpoints.secret_hash guarda o SHA-256 do raw secret;
-- o raw secret é exposto 1x na criação e armazenado no cliente. Para o trigger
-- assinar usando o mesmo secret precisamos ter o raw — guardado em
-- webhook_endpoints.secret_raw_enc cifrado por GUC `app.webhook_signing_pepper`.
-- Em Fase 2.b ainda não temos rotação plena de secrets, então o trigger
-- assina usando webhook_endpoints.secret_hash como key (clientes verificam
-- com sha256(secret_raw) — equivalente em segurança a HMAC com hash do segredo).

-- ============================================================
-- Helper: monta o payload public-safe de uma verification_result
-- ============================================================
CREATE OR REPLACE FUNCTION build_verification_event_payload(
  p_result_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT jsonb_build_object(
    'event_id', vr.id,
    'event_type', CASE vr.decision
                    WHEN 'approved' THEN 'verification.approved'
                    WHEN 'denied' THEN 'verification.denied'
                    ELSE 'verification.needs_review'
                  END,
    'tenant_id', vr.tenant_id,
    'session_id', vr.session_id,
    'application_id', vs.application_id,
    'decision', vr.decision,
    'reason_code', vr.reason_code,
    'method', vr.method,
    'assurance_level', vr.assurance_level,
    'threshold_satisfied', vr.threshold_satisfied,
    'jti', vr.signed_token_jti,
    'created_at', to_char(vr.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
  INTO v_payload
  FROM verification_results vr
  JOIN verification_sessions vs ON vs.id = vr.session_id
  WHERE vr.id = p_result_id;
  RETURN v_payload;
END;
$$;

-- ============================================================
-- Trigger function: fan-out por endpoint subscrito
-- ============================================================
CREATE OR REPLACE FUNCTION fan_out_verification_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
-- hmac() vive em `extensions` (pgcrypto). search_path inclui ambos.
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint     RECORD;
  v_application  uuid;
  v_event_type   text;
  v_payload      jsonb;
  v_payload_text text;
  v_signature    text;
BEGIN
  -- Resolve application_id via session
  SELECT application_id INTO v_application
  FROM   verification_sessions WHERE id = NEW.session_id;

  v_payload    := build_verification_event_payload(NEW.id);
  v_event_type := v_payload ->> 'event_type';
  v_payload_text := v_payload::text;

  FOR v_endpoint IN
    SELECT we.id, we.tenant_id, we.secret_hash, we.events
    FROM   webhook_endpoints we
    WHERE  we.application_id = v_application
      AND  we.deleted_at IS NULL
      AND  we.status = 'active'
      AND  (cardinality(we.events) = 0 OR v_event_type = ANY(we.events))
  LOOP
    -- HMAC-SHA256(secret_hash, payload_text). Cliente verifica recomputando
    -- HMAC com sua cópia do raw secret após sha256-hashearem.
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

COMMENT ON FUNCTION fan_out_verification_webhooks IS
  'AFTER INSERT em verification_results: enfileira webhook_deliveries por endpoint subscrito do application owner.';

-- ============================================================
-- Trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_verification_results_fanout ON verification_results;
CREATE TRIGGER trg_verification_results_fanout
  AFTER INSERT ON verification_results
  FOR EACH ROW EXECUTE FUNCTION fan_out_verification_webhooks();
