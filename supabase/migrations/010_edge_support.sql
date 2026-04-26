-- Migration: 010_edge_support
-- Helpers RPC + cron schedules consumidos pelas Edge Functions da Fase 2.
--
-- Conteúdo:
--   1. RPC set_tenant_context — usado por _shared/db.ts
--   2. RPC rate_limit_consume — usado por _shared/rate-limit.ts (atômico)
--   3. RPC list_old_partitions / drop_partition — usados por retention-job
--   4. Cron schedules para key-rotation, webhooks-worker, retention-job,
--      trust-registry-refresh
--
-- Observação: setting `app.cron_secret` precisa ser configurado em GUC
-- antes do primeiro run dos crons HTTP (ver README do projeto).

-- ============================================================
-- 1. set_tenant_context
-- ============================================================
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id::text, true);
END;
$$;

COMMENT ON FUNCTION set_tenant_context IS
  'Sets app.current_tenant_id GUC for the current transaction. Edge Functions chamam antes de operar dados de tenant.';

-- ============================================================
-- 2. rate_limit_consume — atômico via UPDATE ... RETURNING
-- ============================================================
CREATE OR REPLACE FUNCTION rate_limit_consume(
  p_key text,
  p_tenant_id uuid,
  p_capacity integer,
  p_refill_rate numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_tokens numeric;
  v_capacity integer;
  v_refill_rate integer;
  v_last_refill timestamptz;
  v_elapsed_s numeric;
  v_new_tokens numeric;
BEGIN
  -- Garante existência do bucket
  INSERT INTO rate_limit_buckets (key, tenant_id, tokens, capacity, refill_rate, last_refill_at)
  VALUES (p_key, p_tenant_id, p_capacity, p_capacity, GREATEST(1, p_refill_rate)::int, v_now)
  ON CONFLICT (key) DO NOTHING;

  -- Lock + recompute
  SELECT tokens, capacity, refill_rate, last_refill_at
  INTO v_tokens, v_capacity, v_refill_rate, v_last_refill
  FROM rate_limit_buckets
  WHERE key = p_key
  FOR UPDATE;

  v_elapsed_s := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_last_refill)));
  v_new_tokens := LEAST(v_capacity, v_tokens + v_elapsed_s * v_refill_rate);

  IF v_new_tokens >= 1 THEN
    UPDATE rate_limit_buckets
       SET tokens = v_new_tokens - 1,
           last_refill_at = v_now,
           updated_at = v_now
     WHERE key = p_key;
    RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
  ELSE
    -- Atualiza apenas o refill (sem consumir)
    UPDATE rate_limit_buckets
       SET tokens = v_new_tokens,
           last_refill_at = v_now,
           updated_at = v_now
     WHERE key = p_key;
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', CEIL((1 - v_new_tokens) / NULLIF(v_refill_rate, 0))
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION rate_limit_consume IS
  'Atomic token-bucket consume. Retorna {allowed, retry_after}.';

-- ============================================================
-- 3. list_old_partitions / drop_partition (retention-job)
-- ============================================================
CREATE OR REPLACE FUNCTION list_old_partitions(p_cutoff timestamptz)
RETURNS TABLE (
  parent text,
  child text,
  range_start text,
  range_end text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    parent.relname::text   AS parent,
    child.relname::text    AS child,
    (regexp_match(pg_get_expr(child.relpartbound, child.oid), 'FROM \(''([^'']+)''\)'))[1] AS range_start,
    (regexp_match(pg_get_expr(child.relpartbound, child.oid), 'TO \(''([^'']+)''\)'))[1]   AS range_end
  FROM pg_inherits i
  JOIN pg_class child  ON i.inhrelid  = child.oid
  JOIN pg_class parent ON i.inhparent = parent.oid
  WHERE parent.relname IN ('audit_events', 'billing_events')
    AND child.relkind = 'r'
    AND child.relname NOT LIKE '%\_default'
    AND ((regexp_match(pg_get_expr(child.relpartbound, child.oid), 'TO \(''([^'']+)''\)'))[1])::timestamptz <= p_cutoff;
END;
$$;

CREATE OR REPLACE FUNCTION drop_partition(p_child text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sanity check: never drop a non-partition or non-monthly partition
  IF p_child !~ '^(audit_events|billing_events)_\d{4}_\d{2}$' THEN
    RAISE EXCEPTION 'Refusing to drop non-monthly partition: %', p_child;
  END IF;
  EXECUTE format('DROP TABLE IF EXISTS %I', p_child);
END;
$$;

-- ============================================================
-- 4. Cron schedules (Fase 2 — chamam Edge Functions via net.http_post)
-- ============================================================
-- Pré-requisito: extensão pg_net (ou http) precisa estar disponível.
-- Em Supabase Cloud o pg_net já vem habilitado.
DO $$
BEGIN
  -- key-rotation: diário 03:00 UTC
  PERFORM cron.unschedule('key-rotation-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'key-rotation-daily');
  PERFORM cron.schedule(
    'key-rotation-daily',
    '0 3 * * *',
    $cmd$
      SELECT net.http_post(
        url := current_setting('app.functions_url') || '/key-rotation',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source','cron')
      );
    $cmd$
  );

  -- webhooks-worker: a cada 30 segundos (pg_cron 5-min mínimo, então 1m)
  PERFORM cron.unschedule('webhooks-worker-tick')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhooks-worker-tick');
  PERFORM cron.schedule(
    'webhooks-worker-tick',
    '* * * * *',
    $cmd$
      SELECT net.http_post(
        url := current_setting('app.functions_url') || '/webhooks-worker',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source','cron')
      );
    $cmd$
  );

  -- retention-job: diário 04:00 UTC
  PERFORM cron.unschedule('retention-job-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retention-job-daily');
  PERFORM cron.schedule(
    'retention-job-daily',
    '0 4 * * *',
    $cmd$
      SELECT net.http_post(
        url := current_setting('app.functions_url') || '/retention-job',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source','cron')
      );
    $cmd$
  );

  -- trust-registry-refresh: a cada 6h
  PERFORM cron.unschedule('trust-registry-refresh-6h')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trust-registry-refresh-6h');
  PERFORM cron.schedule(
    'trust-registry-refresh-6h',
    '0 */6 * * *',
    $cmd$
      SELECT net.http_post(
        url := current_setting('app.functions_url') || '/trust-registry-refresh',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source','cron')
      );
    $cmd$
  );
END$$;

COMMENT ON FUNCTION list_old_partitions IS 'Lista partições audit_events_*/billing_events_* totalmente fora do horizonte cutoff.';
COMMENT ON FUNCTION drop_partition IS 'DROP defensivo restrito a partições monthly. Bloqueia nomes inesperados.';

-- ============================================================
-- Settings hint:
--   ALTER DATABASE postgres SET app.cron_secret = '<...>';
--   ALTER DATABASE postgres SET app.functions_url = 'https://<project>.supabase.co/functions/v1';
-- ============================================================
