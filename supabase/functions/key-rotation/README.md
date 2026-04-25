# key-rotation

Cron job interno (`POST /functions/v1/key-rotation`).

Auth: header `Authorization: Bearer $CRON_SECRET`.

## Política
- Gera novo keypair ES256 a cada execução.
- Em DB vazio: nova chave entra direto como `active` (bootstrap).
- Caso contrário:
  1. Nova chave entra como `rotating`.
  2. `rotating` → `active` quando idade ≥ 24h.
  3. `active` → `retired` quando idade ≥ 24h E não for a chave ativa mais recente.
  4. `retired` → DELETE quando idade ≥ 90 dias.

## Required env
- `CRON_SECRET`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Deploy
```bash
supabase functions deploy key-rotation --no-verify-jwt
supabase secrets set CRON_SECRET=<...>
```

## Cron schedule (pg_cron)
Migration 010 inclui:
```sql
select cron.schedule(
  'key-rotation-daily',
  '0 3 * * *',
  $$
    select net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/key-rotation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'cron')
    );
  $$
);
```

## TODO Fase 2.b
Substituir `encodePrivateJwk` (hex placeholder) por encryption real
via Supabase Vault / pgsodium.
