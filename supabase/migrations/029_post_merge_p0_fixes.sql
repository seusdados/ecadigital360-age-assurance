-- Migration: 029_post_merge_p0_fixes
--
-- 1. RPC set_current_tenant(uuid)              — usado por integration tests (R8).
-- 2. RPC safety_recompute_messages_24h         — usado pelo cron Safety (R4).
-- 3. Recria build_parental_consent_event_payload com payload_hash real (R3 fix).

CREATE OR REPLACE FUNCTION set_current_tenant(tid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tid::text, true);
END;
$$;
REVOKE EXECUTE ON FUNCTION set_current_tenant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION set_current_tenant(uuid) TO service_role;
COMMENT ON FUNCTION set_current_tenant IS
  'Define tenant context via SET LOCAL. Usado por integration tests cross-tenant.';

CREATE OR REPLACE FUNCTION safety_recompute_messages_24h()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  WITH recomputed AS (
    SELECT
      se.tenant_id,
      se.application_id,
      si.counterparty_subject_id AS subject_id,
      COUNT(*) AS value
    FROM safety_events se
    JOIN safety_interactions si ON si.id = se.interaction_id
    WHERE se.event_type IN ('message_sent', 'message_received')
      AND si.relationship = 'adult_to_minor'
      AND se.occurred_at >= now() - interval '24 hours'
      AND si.counterparty_subject_id IS NOT NULL
    GROUP BY se.tenant_id, se.application_id, si.counterparty_subject_id
  ),
  upserted AS (
    INSERT INTO safety_aggregates (
      tenant_id, application_id, subject_id, aggregate_key, "window", value, updated_at
    )
    SELECT tenant_id, application_id, subject_id,
           'adult_to_minor_messages_24h', '24h', value, now()
    FROM recomputed
    ON CONFLICT (tenant_id, application_id, subject_id, aggregate_key, "window")
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION safety_recompute_messages_24h() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION safety_recompute_messages_24h() TO service_role;
COMMENT ON FUNCTION safety_recompute_messages_24h IS
  'Recalcula safety_aggregates(adult_to_minor_messages_24h) das últimas 24h.';

CREATE OR REPLACE FUNCTION build_parental_consent_event_payload(
  p_consent_id uuid,
  p_event_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_payload jsonb;
  v_payload_text text;
  v_payload_hash text;
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
    'created_at',        to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
  INTO v_payload
  FROM parental_consents pc
  JOIN parental_consent_requests pcr ON pcr.id = pc.consent_request_id
  JOIN policy_versions pv ON pv.id = pc.policy_version_id
  LEFT JOIN parental_consent_tokens pct ON pct.parental_consent_id = pc.id
  WHERE pc.id = p_consent_id;

  v_payload_text := v_payload::text;
  v_payload_hash := encode(digest(v_payload_text, 'sha256'), 'hex');
  RETURN v_payload || jsonb_build_object('payload_hash', v_payload_hash);
END;
$$;
COMMENT ON FUNCTION build_parental_consent_event_payload IS
  'Payload canônico de webhook parental_consent.* (v2 com payload_hash real, R12).';
