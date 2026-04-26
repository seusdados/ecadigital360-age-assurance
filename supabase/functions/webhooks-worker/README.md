# webhooks-worker

Cron job. `POST /functions/v1/webhooks-worker` autenticado via
`Authorization: Bearer $CRON_SECRET`. Drena até 50 entregas pendentes
por execução com timeout de 10s e backoff exponencial:
30s → 2m → 10m → 1h → 6h → 24h. Após 6 tentativas marca como
`dead_letter`. Schedule sugerido: a cada 30s.

Headers enviados ao endpoint:
- `X-AgeKey-Event-Type`
- `X-AgeKey-Delivery-Id` (idempotency_key)
- `X-AgeKey-Signature` (HMAC-SHA256 do payload, computada no enqueue)

## Required env
- `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
