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
supabase functions deploy key-rotation --no-verify-jwt \
  --import-map supabase/functions/import_map.json
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

## Storage da chave privada

Implementado em **Fase 2.d** via Supabase Vault (pgsodium-backed).
Migration `014_vault_crypto_keys.sql` define os RPCs:

- `crypto_keys_store_private(kid, private_jwk_json)` → grava em
  `vault.secrets` e linka via `crypto_keys.vault_secret_id`
- `crypto_keys_load_private(kid)` → retorna JWK descriptografado (chamado
  por `_shared/keys.ts::loadActiveSigningKey`)
- `crypto_keys_purge_vault(kid)` → deleta a entrada do vault no purge dos
  90 dias

EXECUTE granted apenas a `service_role`. Edge Functions chamam via
service_role; usuários nunca conseguem invocar.

> **Importante:** rows criadas antes da migration 014 (com `private_key_enc`
> em hex) **não são mais carregáveis** — `loadActiveSigningKey()` lança
> InternalError. Solução: chame `/key-rotation` uma vez após deploy para
> seed de uma chave nova vault-backed.
