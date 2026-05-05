-- Migration: 026_safety_signals_webhooks
--
-- Trigger de fan-out de webhooks para eventos `safety.*`.
-- Reusa webhook_deliveries do Core. Não toca triggers Core/Consent.

-- ============================================================
-- Helper: payload do evento safety.*
-- ============================================================
CREATE OR REPLACE FUNCTION build_safety_alert_event_payload(
  p_alert_id uuid,
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
    'event_id',         sa.id,
    'event_type',       p_event_type,
    'tenant_id',        sa.tenant_id,
    'application_id',   sa.application_id,
    'safety_alert_id',  sa.id,
    'reason_codes',     sa.reason_codes,
    'severity',         sa.severity::text,
    'decision',         jsonb_build_object(
                          'decision_domain',          'safety_signal',
                          'decision',                 CASE sa.status::text
                                                        WHEN 'open' THEN 'pending'
                                                        WHEN 'acknowledged' THEN 'pending'
                                                        WHEN 'escalated' THEN 'needs_review'
                                                        WHEN 'resolved' THEN 'approved'
                                                        WHEN 'dismissed' THEN 'denied'
                                                        ELSE 'pending'
                                                      END,
                          'tenant_id',                sa.tenant_id,
                          'application_id',           sa.application_id,
                          'safety_alert_id',          sa.id,
                          'reason_code',              COALESCE(sa.reason_codes[1], 'SAFETY_NO_RISK_SIGNAL'),
                          'reason_codes',             sa.reason_codes,
                          'severity',                 sa.severity::text,
                          'risk_category',            sa.risk_category,
                          'actions',                  sa.actions_taken,
                          'step_up_required',         (sa.step_up_session_id IS NOT NULL),
                          'parental_consent_required',(sa.parental_consent_request_id IS NOT NULL),
                          'content_included',         false,
                          'pii_included',             false
                        ),
    'content_included', false,
    'pii_included',     false,
    'created_at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'payload_hash',     'pending'
  )
  INTO v_payload
  FROM safety_alerts sa
  WHERE sa.id = p_alert_id;

  RETURN v_payload;
END;
$$;

COMMENT ON FUNCTION build_safety_alert_event_payload IS
  'Constrói payload canônico de webhook safety.* (sem PII, sem conteúdo).';

-- ============================================================
-- Trigger: AFTER INSERT em safety_alerts → enfileira webhook
-- ============================================================
CREATE OR REPLACE FUNCTION fan_out_safety_alert_webhooks()
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
  -- Tipo do evento: alert_created ou step_up_required ou parental_consent_check_required
  IF NEW.step_up_session_id IS NOT NULL THEN
    v_event_type := 'safety.step_up_required';
  ELSIF NEW.parental_consent_request_id IS NOT NULL THEN
    v_event_type := 'safety.parental_consent_check_required';
  ELSE
    v_event_type := 'safety.alert_created';
  END IF;

  v_payload := build_safety_alert_event_payload(NEW.id, v_event_type);
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

DROP TRIGGER IF EXISTS trg_safety_alerts_fanout ON safety_alerts;
CREATE TRIGGER trg_safety_alerts_fanout
  AFTER INSERT ON safety_alerts
  FOR EACH ROW EXECUTE FUNCTION fan_out_safety_alert_webhooks();

-- ============================================================
-- Trigger: AFTER UPDATE em safety_alerts.status → webhook alert_updated
-- ============================================================
CREATE OR REPLACE FUNCTION fan_out_safety_alert_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_endpoint     RECORD;
  v_event_type   text := 'safety.alert_updated';
  v_payload      jsonb;
  v_payload_text text;
  v_signature    text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_payload := build_safety_alert_event_payload(NEW.id, v_event_type);
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

DROP TRIGGER IF EXISTS trg_safety_alerts_status_fanout ON safety_alerts;
CREATE TRIGGER trg_safety_alerts_status_fanout
  AFTER UPDATE ON safety_alerts
  FOR EACH ROW EXECUTE FUNCTION fan_out_safety_alert_status_change();
