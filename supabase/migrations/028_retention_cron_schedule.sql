-- Migration: 028_retention_cron_schedule
--
-- Schedule pg_cron para o `retention-job` rodar diariamente às 3h UTC.
-- Idempotente via cron.schedule (upsert por nome).
--
-- A função net.http_post é usada para invocar a Edge Function.
-- Em produção, configurar `vault.secrets.cron_secret` e referenciar
-- via `vault.decrypted_secrets` em vez de hardcode.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    PERFORM cron.schedule(
      'agekey-retention-job',
      '0 3 * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('agekey.retention_job_url', true),
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('agekey.cron_secret', true),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        );
      $cron$
    );

  ELSE
    RAISE NOTICE 'pg_cron or pg_net not available — schedule skipped. Configure manually after enabling extensions.';
  END IF;
END $$;

COMMENT ON SCHEMA public IS 'agekey-retention-job scheduled 03:00 UTC daily (see migration 028).';
