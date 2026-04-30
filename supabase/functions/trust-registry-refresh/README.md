# trust-registry-refresh

Cron a cada 6h. Para cada issuer com `jwks_uri` cuja `jwks_fetched_at`
está desatualizada (>6h), faz GET, valida formato (`{"keys":[...]}`)
e atualiza `public_keys_json + jwks_fetched_at`. Falhas individuais
não abortam o run.

Auth: `Authorization: Bearer $CRON_SECRET`.

Schedule: `0 */6 * * *`.
